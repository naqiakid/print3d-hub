import os
import tempfile
import re
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from stl import mesh as stl_mesh

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

# g/cm³
DENSITY: dict[str, float] = {
    "pla": 1.24,
    "petg": 1.27,
    "abs": 1.04,
    "tpu": 1.21,
    "nylon": 1.14,
    "pc": 1.20,
}

# Print time multiplier relative to 0.4 mm nozzle baseline
NOZZLE_MULT: dict[float, float] = {0.2: 2.0, 0.4: 1.0, 0.6: 0.65, 0.8: 0.5}


@app.api_route("/health", methods=["GET", "HEAD"])
def health():
    return {"status": "ok"}


@app.post("/slice")
async def slice_stl(
    file: UploadFile = File(...),
    material: str = Form("pla"),
    nozzle_mm: float = Form(0.4),
    infill: int = Form(20),
):
    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    with tempfile.NamedTemporaryFile(suffix=".stl", delete=False) as tmp:
        tmp.write(content)
        stl_path = tmp.name

    try:
        m = stl_mesh.Mesh.from_file(stl_path)
    except Exception as e:
        os.unlink(stl_path)
        raise HTTPException(status_code=422, detail=f"Could not parse STL: {e}")
    finally:
        try:
            os.unlink(stl_path)
        except OSError:
            pass

    # Signed volume via divergence theorem (mm³)
    v0, v1, v2 = m.v0, m.v1, m.v2
    volume_mm3 = abs(
        float(
            (1 / 6)
            * sum(
                -v2[i][0] * v1[i][1] * v0[i][2]
                + v1[i][0] * v2[i][1] * v0[i][2]
                + v2[i][0] * v0[i][1] * v1[i][2]
                - v0[i][0] * v2[i][1] * v1[i][2]
                - v1[i][0] * v0[i][1] * v2[i][2]
                + v0[i][0] * v1[i][1] * v2[i][2]
                for i in range(len(v0))
            )
        )
    )
    volume_cm3 = volume_mm3 / 1000.0

    density = DENSITY.get(material, 1.24)
    infill_frac = max(0.05, min(1.0, infill / 100.0))

    # Shells ~25 % of solid volume regardless of infill
    shell_vol = volume_cm3 * 0.25
    infill_vol = volume_cm3 * 0.75 * infill_frac
    used_vol_cm3 = shell_vol + infill_vol
    weight_g = used_vol_cm3 * density

    # Print time estimate: base flow at 0.4 mm nozzle, 60 mm/s avg
    extrusion_width = nozzle_mm * 1.1  # mm
    layer_height = nozzle_mm * 0.5     # mm
    flow_mm3_per_s = 60.0 * extrusion_width * layer_height
    base_time_s = (used_vol_cm3 * 1000.0) / flow_mm3_per_s
    nozzle_mult = NOZZLE_MULT.get(nozzle_mm, 1.0)
    print_hours = max(0.1, round((base_time_s * nozzle_mult) / 3600.0, 2))

    return {
        "weight_g": round(weight_g, 1),
        "print_hours": print_hours,
    }
