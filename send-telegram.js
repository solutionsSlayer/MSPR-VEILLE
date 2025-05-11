/**
 * Script pour exécuter le job Telegram
 * 
 * Ce script simplifie l'exécution du job d'envoi Telegram
 * sans avoir à se préoccuper des problèmes de compilation TypeScript.
 */

const { execSync } = require('child_process');

console.log('🚀 Démarrage du job d\'envoi Telegram...');

try {
  execSync(
    'NODE_OPTIONS="--loader ts-node/esm" npx ts-node src/services/manual-runner-telegram.ts', 
    { 
      stdio: 'inherit',
      cwd: __dirname 
    }
  );
  console.log('✅ Job Telegram terminé avec succès!');
} catch (error) {
  console.error('❌ Erreur lors de l\'exécution du job Telegram:', error.message);
  process.exit(1);
}
