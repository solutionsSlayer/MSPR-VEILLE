/**
 * Script d'exécution manuelle des tâches cron
 * 
 * Permet de lancer individuellement les tâches de récupération de flux RSS,
 * génération de résumés AI et génération de podcasts sans utiliser le container cron
 */

// Import des modules nécessaires
import { Pool } from 'pg';
import { ai } from '../ai/ai-instance';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { logger } from '../lib/logger';
import Parser from 'rss-parser';
import dotenv from 'dotenv';
import { sendMessageToTelegram, sendAudioToTelegram, formatSummaryMessage, formatPodcastCaption } from './telegram';

// Chargement des variables d'environnement
dotenv.config();

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const AI_SUMMARY_BATCH_SIZE = parseInt(process.env.AI_SUMMARY_BATCH_SIZE || '10', 10);
const PODCAST_GEN_BATCH_SIZE = parseInt(process.env.PODCAST_GEN_BATCH_SIZE || '5', 10);
const TELEGRAM_BATCH_SIZE = parseInt(process.env.TELEGRAM_BATCH_SIZE || '5', 10);
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const PODCASTS_DIR = process.env.PODCASTS_DIR || path.join(process.cwd(), 'public', 'podcasts');
const VOICE_IDS: Record<string, string> = {
  en: process.env.ELEVENLABS_EN_VOICE_ID || 'pNInz6obpgDQGcFmaJgB',
  fr: process.env.ELEVENLABS_FR_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
};

// Initialisation du logger
const log = logger.forService('manual-runner');

// Initialisation de la connexion à la base de données
const pool = new Pool({ connectionString: DATABASE_URL });

// Initialisation du parser RSS
const rssParser = new Parser({
  customFields: { item: [['content:encoded', 'content'], ['dc:creator', 'creator']] }
});

// Interface pour les items étendus
interface ExtendedItem extends Parser.Item {
  content?: string;
  'content:encoded'?: string;
  contentSnippet?: string;
  description?: string;
  author?: string;
  creator?: string;
}

// Détection de langue
function detectLanguage(text: string): string {
  const frenchWords = ['le', 'la', 'les', 'un', 'une', 'des', 'et', 'est', 'sont', 'dans'];
  const englishWords = ['the', 'a', 'an', 'and', 'is', 'are', 'in', 'on', 'with', 'for'];
  const lowerText = text?.toLowerCase() || '';
  let frenchCount = 0;
  let englishCount = 0;
  frenchWords.forEach(word => { (lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || []).forEach(() => frenchCount++); });
  englishWords.forEach(word => { (lowerText.match(new RegExp(`\\b${word}\\b`, 'g')) || []).forEach(() => englishCount++); });
  return frenchCount > englishCount ? 'fr' : 'en';
}

