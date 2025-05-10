// Script temporaire pour exécuter les jobs manuellement
require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    target: 'es2016'
  }
});

async function runJobs() {
  try {
    console.log('Démarrage du traitement des résumés AI...');
    const cronJobs = require('./src/services/cron-jobs');
    
    // Exécuter le job de résumé AI
    await cronJobs.runAiSummaryJob();
    console.log('Traitement des résumés AI terminé');
    
    // Exécuter le job de génération de podcasts
    console.log('Démarrage de la génération des podcasts...');
    await cronJobs.runPodcastGeneratorJob();
    console.log('Génération des podcasts terminée');
  } catch (error) {
    console.error('Erreur lors de l\'exécution des jobs:', error);
  }
}

runJobs(); 