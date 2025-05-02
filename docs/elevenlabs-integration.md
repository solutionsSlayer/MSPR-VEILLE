# ElevenLabs Text-to-Speech Integration

This document describes how the MSPR Veille project integrates with the ElevenLabs Text-to-Speech API to generate podcast versions of article summaries.

## Overview

ElevenLabs offers a state-of-the-art Text-to-Speech (TTS) API that produces lifelike speech with nuanced intonation, pacing, and emotional awareness. In our project, we use ElevenLabs to convert article summaries into podcast format, making content more accessible and engaging.

## Key Features of ElevenLabs Integration

- **Multilingual Support**: Generate speech in multiple languages (primarily English and French)
- **Voice Selection**: Use different voices for different languages or content types
- **High-Quality Audio**: Create professional-sounding podcasts with natural-sounding voices
- **Audio File Management**: Store and serve podcast files to users

## Implementation

### 1. API Integration

Our integration with ElevenLabs uses their REST API. The main endpoint we use is:

```
POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
```

The integration code is primarily in `/src/services/podcast-generator/index.ts`.

### 2. Voice Selection

We maintain a mapping of voice IDs for different languages:

```typescript
const VOICE_IDS = {
  en: process.env.ELEVENLABS_EN_VOICE_ID || 'pNInz6obpgDQGcFmaJgB',
  fr: process.env.ELEVENLABS_FR_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL'
};
```

To select your own voices:

1. Create an account on [ElevenLabs](https://elevenlabs.io/)
2. Go to the Voice Library section
3. Choose or create a voice
4. Copy the voice ID and set it in your `.env` file

### 3. API Call Format

The podcast generation service calls the ElevenLabs API with the following format:

```typescript
const response = await axios({
  method: 'POST',
  url: `${ELEVENLABS_API_URL}/${voiceId}`,
  headers: {
    'Accept': 'audio/mpeg',
    'Content-Type': 'application/json',
    'xi-api-key': ELEVENLABS_API_KEY
  },
  data: {
    text,
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.5,
      similarity_boost: 0.75
    }
  },
  responseType: 'stream'
});
```

### 4. Audio File Storage

Generated audio files are stored in the `/public/podcasts` directory, organized by feed title. The file paths are recorded in the database for easy retrieval and serving.

## Configuration

Configure the ElevenLabs integration by setting the following environment variables:

- `ELEVENLABS_API_KEY`: Your API key from ElevenLabs
- `ELEVENLABS_EN_VOICE_ID`: Voice ID for English content
- `ELEVENLABS_FR_VOICE_ID`: Voice ID for French content
- `PODCAST_GEN_CRON`: CRON schedule for podcast generation (default: "0 */6 * * *")
- `PODCAST_GEN_BATCH_SIZE`: Number of podcasts to generate in one batch (default: 5)
- `PODCASTS_DIR`: Directory for storing podcast files (default: ./public/podcasts)

## Usage Considerations

1. **API Limits**: Be aware of your ElevenLabs account limits when configuring batch sizes and CRON schedules
2. **Audio Quality**: The ElevenLabs API offers different models with varying quality levels
3. **Voice Selection**: Choose appropriate voices for your content and audience
4. **Storage Management**: Implement a retention policy for podcast files if needed

## Example Response

The ElevenLabs API returns an audio stream which we save as an MP3 file. The database records the following information about each podcast:

- `item_id`: The associated RSS item
- `summary_id`: The summary text used to generate the podcast
- `audio_file_path`: Path to the generated MP3 file
- `duration`: Estimated duration in seconds
- `voice_id`: The ElevenLabs voice ID used

## Error Handling

The podcast generator service includes error handling for:

- API authentication issues
- Rate limiting
- Network failures
- File system errors

Errors are logged and the service will retry failed items in the next scheduled run.

## Voice Testing

To test different voices, you can use the [ElevenLabs Voice Library](https://elevenlabs.io/voice-library) to hear samples before choosing the voices for your application.
