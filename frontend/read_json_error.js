import fs from "fs";

function run() {
  let file = "";
  try {
    file = fs.readFileSync("test_output.json", "utf-16le");
    const jsonStart = file.indexOf('{"numTotalTestSuites"');
    if (jsonStart === -1) {
      fs.writeFileSync("failure.txt", "No Vitest JSON found in file");
      return;
    }
    const jsonString = file.slice(jsonStart);
    const data = JSON.parse(jsonString);
    const failures = [];

    if (data.testResults) {
      for (const suite of data.testResults) {
        if (suite.assertionResults) {
          for (const res of suite.assertionResults) {
            if (res.status === "failed") {
              const messages = res.failureMessages || [];
              const cleaned = messages.map(msg => msg.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, ''));
              failures.push(`TEST: ${res.fullName}\nMESSAGE: ${cleaned.join("\n")}`);
            }
          }
        }
      }
    }

    fs.writeFileSync("failure.txt", failures.length ? failures.join("\n\n---\n\n") : "No failures found");
  } catch (e) {
    const backup = file ? file.slice(0, 100) : "empty";
    fs.writeFileSync("failure.txt", `Error parsing JSON: ${e.message}\nString Sample: ${backup}`);
  }
}
run();
