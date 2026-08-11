const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');

console.log("Starting News Crawler Scheduler...");

// Run the crawler every 6 hours (at minute 0 past every 6th hour)
cron.schedule('0 */6 * * *', () => {
  console.log(`[${new Date().toISOString()}] Running scheduled news crawler...`);
  
  const algorithmDir = path.resolve(__dirname, '..', '..', 'algorithm');
  
  exec('python crawler_english.py', { cwd: algorithmDir }, (error, stdout, stderr) => {
    if (error) {
      console.error(`Crawler execution error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Crawler stderr: ${stderr}`);
    }
    console.log(`Crawler output:\n${stdout}`);
    console.log(`[${new Date().toISOString()}] Crawler finished successfully.`);
  });
});

console.log("Scheduler initialized. The crawler will run every 6 hours.");
