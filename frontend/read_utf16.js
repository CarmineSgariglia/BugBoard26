const fs = require('fs');
const buf = fs.readFileSync('create_flow_error.txt');
console.log(buf.toString('utf16le'));