// Nettoyage des noms de fichiers
function sanitizeFilename(name: string): string {
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

// Traitement d'un flux RSS
async function fetchAndProcessFeed(feed: any) {
  const { id: feedId, title, url } = feed;
  log.info(`Récupération du flux: ${title} (${url})`);
  try {
    const feedContent = await rssParser.parseURL(url);
    await pool.query('UPDATE rss.feeds SET last_fetched = NOW() WHERE id = $1', [feedId]);

    let newItemCount = 0;
    for (const item of feedContent.items as ExtendedItem[]) {
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

// Génération et sauvegarde d'un résumé
async function generateAndSaveSummary(item: {
  id: number;
  title: string;
  content?: string;
  description?: string;
}) {
  const { id: itemId, title, content, description } = item;
  log.info(`Génération d'un résumé pour l'élément ID: ${itemId}`);
  try {
    const contentToSummarize = content || description || '';
    if (!contentToSummarize && !title) {
      log.warn(`L'élément ${itemId} n'a pas de contenu à résumer.`);
      return;
    }

    const prompt = `Résumez l'article suivant en 3-5 paragraphes concis:\n\nTITRE: ${title}\n\nCONTENU:\n${contentToSummarize}`;
    const response = await ai.generate({ prompt });
    const summaryText = response.text;

    if (!summaryText) throw new Error('L\'IA a retourné un résumé vide.');

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

// Génération et sauvegarde d'un podcast
async function generateAndSavePodcast(summary: {
  id: number;
  item_id: number;
  summary_text: string;
  language: string;
  item_title?: string;
  feed_title?: string;
}) {
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

    const response = await axios({
      method: 'POST',
      url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      headers: { 'Accept': 'audio/mpeg', 'Content-Type': 'application/json', 'xi-api-key': ELEVENLABS_API_KEY },
      data: { text: textToSpeak, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } },
      responseType: 'stream',
    });

    const writer = fs.createWriteStream(absoluteFilePath);
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
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
  } catch (error: any) {
    log.error(`Erreur de génération de podcast pour le résumé ID ${summaryId}:`, error.response?.data || error.message || error);
  }
}

// Job d'envoi des résumés et podcasts sur Telegram
async function runTelegramJob() {
  log.info(`Démarrage du job d'envoi Telegram (Taille du lot: ${TELEGRAM_BATCH_SIZE})...`);
  
  try {
    // 1. Récupérer les résumés récents qui n'ont pas été envoyés sur Telegram
    const result = await pool.query(`
      SELECT s.id as summary_id, s.summary_text, s.language, s.created_at,
             i.id as item_id, i.title as item_title, i.link as item_link,
             f.title as feed_title,
             p.id as podcast_id, p.audio_file_path
      FROM rss.summaries s
      JOIN rss.items i ON s.item_id = i.id
      JOIN rss.feeds f ON i.feed_id = f.id
      LEFT JOIN rss.podcasts p ON s.id = p.summary_id
      WHERE NOT EXISTS (
        SELECT 1 FROM rss.telegram_sent t 
        WHERE t.summary_id = s.id AND t.type = 'summary'
      )
      ORDER BY s.created_at DESC
      LIMIT $1
    `, [TELEGRAM_BATCH_SIZE]);
    
    const summariesToSend = result.rows;
    log.info(`${summariesToSend.length} résumés à envoyer sur Telegram.`);
    
    // 2. Envoyer chaque résumé
    for (const summary of summariesToSend) {
      try {
        // Formatter le message
        const message = formatSummaryMessage(
          summary.item_title,
          summary.summary_text,
          summary.item_link,
          summary.feed_title
        );
        
        // Envoyer le message
        await sendMessageToTelegram(message);
        
        // Marquer comme envoyé dans la base de données
        await pool.query(
          `INSERT INTO rss.telegram_sent (summary_id, item_id, type) VALUES ($1, $2, $3)`,
          [summary.summary_id, summary.item_id, 'summary']
        );
        
        log.info(`Résumé envoyé sur Telegram pour l'article: ${summary.item_title}`); 
        
        // Attendre un peu entre chaque envoi pour éviter les limitations de l'API
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        log.error(`Erreur lors de l'envoi du résumé sur Telegram pour ${summary.item_title}:`, error);
      }
    }
    
    // 3. Récupérer les podcasts récents qui n'ont pas été envoyés sur Telegram
    const podcastResult = await pool.query(`
      SELECT p.id as podcast_id, p.audio_file_path, p.created_at,
             i.id as item_id, i.title as item_title, i.link as item_link,
             f.title as feed_title
      FROM rss.podcasts p
      JOIN rss.items i ON p.item_id = i.id
      JOIN rss.feeds f ON i.feed_id = f.id
      WHERE NOT EXISTS (
        SELECT 1 FROM rss.telegram_sent t 
        WHERE t.podcast_id = p.id AND t.type = 'podcast'
      )
      ORDER BY p.created_at DESC
      LIMIT $1
    `, [TELEGRAM_BATCH_SIZE]);
    
    const podcastsToSend = podcastResult.rows;
    log.info(`${podcastsToSend.length} podcasts à envoyer sur Telegram.`);
    
    // 4. Envoyer chaque podcast
    for (const podcast of podcastsToSend) {
      try {
        // Chemin du fichier audio
        const audioPath = path.join(process.cwd(), 'public', podcast.audio_file_path.replace(/^\//, ''));
        
        // Formatter la légende
        const caption = formatPodcastCaption(
          podcast.item_title,
          podcast.item_link,
          podcast.feed_title
        );
        
        // Envoyer le fichier audio
        await sendAudioToTelegram(audioPath, caption);
        
        // Marquer comme envoyé dans la base de données
        await pool.query(
          `INSERT INTO rss.telegram_sent (podcast_id, item_id, type) VALUES ($1, $2, $3)`,
          [podcast.podcast_id, podcast.item_id, 'podcast']
        );
        
        log.info(`Podcast envoyé sur Telegram pour l'article: ${podcast.item_title}`);
        
        // Attendre un peu entre chaque envoi pour éviter les limitations de l'API
        await new Promise(resolve => setTimeout(resolve, 2000)); // Délai plus long pour les fichiers audio
      } catch (error) {
        log.error(`Erreur lors de l'envoi du podcast sur Telegram pour ${podcast.item_title}:`, error);
      }
    }
  } catch (error) {
    log.error('Erreur lors du job Telegram:', error);
  }
  
  log.info('Job Telegram terminé.');
}

// Point d'entrée principal - gestion des arguments
async function main() {
  const args = process.argv.slice(2);
  const jobArg = args.find(arg => arg.startsWith('--job='));
  const job = jobArg ? jobArg.split('=')[1] : '';

  if (!job) {
    console.log('Usage: ts-node manual-runner.ts --job=[rss-fetch|ai-summary|podcast|telegram]');
    return;
  }

  switch (job) {
    case 'rss-fetch':
      await runRssFetcherJob();
      break;
    case 'ai-summary':
      await runAiSummaryJob();
      break;
    case 'podcast':
      await runPodcastGeneratorJob();
      break;
    case 'telegram':
      await runTelegramJob();
      break;
    default:
      console.log(`Job inconnu: ${job}`);
      console.log('Jobs disponibles: rss-fetch, ai-summary, podcast, telegram');
  }

  // Fermer la connexion pool après l'exécution
  pool.end();
}

// Exécution du script
main().catch(error => {
  console.error('Erreur dans le script:', error);
  process.exit(1);
}); 