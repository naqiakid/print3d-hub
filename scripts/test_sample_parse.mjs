import fs from 'fs';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

// Test phone stand
const phoneStandBuf = fs.readFileSync('public/sample-models/phone_stand.stl');
const stlLoader = new STLLoader();
const phoneGeom = stlLoader.parse(phoneStandBuf.buffer.slice(phoneStandBuf.byteOffset, phoneStandBuf.byteOffset + phoneStandBuf.byteLength));
phoneGeom.computeBoundingBox();
const phoneSize = new THREE.Vector3();
phoneGeom.boundingBox.getSize(phoneSize);
console.log('✅ Phone Stand Parsed! Dimensions (mm):', phoneSize.x.toFixed(1), 'x', phoneSize.y.toFixed(1), 'x', phoneSize.z.toFixed(1));

// Test 3DBenchy
const benchyBuf = fs.readFileSync('public/sample-models/3DBenchy.stl');
const benchyGeom = stlLoader.parse(benchyBuf.buffer.slice(benchyBuf.byteOffset, benchyBuf.byteOffset + benchyBuf.byteLength));
benchyGeom.computeBoundingBox();
const benchySize = new THREE.Vector3();
benchyGeom.boundingBox.getSize(benchySize);
console.log('✅ 3DBenchy Parsed! Dimensions (mm):', benchySize.x.toFixed(1), 'x', benchySize.y.toFixed(1), 'x', benchySize.z.toFixed(1));
