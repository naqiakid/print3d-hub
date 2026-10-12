const fs = require('fs');
const THREE = require('three');

// Create a parametric ergonomic Phone Stand geometry
// Dimensions: width = 60mm, depth = 70mm, height = 65mm
const shape = new THREE.Shape();

// Side profile of phone stand:
// Bottom base -> back support (slanted) -> top curve -> front backstop -> lip -> front foot
shape.moveTo(0, 0);           // Rear bottom corner
shape.lineTo(65, 0);          // Front bottom corner
shape.lineTo(65, 12);         // Front lip vertical
shape.lineTo(55, 12);         // Lip top inner
shape.lineTo(55, 6);          // Cradle bottom
shape.lineTo(20, 60);         // Angled backrest top
shape.lineTo(12, 60);         // Backrest top thickness
shape.lineTo(0, 8);           // Rear incline
shape.closePath();

const extrudeSettings = {
  steps: 1,
  depth: 55, // 55mm wide
  bevelEnabled: true,
  bevelThickness: 1.5,
  bevelSize: 1.5,
  bevelSegments: 3,
};

const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
geom.computeVertexNormals();
geom.rotateX(-Math.PI / 2); // Sit flat on bed

// Convert to binary STL buffer
const position = geom.attributes.position;
const normal = geom.attributes.normal;
let index = geom.index;

let triangleCount = 0;
if (index) {
  triangleCount = index.count / 3;
} else {
  triangleCount = position.count / 3;
}

const bufSize = 84 + triangleCount * 50;
const buf = Buffer.alloc(bufSize);
buf.write('Ergonomic Phone Stand - 3MF Studio Sample', 0, 80, 'ascii');
buf.writeUInt32LE(triangleCount, 80);

let offset = 84;
for (let i = 0; i < triangleCount; i++) {
  const i0 = index ? index.getX(i * 3 + 0) : i * 3 + 0;
  const i1 = index ? index.getX(i * 3 + 1) : i * 3 + 1;
  const i2 = index ? index.getX(i * 3 + 2) : i * 3 + 2;

  // Normal from first vertex or calculated
  const nx = normal ? normal.getX(i0) : 0;
  const ny = normal ? normal.getY(i0) : 0;
  const nz = normal ? normal.getZ(i0) : 1;

  buf.writeFloatLE(nx, offset + 0);
  buf.writeFloatLE(ny, offset + 4);
  buf.writeFloatLE(nz, offset + 8);

  buf.writeFloatLE(position.getX(i0), offset + 12);
  buf.writeFloatLE(position.getY(i0), offset + 16);
  buf.writeFloatLE(position.getZ(i0), offset + 20);

  buf.writeFloatLE(position.getX(i1), offset + 24);
  buf.writeFloatLE(position.getY(i1), offset + 28);
  buf.writeFloatLE(position.getZ(i1), offset + 32);

  buf.writeFloatLE(position.getX(i2), offset + 36);
  buf.writeFloatLE(position.getY(i2), offset + 40);
  buf.writeFloatLE(position.getZ(i2), offset + 44);

  buf.writeUInt16LE(0, offset + 48);
  offset += 50;
}

fs.writeFileSync('public/sample-models/phone_stand.stl', buf);
console.log('✅ Generated phone_stand.stl! Triangles:', triangleCount, 'Size:', buf.length, 'bytes (~' + (buf.length / 1024).toFixed(1) + ' KB)');
