/**
 * Job d'envoi Telegram spécifique - Version simplifiée
 * Envoie les résumés et podcasts récents à un canal Telegram
 */

import { Pool } from 'pg';
import path from 'path';
import { logger } from '../lib/logger';
import dotenv from 'dotenv';
import { sendMessageToTelegram, sendAudioToTelegram, formatSummaryMessage, formatPodcastCaption } from './telegram';

// Chargement des variables d'environnement
dotenv.config();

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const TELEGRAM_BATCH_SIZE = parseInt(process.env.TELEGRAM_BATCH_SIZE || '5', 10);

// Initialisation du logger
const log = logger.forService('telegram-job');

// Initialisation de la connexion à la base de données
const pool = new Pool({ connectionString: DATABASE_URL });

// Fonction principale du job Telegram
async function runTelegramJob() {
  log.info(`Démarrage du job d'envoi Telegram (Taille du lot: ${TELEGRAM_BATCH_SIZE})...`);
  
  try {
    // 1. Récupérer les résumés récents
    const result = await pool.query(`
      SELECT s.id as summary_id, s.summary_text, s.language, s.created_at,
             i.id as item_id, i.title as item_title, i.link as item_link,
             f.title as feed_title,
             p.id as podcast_id, p.audio_file_path
      FROM rss.summaries s
      JOIN rss.items i ON s.item_id = i.id
      JOIN rss.feeds f ON i.feed_id = f.id
      LEFT JOIN rss.podcasts p ON s.id = p.summary_id
      ORDER BY s.created_at DESC
      LIMIT $1
    `, [TELEGRAM_BATCH_SIZE]);
    
    const summariesToSend = result.rows;
    log.info(`${summariesToSend.length} résumés/podcasts à envoyer sur Telegram.`);
    
    // 2. Envoyer chaque résumé et podcast associé
    for (const item of summariesToSend) {
      // Envoyer le résumé
      if (item.summary_text) {
        try {
          const message = formatSummaryMessage(
            item.item_title,
            item.summary_text,
            item.item_link,
            item.feed_title
          );
          
          await sendMessageToTelegram(message);
          log.info(`Résumé envoyé sur Telegram pour l'article: ${item.item_title}`);
          
          // Pause pour éviter les limites de l'API
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          log.error(`Erreur lors de l'envoi du résumé sur Telegram pour ${item.item_title}:`, error);
        }
      }
      
      // Envoyer le podcast s'il existe
      if (item.podcast_id && item.audio_file_path) {
        try {
          // Normaliser le chemin en supprimant le slash initial s'il existe
          const cleanPath = item.audio_file_path.startsWith('/') 
            ? item.audio_file_path.substring(1) 
            : item.audio_file_path;
            
          const audioPath = path.join(process.cwd(), 'public', cleanPath);
          
          const caption = formatPodcastCaption(
            item.item_title,
            item.item_link,
            item.feed_title
          );
          
          await sendAudioToTelegram(audioPath, caption);
          log.info(`Podcast envoyé sur Telegram pour l'article: ${item.item_title}`);
          
          // Pause plus longue pour les fichiers audio
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          log.error(`Erreur lors de l'envoi du podcast sur Telegram pour ${item.item_title}:`, error);
        }
      }
    }
  } catch (error) {
    log.error('Erreur lors du job Telegram:', error);
  }
  
  log.info('Job Telegram terminé.');
}

// Point d'entrée principal du script
async function main() {
  try {
    await runTelegramJob();
  } catch (error) {
    console.error('Erreur dans le script:', error);
    process.exit(1);
  } finally {
    // Fermer la connexion pool après l'exécution
    pool.end();
  }
}

// Exécution du script
main();
