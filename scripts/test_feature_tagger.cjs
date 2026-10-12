const fs = require('fs');

const gcode = fs.readFileSync('public/test-models/Assembly_PLA_35m42s.gcode', 'utf8');

// Slicer feature colors and tools mapping
const FEATURE_DEFS = {
  outerWall: { tool: 'T0', color: '#f97316', label: 'Outer Wall' },
  innerWall: { tool: 'T1', color: '#eab308', label: 'Inner Wall' },
  infill:    { tool: 'T2', color: '#a855f7', label: 'Sparse Infill' },
  solid:     { tool: 'T3', color: '#3b82f6', label: 'Solid Surface' },
  support:   { tool: 'T4', color: '#22c55e', label: 'Support' },
  brim:      { tool: 'T5', color: '#06b6d4', label: 'Brim / Skirt' },
  bridge:    { tool: 'T6', color: '#ec4899', label: 'Bridge' },
  other:     { tool: 'T7', color: '#94a3b8', label: 'Other' },
};

function classifyType(line) {
  const t = line.trim();
  if (/^;+\s*TYPE\s*:/i.test(t) || /^;MESH:/i.test(t) || /^;SUPPORT_INTERFACE/i.test(t)) {
    if (/support/i.test(t) || t === ';MESH:SUPPORT' || t === ';SUPPORT_INTERFACE_START') {
      return 'support';
    }
    if (/brim|skirt/i.test(t)) {
      return 'brim';
    }
    if (/outer\s*wall|external\s*perimeter|wall-outer/i.test(t)) {
      return 'outerWall';
    }
    if (/inner\s*wall|overhang|perimeter|wall-inner/i.test(t)) {
      return 'innerWall';
    }
    if (/sparse\s*infill|internal\s*infill|fill\b/i.test(t)) {
      return 'infill';
    }
    if (/solid|top\s*surface|bottom\s*surface|skin|ironing/i.test(t)) {
      return 'solid';
    }
    if (/bridge/i.test(t)) {
      return 'bridge';
    }
    return 'other';
  }
  return null;
}

function processFeatures(inputGcode) {
  const lines = inputGcode.split('\n');
  const result = [];
  let currentTool = null;
  const detectedFeatures = new Set();
  const counts = {};

  for (const line of lines) {
    const t = line.trim();
    const featureKey = classifyType(t);

    if (featureKey) {
      detectedFeatures.add(featureKey);
      counts[featureKey] = (counts[featureKey] || 0) + 1;
      const targetTool = FEATURE_DEFS[featureKey].tool;
      if (targetTool !== currentTool) {
        result.push(line);
        result.push(targetTool);
        currentTool = targetTool;
        continue;
      }
    }
    result.push(line);
  }

  return {
    taggedGcode: result.join('\n'),
    detectedFeatures: Array.from(detectedFeatures),
    counts,
  };
}

const analysis = processFeatures(gcode);
console.log('Detected features:', analysis.detectedFeatures);
console.log('Counts:', analysis.counts);
console.log('Original lines:', gcode.split('\n').length);
console.log('Tagged lines:', analysis.taggedGcode.split('\n').length);
console.log('Diff in lines:', analysis.taggedGcode.split('\n').length - gcode.split('\n').length);
