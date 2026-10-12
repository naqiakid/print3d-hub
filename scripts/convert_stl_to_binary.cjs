const fs = require('fs');
const THREE = require('three');

// Simple ASCII to Binary STL converter
const ascii = fs.readFileSync('public/sample-models/3DBenchy.stl', 'utf8');

const normalMatches = ascii.matchAll(/facet normal\s+([-\d.e+]+)\s+([-\d.e+]+)\s+([-\d.e+]+)/gi);
const vertexMatches = ascii.matchAll(/vertex\s+([-\d.e+]+)\s+([-\d.e+]+)\s+([-\d.e+]+)/gi);

const normals = [];
for (const m of normalMatches) {
  normals.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
}

const vertices = [];
for (const m of vertexMatches) {
  vertices.push([parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]);
}

console.log('Normals count:', normals.length);
console.log('Vertices count:', vertices.length);

const triangleCount = Math.floor(vertices.length / 3);
console.log('Triangles:', triangleCount);

// Binary STL format: 80 bytes header, 4 bytes uint32 triangle count, then for each triangle: 12 floats (50 bytes each)
const bufferSize = 84 + triangleCount * 50;
const buf = Buffer.alloc(bufferSize);

// Header
buf.write('3DBenchy Binary STL - 3MF Studio Web-Optimized', 0, 80, 'ascii');
buf.writeUInt32LE(triangleCount, 80);

let offset = 84;
for (let i = 0; i < triangleCount; i++) {
  const norm = normals[i] || [0, 0, 0];
  const v1 = vertices[i * 3 + 0];
  const v2 = vertices[i * 3 + 1];
  const v3 = vertices[i * 3 + 2];

  // Normal (3 floats)
  buf.writeFloatLE(norm[0], offset + 0);
  buf.writeFloatLE(norm[1], offset + 4);
  buf.writeFloatLE(norm[2], offset + 8);

  // V1 (3 floats)
  buf.writeFloatLE(v1[0], offset + 12);
  buf.writeFloatLE(v1[1], offset + 16);
  buf.writeFloatLE(v1[2], offset + 20);

  // V2 (3 floats)
  buf.writeFloatLE(v2[0], offset + 24);
  buf.writeFloatLE(v2[1], offset + 28);
  buf.writeFloatLE(v2[2], offset + 32);

  // V3 (3 floats)
  buf.writeFloatLE(v3[0], offset + 36);
  buf.writeFloatLE(v3[1], offset + 40);
  buf.writeFloatLE(v3[2], offset + 44);

  // Attribute byte count (uint16 = 0)
  buf.writeUInt16LE(0, offset + 48);

  offset += 50;
}

fs.writeFileSync('public/sample-models/3DBenchy.stl', buf);
console.log('Wrote binary STL! New size:', buf.length, 'bytes (~' + (buf.length / 1024 / 1024).toFixed(2) + ' MB)');
