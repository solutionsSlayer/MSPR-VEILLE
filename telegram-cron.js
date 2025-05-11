/**
 * Script pour configurer une tâche cron d'envoi Telegram
 * 
 * Ce script configure une tâche cron qui exécute le job Telegram
 * selon la fréquence définie dans la variable d'environnement TELEGRAM_SEND_CRON
 */

const cron = require('node-cron');
const { exec } = require('child_process');
const path = require('path');
require('dotenv').config();

// Configuration
const TELEGRAM_SEND_CRON = process.env.TELEGRAM_SEND_CRON || '0 */4 * * *'; // Par défaut toutes les 4 heures

console.log(`🔔 Configuration du job Telegram avec schedule: ${TELEGRAM_SEND_CRON}`);

// Fonction pour exécuter le job
function runTelegramJob() {
  console.log(`⏰ Exécution du job Telegram à ${new Date().toISOString()}`);
  
  exec('node telegram-sender.js', {
    cwd: path.resolve(__dirname),
  }, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Erreur lors de l'exécution du job Telegram: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`⚠️ Stderr: ${stderr}`);
      return;
    }
    console.log(`✅ ${stdout}`);
  });
}

// Configuration de la tâche cron
if (cron.validate(TELEGRAM_SEND_CRON)) {
  cron.schedule(TELEGRAM_SEND_CRON, runTelegramJob, {
    scheduled: true,
    timezone: "Europe/Paris"
  });
  
  console.log('✅ Job Telegram configuré avec succès!');
  console.log(`⏱️ Prochaines exécutions (approximatives):`);
  
  // Afficher les 3 prochaines exécutions (approximatif)
  const task = cron.getTasks()[0];
  const now = new Date();
  let nextDate = new Date(now);
  
  for (let i = 0; i < 3; i++) {
    nextDate = task.nextDate(nextDate).toDate();
    console.log(`   ${i+1}. ${nextDate.toLocaleString()}`);
  }
  
  console.log('\n📝 Le job sera exécuté à ces moments. Appuyez sur Ctrl+C pour arrêter.\n');
  
  // Exécuter immédiatement pour tester
  console.log('🚀 Exécution immédiate du job pour test...');
  runTelegramJob();
} else {
  console.error(`❌ Format de cron invalide: ${TELEGRAM_SEND_CRON}`);
  process.exit(1);
}
