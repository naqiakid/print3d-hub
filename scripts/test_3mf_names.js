const fs = require('fs');
const JSZip = require('jszip');
const filePath = 'C:\\Users\\akid\\Downloads\\3D_Printing\\3d model\\电源底座.3mf';

(async () => {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);

  // 1. Try reading model_settings.config for part names
  const partNames = [];
  const modelSettings = await zip.file('Metadata/model_settings.config')?.async('string');
  if (modelSettings) {
    const objectMatches = modelSettings.matchAll(/<object id="([^"]+)">\s*<metadata key="name" value="([^"]+)"\/>/g);
    for (const m of objectMatches) {
      partNames.push({ objectId: m[1], name: m[2] });
    }
  }
  console.log('Extracted Part Names from model_settings:', partNames);

  // 2. Try reading 3D/3dmodel.model build items
  const modelXml = await zip.file('3D/3dmodel.model')?.async('string');
  const buildItems = [];
  if (modelXml) {
    const itemMatches = modelXml.matchAll(/<item[^>]*objectid="([^"]+)"[^>]*transform="([^"]+)"[^>]*>/g);
    for (const m of itemMatches) {
      buildItems.push({ objectId: m[1], transform: m[2] });
    }
  }
  console.log('Extracted Build Items from 3dmodel.model:', buildItems);
})();
