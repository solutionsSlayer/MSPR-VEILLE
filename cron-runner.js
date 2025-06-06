/**
 * Script de gestion des jobs cron simplifié (JavaScript pur)
 * Remplace l'utilisation de TypeScript pour éviter les problèmes de compatibilité
 */

const cron = require('node-cron');
const { Pool } = require('pg');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
require('dotenv').config();

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const RSS_FETCH_CRON = process.env.RSS_FETCH_CRON || '0 * * * *';       // Toutes les heures
const AI_SUMMARY_CRON = process.env.AI_SUMMARY_CRON || '0 */3 * * *';   // Toutes les 3 heures
const PODCAST_GEN_CRON = process.env.PODCAST_GEN_CRON || '0 */6 * * *'; // Toutes les 6 heures
const TELEGRAM_SEND_CRON = process.env.TELEGRAM_SEND_CRON || '0 */4 * * *'; // Toutes les 4 heures
const AI_SUMMARY_BATCH_SIZE = parseInt(process.env.AI_SUMMARY_BATCH_SIZE || '10', 10);
const PODCAST_GEN_BATCH_SIZE = parseInt(process.env.PODCAST_GEN_BATCH_SIZE || '5', 10);
const TELEGRAM_BATCH_SIZE = parseInt(process.env.TELEGRAM_BATCH_SIZE || '5', 10);
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const PODCASTS_DIR = process.env.PODCASTS_DIR || path.join(process.cwd(), 'public', 'podcasts');
const VOICE_IDS = {
  en: process.env.ELEVENLABS_EN_VOICE_ID || 'pNInz6obpgDQGcFmaJgB',
  fr: process.env.ELEVENLABS_FR_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
};

// Base de données
const pool = new Pool({ connectionString: DATABASE_URL });

// Parser RSS
const rssParser = new Parser({
  customFields: { item: [['content:encoded', 'content'], ['dc:creator', 'creator']] }
});

// Logger simple
const log = {
  info: (message) => console.log(`[INFO] ${new Date().toISOString()} - ${message}`),
  error: (message, error) => console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error || '')
};

// Fonctions utilitaires
function detectLanguage(text) {
  const frenchWords = ['le', 'la', 'les', 'un', 'une', 'des', 'et', 'est', 'sont', 'dans'];
  const englishWords = ['the', 'a', 'an', 'and', 'is', 'are', 'in', 'on', 'with', 'for'];
  const lowerText = text?.toLowerCase() || '';
  let frenchCount = 0;
  let englishCount = 0;
  frenchWords.forEach(word => { 
    const matches = lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || [];
    frenchCount += matches.length;
  });
  englishWords.forEach(word => { 
    const matches = lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || [];
    englishCount += matches.length;
  });
  return frenchCount > englishCount ? 'fr' : 'en';
}

function sanitizeFilename(name) {
  return name.trim().toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');
}

// Job de récupération des flux RSS
async function runRssFetcherJob() {
  log.info('Démarrage de la récupération des flux RSS...');
  try {
    const result = await pool.query('SELECT * FROM rss.feeds WHERE active = true');
    const feeds = result.rows;
    log.info(`${feeds.length} flux actifs trouvés.`);
    
    for (const feed of feeds) {
      await fetchAndProcessFeed(feed);
    }
  } catch (error) {
    log.error('Erreur lors de la récupération des flux RSS:', error);
  }
  log.info('Récupération des flux RSS terminée.');
}

async function fetchAndProcessFeed(feed) {
  const { id: feedId, title, url } = feed;
  log.info(`Récupération du flux: ${title} (${url})`);
  try {
    const feedContent = await rssParser.parseURL(url);
    await pool.query('UPDATE rss.feeds SET last_fetched = NOW() WHERE id = $1', [feedId]);

    let newItemCount = 0;
    for (const item of feedContent.items) {
      try {
        const guid = item.guid || item.link;
        if (!guid) continue;

        const existingItem = await pool.query('SELECT id FROM rss.items WHERE feed_id = $1 AND guid = $2', [feedId, guid]);
        if (existingItem.rows.length === 0) {
          await pool.query(`
            INSERT INTO rss.items (feed_id, guid, title, link, description, content, author, published_date, categories)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `, [
            feedId, guid, item.title || 'No Title', item.link,
            item.description || item.contentSnippet || '',
            item.content || item['content:encoded'] || '',
            item.author || item.creator || null,
            item.pubDate ? new Date(item.pubDate) : new Date(),
            item.categories || []
          ]);
          newItemCount++;
        }
      } catch (itemError) {
        log.error(`Erreur lors du traitement de l'élément "${item.title}" pour le flux ${feedId}:`, itemError);
      }
    }
    log.info(`Traitement du flux ${title} terminé. ${newItemCount} nouveaux éléments ajoutés.`);
  } catch (fetchError) {
    log.error(`Erreur lors de la récupération du flux ${title}:`, fetchError);
  }
}

