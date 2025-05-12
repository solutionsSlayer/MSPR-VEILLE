const cron = require("node-cron");
const { exec } = require("child_process");
const { Pool } = require("pg");
const Parser = require("rss-parser");
require("dotenv").config();

console.log("Starting cron service...");

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const RSS_FETCH_CRON = process.env.RSS_FETCH_CRON || "0 * * * *";
const AI_SUMMARY_CRON = process.env.AI_SUMMARY_CRON || "0 */3 * * *";
const PODCAST_GEN_CRON = process.env.PODCAST_GEN_CRON || "0 */6 * * *";

// Simple logger
const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

// Task functions - run simple scripts directly
const runRssFetch = () => {
  log("Running RSS fetch job");
  exec("node src/services/rss-fetcher.js", (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Stderr: ${stderr}`);
      return;
    }
    console.log(`Stdout: ${stdout}`);
  });
};

// Schedule cron jobs
cron.schedule(RSS_FETCH_CRON, () => {
  log(`Running scheduled RSS fetch job: ${RSS_FETCH_CRON}`);
  runRssFetch();
});

cron.schedule(AI_SUMMARY_CRON, () => {
  log(`Running scheduled AI summary job: ${AI_SUMMARY_CRON}`);
  exec("node src/services/ai-summary.js", (error, stdout, stderr) => {
    console.log(stdout);
    if (error) console.error(error);
  });
});

cron.schedule(PODCAST_GEN_CRON, () => {
  log(`Running scheduled podcast generation job: ${PODCAST_GEN_CRON}`);
  exec("node src/services/podcast-generator.js", (error, stdout, stderr) => {
    console.log(stdout);
    if (error) console.error(error);
  });
});

// Initial run at startup
setTimeout(() => {
  log("Running initial RSS fetch job");
  runRssFetch();
}, 10000); // Wait 10 seconds for other services to be ready

// Keep service running
log("Cron service started and running..."); 