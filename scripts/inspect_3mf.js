const fs = require('fs');
const JSZip = require('jszip');
const filePath = 'C:\\Users\\akid\\Downloads\\3D_Printing\\3d model\\电源底座.3mf';

(async () => {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  console.log('Zip file entries:');
  Object.keys(zip.files).forEach(f => console.log(' -', f));

  const modelXml = await zip.file('3D/3dmodel.model')?.async('string');
  if (modelXml) {
    console.log('\n--- 3D/3dmodel.model analysis ---');
    const objects = modelXml.match(/<object[^>]*>/g) || [];
    console.log('Object count:', objects.length);
    objects.forEach(o => console.log('Object:', o));

    const items = modelXml.match(/<item[^>]*>/g) || [];
    console.log('Build Item count:', items.length);
    items.forEach(i => console.log('Item:', i));

    const components = modelXml.match(/<component[^>]*>/g) || [];
    if (components.length > 0) {
      console.log('Component count:', components.length);
      components.forEach(c => console.log('Component:', c));
    }
  }
})();