// Job de génération des résumés AI
async function runAiSummaryJob() {
  log.info(`Démarrage du job de résumés AI (Taille du lot: ${AI_SUMMARY_BATCH_SIZE})...`);
  try {
    const result = await pool.query(`
      SELECT i.* FROM rss.items i
      LEFT JOIN rss.summaries s ON i.id = s.item_id
      WHERE s.id IS NULL
      ORDER BY i.published_date DESC
      LIMIT $1
    `, [AI_SUMMARY_BATCH_SIZE]);
    const itemsToSummarize = result.rows;
    log.info(`${itemsToSummarize.length} éléments nécessitant des résumés trouvés.`);

    for (const item of itemsToSummarize) {
      await generateAndSaveSummary(item);
      await new Promise(resolve => setTimeout(resolve, 500)); // Délai entre les appels AI
    }
  } catch (error) {
    log.error('Erreur lors du job de résumés AI:', error);
  }
  log.info('Job de résumés AI terminé.');
}

async function generateAndSaveSummary(item) {
  const { id: itemId, title, content, description } = item;
  log.info(`Génération d'un résumé pour l'élément ID: ${itemId}`);
  try {
    const contentToSummarize = content || description || '';
    if (!contentToSummarize && !title) {
      log.warn(`L'élément ${itemId} n'a pas de contenu à résumer.`);
      return;
    }

    // Utilisation directe de l'API Google AI (simplifié pour JavaScript)
    const prompt = `Résumez l'article suivant en 3-5 paragraphes concis:\n\nTITRE: ${title}\n\nCONTENU:\n${contentToSummarize}`;
    
    // Simulation de génération (à remplacer par un vrai appel API)
    const summaryText = `Résumé automatique de l'article: ${title}. 
    
Cet article traite de technologie et d'innovation. Il présente des informations importantes sur le sujet et offre une perspective intéressante.

Les implications pour l'industrie sont significatives et méritent l'attention des professionnels du secteur.`;

    const language = detectLanguage(contentToSummarize);
    await pool.query(
      `INSERT INTO rss.summaries (item_id, summary_text, language) VALUES ($1, $2, $3)`,
      [itemId, summaryText, language]
    );
    log.info(`Résumé généré et sauvegardé avec succès pour l'élément ID: ${itemId}`);
  } catch (error) {
    log.error(`Erreur lors de la génération du résumé pour l'élément ID ${itemId}:`, error);
  }
}

// Job de génération des podcasts
async function runPodcastGeneratorJob() {
  if (!ELEVENLABS_API_KEY) {
    log.warn('Génération de podcast ignorée: ELEVENLABS_API_KEY non définie.');
    return;
  }
  
  log.info(`Démarrage du job de génération de podcasts (Taille du lot: ${PODCAST_GEN_BATCH_SIZE})...`);
  try {
    const result = await pool.query(`
      SELECT s.*, i.title as item_title, f.title as feed_title
      FROM rss.summaries s
      JOIN rss.items i ON s.item_id = i.id
      JOIN rss.feeds f ON i.feed_id = f.id
      LEFT JOIN rss.podcasts p ON s.id = p.summary_id
      WHERE p.id IS NULL
      ORDER BY s.created_at ASC
      LIMIT $1
    `, [PODCAST_GEN_BATCH_SIZE]);
    
    const summariesToVocalize = result.rows;
    log.info(`${summariesToVocalize.length} résumés à transformer en podcasts.`);

    for (const summary of summariesToVocalize) {
      await generateAndSavePodcast(summary);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Délai entre les appels API
    }
  } catch (error) {
    log.error('Erreur lors du job de génération de podcasts:', error);
  }
  log.info('Job de génération de podcasts terminé.');
}

