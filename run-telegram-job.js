// Simple wrapper to run the telegram job
const { exec } = require('child_process');
const path = require('path');

// Run the telegram job
exec('node_modules/.bin/ts-node src/services/manual-runner.ts --job=telegram', {
  cwd: path.resolve(__dirname),
}, (error, stdout, stderr) => {
  if (error) {
    console.error(`Error: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`stderr: ${stderr}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
});
