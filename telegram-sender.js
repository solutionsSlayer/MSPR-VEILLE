/**
 * Script simple pour envoyer des résumés et podcasts sur Telegram
 * Ce script est conçu pour être exécuté directement en JavaScript sans compilation
 */

const path = require('path');
const axios = require('axios');
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

// Configuration
const DATABASE_URL = process.env.DATABASE_URL;
const TELEGRAM_BATCH_SIZE = parseInt(process.env.TELEGRAM_BATCH_SIZE || '5', 10);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '7650363552:AAEvYAOaDSZGCGcBVITlh3u_7pkYhtILj-U';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '5976401131';

// Initialisation de la connexion à la base de données
const pool = new Pool({ connectionString: DATABASE_URL });

// Logging function
function log(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const color = level === 'error' ? '\x1b[31m' : level === 'info' ? '\x1b[32m' : '\x1b[33m';
  console.log(`${color}${timestamp} ${level.toUpperCase()}: ${message}\x1b[0m`, ...args);
}

// Fonction pour formater un message de résumé
function formatSummaryMessage(title, summaryText, sourceUrl, feedTitle) {
  return `📰 *${title}*\n\n${summaryText}\n\n🔍 _Source: ${feedTitle}_\n🔗 [Read original article](${sourceUrl})`;
}

// Fonction pour formater la légende d'un podcast
function formatPodcastCaption(title, sourceUrl, feedTitle) {
  return `🎙️ *${title}*\n\n🔍 _Source: ${feedTitle}_\n🔗 [Read original article](${sourceUrl})`;
}

// Fonction pour envoyer un message texte à Telegram
async function sendMessageToTelegram(message) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log('warn', 'Telegram Bot Token or Chat ID not configured. Skipping Telegram message.');
    return;
  }

  // Limit message length to avoid Telegram API errors
  const MAX_LENGTH = 4000;
  let truncatedMessage = message;
  if (message.length > MAX_LENGTH) {
    log('warn', `Telegram message truncated from ${message.length} to ${MAX_LENGTH} characters.`);
    truncatedMessage = message.substring(0, MAX_LENGTH) + "... (truncated)";
  }

  try {
    log('info', `Attempting to send message to Telegram Chat ID: -1002481601464`);
    log('info', `Message preview: ${truncatedMessage.substring(0, 50)}...`);
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload = {
      chat_id: "-1002481601464",
      text: truncatedMessage,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    };

    const response = await axios.post(url, payload);

    if (!response.data.ok) {
      log('error', `Error sending message to Telegram: ${response.data.description || 'Unknown error'}`);
    } else {
      log('info', 'Message successfully sent to Telegram.');
    }
  } catch (error) {
    // Log full error details for debugging
    if (error.response) {
      log('error', `Telegram API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      log('error', 'No response received from Telegram API');
    } else {
      log('error', `Error setting up Telegram request: ${error.message}`);
    }
  }
}

// Fonction pour envoyer un fichier audio à Telegram
async function sendAudioToTelegram(audioFilePath, caption = '') {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    log('warn', 'Telegram configuration not available. Skipping Telegram audio.');
    return;
  }

  // Ensure file exists
  if (!fs.existsSync(audioFilePath)) {
    log('error', `Audio file not found at path: ${audioFilePath}`);
    return;
  }

  try {
    // Limit caption length
    const MAX_LENGTH = 1024;
    let truncatedCaption = caption;
    if (caption.length > MAX_LENGTH) {
      truncatedCaption = caption.substring(0, MAX_LENGTH) + "... (truncated)";
    }

    log('info', `Sending audio file from: ${audioFilePath} to chat ID: -1002481601464`);

    // Create form data with file
    const FormData = require('form-data');
    const form = new FormData();
    form.append('chat_id', "-1002481601464");
    form.append('audio', fs.createReadStream(audioFilePath));
    
    if (truncatedCaption) {
      form.append('caption', truncatedCaption);
      form.append('parse_mode', 'Markdown');
    }
    
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendAudio`;
    const response = await axios.post(url, form, {
      headers: {
        ...form.getHeaders(),
      },
    });

    if (!response.data.ok) {
      log('error', `Error sending audio to Telegram: ${response.data.description || 'Unknown error'}`);
    } else {
      log('info', 'Audio successfully sent to Telegram.');
    }
  } catch (error) {
    if (error.response) {
      log('error', `Telegram API error: ${error.response.status} - ${JSON.stringify(error.response.data || {})}`);
    } else if (error.request) {
      log('error', 'No response received from Telegram API');
    } else {
      log('error', `Error sending audio to Telegram: ${error.message}`);
    }
  }
}

// Fonction principale du job Telegram
async function runTelegramJob() {
  log('info', `Démarrage du job d'envoi Telegram (Taille du lot: ${TELEGRAM_BATCH_SIZE})...`);
  
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
    log('info', `${summariesToSend.length} résumés/podcasts à envoyer sur Telegram.`);
    
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
          log('info', `Résumé envoyé sur Telegram pour l'article: ${item.item_title}`);
          
          // Pause pour éviter les limites de l'API
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          log('error', `Erreur lors de l'envoi du résumé sur Telegram pour ${item.item_title}:`, error);
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
          log('info', `Podcast envoyé sur Telegram pour l'article: ${item.item_title}`);
          
          // Pause plus longue pour les fichiers audio
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          log('error', `Erreur lors de l'envoi du podcast sur Telegram pour ${item.item_title}:`, error);
        }
      }
    }
  } catch (error) {
    log('error', 'Erreur lors du job Telegram:', error);
  }
  
  log('info', 'Job Telegram terminé.');
}

// Exécution du script
console.log('🚀 Démarrage du job d\'envoi Telegram...');
runTelegramJob()
  .then(() => {
    console.log('✅ Job Telegram terminé avec succès!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erreur lors de l\'exécution du job Telegram:', error);
    process.exit(1);
  })
  .finally(() => {
    pool.end();
  });
