const fs = require('fs');
const code = fs.readFileSync(require.resolve('gcode-preview'), 'utf8');
const p = code.indexOf('case"t6"');
console.log('Around t6:', code.slice(p, p + 250));
