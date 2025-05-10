// Simple wrapper to run cron-jobs.ts 
// This avoids path resolution issues in Docker

console.log('Starting cron wrapper...');

// Require the ts-node/register hook with transpileOnly option to skip type checking
require('ts-node').register({
  transpileOnly: true, // Skip type checking
  compilerOptions: {
    module: 'commonjs'
  }
});

// Now we can require TypeScript files directly
try {
  console.log('Loading cron-jobs.ts...');
  // Use an absolute path to the file
  require('./cron-jobs.ts');
  console.log('Cron jobs started successfully');
} catch (error) {
  console.error('Failed to load cron-jobs.ts:', error);
  process.exit(1);
} 