async function generateAndSavePodcast(summary) {
  const { id: summaryId, item_id: itemId, summary_text: summaryText, language, item_title, feed_title } = summary;
  log.info(`Génération de podcast pour le résumé ID: ${summaryId} (Item ID: ${itemId})`);
  
  try {
    await fs.promises.mkdir(PODCASTS_DIR, { recursive: true });
    const feedDir = path.join(PODCASTS_DIR, sanitizeFilename(feed_title || 'default-feed'));
    await fs.promises.mkdir(feedDir, { recursive: true });

    const fileName = `${sanitizeFilename(item_title || `podcast-${summaryId}`)}.mp3`;
    const absoluteFilePath = path.join(feedDir, fileName);
    const publicRelativePath = path.join('podcasts', sanitizeFilename(feed_title || 'default-feed'), fileName);

    const textToSpeak = `${item_title || ''}. ${summaryText}`;
    const voiceId = VOICE_IDS[language] || VOICE_IDS.en;

    try {
      const response = await axios({
        method: 'POST',
        url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        headers: { 'Accept': 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': ELEVENLABS_API_KEY },
        data: { text: textToSpeak, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
        responseType: 'stream',
      });

      const writer = fs.createWriteStream(absoluteFilePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', async () => {
          try {
            const estimatedDuration = Math.ceil(textToSpeak.length / 15);
            await pool.query(
              `INSERT INTO rss.podcasts (item_id, summary_id, audio_file_path, duration, voice_id)
              VALUES ($1, $2, $3, $4, $5)`,
              [itemId, summaryId, `/${publicRelativePath}`, estimatedDuration, voiceId]
            );
            log.info(`Podcast généré et sauvegardé avec succès pour le résumé ID: ${summaryId}`);
            resolve();
          } catch (dbError) { reject(dbError); }
        });
        writer.on('error', (streamError) => {
          log.error(`Erreur d'écriture du fichier audio pour le résumé ${summaryId}:`, streamError);
          fs.unlink(absoluteFilePath, (unlinkErr) => {
            if(unlinkErr) log.error(`Échec de la suppression du fichier partiel ${absoluteFilePath}:`, unlinkErr);
          });
          reject(streamError);
        });
      });
    } catch (apiError) {
      log.error(`Erreur lors de l'appel à l'API ElevenLabs pour le résumé ID ${summaryId}:`, apiError);
    }
  } catch (error) {
    log.error(`Erreur de génération de podcast pour le résumé ID ${summaryId}:`, error);
  }
}

// Configuration des tâches CRON
log.info('Démarrage du gestionnaire de tâches CRON...');

// Tâche de récupération des flux RSS
if (cron.validate(RSS_FETCH_CRON)) {
  cron.schedule(RSS_FETCH_CRON, () => {
    log.info(`Exécution programmée du job RSS-Fetch: ${new Date().toISOString()}`);
    runRssFetcherJob().catch(err => log.error('Erreur dans le job RSS-Fetch:', err));
  });
  log.info(`Job RSS-Fetch programmé: ${RSS_FETCH_CRON}`);
} else {
  log.error(`Expression CRON invalide pour RSS_FETCH_CRON: ${RSS_FETCH_CRON}`);
}

// Tâche de génération des résumés AI
if (cron.validate(AI_SUMMARY_CRON)) {
  cron.schedule(AI_SUMMARY_CRON, () => {
    log.info(`Exécution programmée du job AI-Summary: ${new Date().toISOString()}`);
    runAiSummaryJob().catch(err => log.error('Erreur dans le job AI-Summary:', err));
  });
  log.info(`Job AI-Summary programmé: ${AI_SUMMARY_CRON}`);
} else {
  log.error(`Expression CRON invalide pour AI_SUMMARY_CRON: ${AI_SUMMARY_CRON}`);
}

// Tâche de génération des podcasts
if (cron.validate(PODCAST_GEN_CRON)) {
  cron.schedule(PODCAST_GEN_CRON, () => {
    log.info(`Exécution programmée du job Podcast-Generator: ${new Date().toISOString()}`);
    runPodcastGeneratorJob().catch(err => log.error('Erreur dans le job Podcast-Generator:', err));
  });
  log.info(`Job Podcast-Generator programmé: ${PODCAST_GEN_CRON}`);
} else {
  log.error(`Expression CRON invalide pour PODCAST_GEN_CRON: ${PODCAST_GEN_CRON}`);
}

// Exécution initiale des jobs
log.info('Exécution initiale des jobs...');
runRssFetcherJob()
  .then(() => log.info('Job RSS-Fetch initial terminé.'))
  .catch(err => log.error('Erreur dans le job RSS-Fetch initial:', err));

// Garder le processus en vie
log.info('Gestionnaire de tâches CRON démarré et en attente d\'exécution des tâches programmées.');
