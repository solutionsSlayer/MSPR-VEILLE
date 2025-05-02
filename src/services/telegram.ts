/**
 * Asynchronously sends a message to a Telegram channel.
 * NOTE: This function needs to run in a backend environment where
 * environment variables (Bot Token, Chat ID) are securely accessible.
 * It's called from the summarizeQuantumNews flow which runs server-side.
 *
 * @param message The message to send.
 * @returns A promise that resolves when the message is successfully sent or fails gracefully.
 */
export async function sendMessageToTelegram(message: string): Promise<void> {
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('Telegram Bot Token or Chat ID not configured. Skipping Telegram message.');
    // Don't throw an error, just log and return, as Telegram might be optional.
    return;
  }

  // Limit message length to avoid Telegram API errors (4096 chars max)
  const MAX_LENGTH = 4000; // Slightly less than max for safety
  let truncatedMessage = message;
  if (message.length > MAX_LENGTH) {
      console.warn(`Telegram message truncated from ${message.length} to ${MAX_LENGTH} characters.`);
      truncatedMessage = message.substring(0, MAX_LENGTH) + "... (truncated)";
  }


  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  const payload = {
    chat_id: CHAT_ID,
    text: truncatedMessage,
    parse_mode: 'Markdown', // Use 'HTML' or omit for plain text. Ensure message content matches parse_mode.
     disable_web_page_preview: true, // Optional: Disable link previews
  };

  try {
      console.log(`Attempting to send message to Telegram Chat ID: ${CHAT_ID}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok || !result.ok) {
      // Log specific Telegram error if available
      console.error(`Error sending message to Telegram (${response.status}):`, result.description || 'Unknown Telegram API error');
      // Don't throw an error, allow the flow to continue if Telegram fails
    } else {
      console.log('Message successfully sent to Telegram.');
    }

  } catch (error) {
    console.error('Network or other error sending message to Telegram:', error);
    // Don't throw, allow flow to continue
  }

  /*
  // Placeholder implementation:
  console.log('--- Sending Message to Telegram (Simulation) ---');
  console.log(`Chat ID: ${CHAT_ID}`);
  console.log(`Message length: ${truncatedMessage.length} characters`);
  console.log(`Preview: ${truncatedMessage.substring(0, 100)}${truncatedMessage.length > 100 ? '...' : ''}`);
  console.log('--- Telegram Send Simulation Complete ---');
  await new Promise(resolve => setTimeout(resolve, 200));
  */
}
