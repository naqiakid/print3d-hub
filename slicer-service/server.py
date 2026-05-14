import os
import tempfile
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import trimesh

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
        mesh = trimesh.load(stl_path, force="mesh")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Could not parse STL: {e}")
    finally:
        try:
            os.unlink(stl_path)
        except OSError:
            pass

    if not isinstance(mesh, trimesh.Trimesh):
        raise HTTPException(status_code=422, detail="File does not contain a single mesh")

    # Signed volume via trimesh (mm³) — more accurate than manual divergence theorem
    volume_mm3 = abs(float(mesh.volume))
    if volume_mm3 < 1:
        # Non-watertight mesh: fall back to convex hull estimate
        volume_mm3 = abs(float(mesh.convex_hull.volume)) * 0.6

    volume_cm3 = volume_mm3 / 1000.0

    # Shell volume based on surface area × wall thickness.
    # wall_thickness = extrusion_width × perimeters = (nozzle × 1.2) × 3
    wall_thickness_mm = nozzle_mm * 1.2 * 3
    shell_vol_cm3 = min((mesh.area * wall_thickness_mm) / 1000.0, volume_cm3)

    infill_frac = max(0.05, min(1.0, infill / 100.0))
    infill_vol_cm3 = max(0.0, volume_cm3 - shell_vol_cm3) * infill_frac

    used_vol_cm3 = shell_vol_cm3 + infill_vol_cm3
    density = DENSITY.get(material.lower(), 1.24)
    weight_g = used_vol_cm3 * density

    # Print time estimate from volumetric flow rate at 60 mm/s average speed
    extrusion_width = nozzle_mm * 1.1
    layer_height = nozzle_mm * 0.5
    flow_mm3_per_s = 60.0 * extrusion_width * layer_height
    base_time_s = (used_vol_cm3 * 1000.0) / flow_mm3_per_s
    nozzle_mult = NOZZLE_MULT.get(nozzle_mm, 1.0)
    print_hours = max(0.1, round((base_time_s * nozzle_mult) / 3600.0, 2))

    return {
        "weight_g": round(weight_g, 1),
        "print_hours": print_hours,
    }
