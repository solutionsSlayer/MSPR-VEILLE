/**
 * Telegram service for sending messages and audio files to a Telegram channel.
 * This service handles all Telegram communications for the application.
 */

import { logger } from '../lib/logger';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const log = logger.forService('telegram');

/**
 * Configuration for Telegram API
 */
interface TelegramConfig {
  botToken: string;
  chatId: string;
  maxMessageLength: number;
}

// Get configuration from environment variables
const getTelegramConfig = (): TelegramConfig | null => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    log.warn('Telegram Bot Token or Chat ID not configured');
    return null;
  }

  return {
    botToken,
    chatId,
    maxMessageLength: 4000, // Telegram limit is 4096, but we use slightly less for safety
  };
};

/**
 * Asynchronously sends a text message to a Telegram channel.
 * 
 * @param message The message to send
 * @returns A promise that resolves when the message is successfully sent or fails gracefully
 */
export async function sendMessageToTelegram(message: string): Promise<void> {
  const config = getTelegramConfig();
  
  if (!config) {
    log.warn('Telegram configuration not available. Skipping Telegram message.');
    return;
  }

  // Limit message length to avoid Telegram API errors
  let truncatedMessage = message;
  if (message.length > config.maxMessageLength) {
    log.warn(`Telegram message truncated from ${message.length} to ${config.maxMessageLength} characters.`);
    truncatedMessage = message.substring(0, config.maxMessageLength) + "... (truncated)";
  }

  const url = `https://api.telegram.org/bot${config.botToken}/sendMessage`;
  const payload = {
    chat_id: config.chatId,
    text: truncatedMessage,
    parse_mode: 'Markdown', // Use 'HTML' or omit for plain text
    disable_web_page_preview: true, // Optional: Disable link previews
  };

  try {
    log.info(`Attempting to send message to Telegram Chat ID: ${config.chatId}`);
    log.info(`Message preview: ${truncatedMessage.substring(0, 50)}...`);
    
    const response = await axios.post(url, payload);

    if (!response.data.ok) {
      log.error(`Error sending message to Telegram: ${response.data.description || 'Unknown error'}`);
    } else {
      log.info('Message successfully sent to Telegram.');
    }
  } catch (error: any) {
    // Log full error details for debugging
    if (error.response) {
      // The request was made and the server responded with a status code outside the 2xx range
      log.error(`Telegram API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else if (error.request) {
      // The request was made but no response was received
      log.error('No response received from Telegram API');
    } else {
      // Something happened in setting up the request
      log.error(`Error setting up Telegram request: ${error.message}`);
    }
  }
}

/**
 * Asynchronously sends an audio file to a Telegram channel.
 * 
 * @param audioFilePath Path to the audio file (relative to project root or absolute)
 * @param caption Optional caption to include with the audio
 * @returns A promise that resolves when the audio is successfully sent or fails gracefully
 */
export async function sendAudioToTelegram(audioFilePath: string, caption: string = ''): Promise<void> {
  const config = getTelegramConfig();
  
  if (!config) {
    log.warn('Telegram configuration not available. Skipping Telegram audio.');
    return;
  }

  // Ensure path is absolute
  const absolutePath = path.isAbsolute(audioFilePath) 
    ? audioFilePath 
    : path.join(process.cwd(), audioFilePath);

  // Check if file exists
  if (!fs.existsSync(absolutePath)) {
    log.error(`Audio file not found at path: ${absolutePath}`);
    return;
  }

  try {
    // Limit caption length for Telegram
    let truncatedCaption = caption;
    if (caption.length > config.maxMessageLength) {
      truncatedCaption = caption.substring(0, config.maxMessageLength) + "... (truncated)";
    }

    // For debugging
    log.info(`Sending audio file from: ${absolutePath} to chat ID: ${config.chatId}`);

    const url = `https://api.telegram.org/bot${config.botToken}/sendAudio`;
    const formData = new FormData();
    formData.append('chat_id', config.chatId);
    
    // Using raw form data instead of fs stream which might be causing issues
    const audioData = fs.readFileSync(absolutePath);
    formData.append('audio', new Blob([audioData]), path.basename(audioFilePath));
    
    if (truncatedCaption) {
      formData.append('caption', truncatedCaption);
      formData.append('parse_mode', 'Markdown');
    }
    
    log.info(`Attempting to send audio to Telegram Chat ID: ${config.chatId}`);
    
    const response = await axios.post(url, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    if (!response.data.ok) {
      log.error(`Error sending audio to Telegram: ${response.data.description || 'Unknown error'}`);
    } else {
      log.info('Audio successfully sent to Telegram.');
    }
  } catch (error) {
    log.error('Error sending audio to Telegram:', error);
  }
}

/**
 * Creates a formatted message for a summary with article metadata
 * 
 * @param title Article title
 * @param summaryText The summary text
 * @param sourceUrl Original article URL
 * @param feedTitle Name of the feed source
 * @returns Formatted message string
 */
export function formatSummaryMessage(
  title: string, 
  summaryText: string, 
  sourceUrl: string, 
  feedTitle: string
): string {
  return `📰 *${title}*\n\n${summaryText}\n\n🔍 _Source: ${feedTitle}_\n🔗 [Read original article](${sourceUrl})`;
}

/**
 * Creates a formatted message for a podcast with article metadata
 * 
 * @param title Article title
 * @param sourceUrl Original article URL
 * @param feedTitle Name of the feed source
 * @returns Formatted message string
 */
export function formatPodcastCaption(
  title: string,
  sourceUrl: string,
  feedTitle: string
): string {
  return `🎙️ *${title}*\n\n🔍 _Source: ${feedTitle}_\n🔗 [Read original article](${sourceUrl})`;
}
