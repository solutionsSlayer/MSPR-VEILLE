// Simple wrapper to run the JavaScript cron script
// This avoids TypeScript compilation issues

console.log('Starting cron wrapper...');
console.log('Redirecting to JavaScript cron runner...');

// Just require the JavaScript cron runner
try {
  console.log('Loading cron-runner.js...');
  // Use an absolute path to the file
  require('../../cron-runner.js');
  console.log('Cron jobs started successfully');
} catch (error) {
  console.error('Failed to load cron-runner.js:', error);
  process.exit(1);
}
