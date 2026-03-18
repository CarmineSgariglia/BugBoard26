const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'test-report.txt');
const buf = fs.readFileSync(filePath);

// Simple heuristic: if the second byte is 0, it is likely UTF-16 LE
const isUtf16 = buf.length > 1 && buf[1] === 0;
const content = buf.toString(isUtf16 ? 'utf16le' : 'utf8');

console.log("=== FULL REPORT CONTENTS ===");
console.log(content);
console.log("=== END OF REPORT ===");
