const fs = require('fs');
const path = require('path');

const baseDir = __dirname; // src/test

const folders = [
  { dir: 'features/issue/activity', alias: '@features/issue/activity' },
  { dir: 'features/notification/ui', alias: '@features/notification/ui' }
];

console.log("=== UPDATING RELATIVE MOCKS ===");
folders.forEach(group => {
  const fullDir = path.join(baseDir, group.dir);
  if (!fs.existsSync(fullDir)) return;

  const files = fs.readdirSync(fullDir);
  files.forEach(filename => {
    if (!filename.includes('.test.')) return;
    
    const filePath = path.join(fullDir, filename);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Replace vi.mock("./foo") with vi.mock("@alias/foo")
    const original = content;
    content = content.replace(/vi\.mock\("\.\/([^"]+)"/g, `vi.mock("${group.alias}/$1"`);
    
    if (original !== content) {
       fs.writeFileSync(filePath, content);
       console.log(`Updated relative vi.mock paths in ${filename}`);
    }
  });
});
