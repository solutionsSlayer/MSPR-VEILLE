// Script pour exécuter les jobs manuellement
import { runAiSummaryJob, runPodcastGeneratorJob } from './src/services/cron-jobs';

async function runJobs() {
  try {
    console.log('Démarrage du traitement des résumés AI...');
    await runAiSummaryJob();
    console.log('Traitement des résumés AI terminé');
    
    console.log('Démarrage de la génération des podcasts...');
    await runPodcastGeneratorJob();
    console.log('Génération des podcasts terminée');
  } catch (error) {
    console.error('Erreur lors de l\'exécution des jobs:', error);
  }
}

runJobs(); 