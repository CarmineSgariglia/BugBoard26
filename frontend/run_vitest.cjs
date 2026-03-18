const { execSync } = require('child_process');
const fs = require('fs');

const args = process.argv.slice(2);
const files = args.join(' ');

try {
  console.log("=== RUNNING VITEST ON: " + files + " ===");
  const output = execSync(`npx vitest run ${files}`, {
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe']
  });
  fs.writeFileSync('exact_error.txt', output);
  console.log("Success written to exact_error.txt");
} catch (error) {
  const out = error.stdout ? error.stdout.toString() : "No stdout";
  const err = error.stderr ? error.stderr.toString() : (error.message || "Unknown error");
  fs.writeFileSync('exact_error.txt', "STDOUT:\n" + out + "\n\nSTDERR:\n" + err);
  console.log("Error written to exact_error.txt");
}
