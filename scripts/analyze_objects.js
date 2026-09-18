const fs = require('fs');
const JSZip = require('jszip');
const filePath = 'C:\\Users\\akid\\Downloads\\3D_Printing\\3d model\\电源底座.3mf';

(async () => {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);

  const obj2Xml = await zip.file('3D/Objects/object_2.model')?.async('string');
  const obj3Xml = await zip.file('3D/Objects/object_3.model')?.async('string');
  const modelXml = await zip.file('3D/3dmodel.model')?.async('string');

  console.log('--- Metadata/slice_info.config or model_settings ---');
  const sliceInfo = await zip.file('Metadata/slice_info.config')?.async('string');
  if (sliceInfo) console.log('slice_info:\n', sliceInfo.slice(0, 1000));

  const modelSettings = await zip.file('Metadata/model_settings.config')?.async('string');
  if (modelSettings) console.log('model_settings:\n', modelSettings.slice(0, 1000));

  function analyzeMeshXml(xml, label) {
    if (!xml) return;
    const vertices = [];
    const vMatches = xml.matchAll(/<vertex\s+x="([^"]+)"\s+y="([^"]+)"\s+z="([^"]+)"/g);
    for (const m of vMatches) {
      vertices.push({ x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) });
    }
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    vertices.forEach(v => {
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
    });
    console.log(`\n${label}:`);
    console.log('  Vertex count:', vertices.length);
    console.log(`  Bounds: X=[${minX.toFixed(1)}, ${maxX.toFixed(1)}], Y=[${minY.toFixed(1)}, ${maxY.toFixed(1)}], Z=[${minZ.toFixed(1)}, ${maxZ.toFixed(1)}]`);
    console.log(`  Dimensions: ${(maxX - minX).toFixed(1)} x ${(maxY - minY).toFixed(1)} x ${(maxZ - minZ).toFixed(1)} mm`);
  }

  analyzeMeshXml(obj2Xml, 'Object 2 (Plate 1)');
  analyzeMeshXml(obj3Xml, 'Object 3 (Plate 2)');
})();
