# MSPR Veille - System Architecture

This document outlines the overall architecture of the MSPR Veille system, a technological watch platform that aggregates RSS feeds, generates AI summaries, and creates podcast versions of content.

## System Overview

The MSPR Veille system consists of several interconnected components that work together to provide a complete technological watch solution:

1. **Database**: PostgreSQL database for storing all system data
2. **RSS Fetcher**: Service that regularly fetches content from configured RSS feeds
3. **AI Summary Generator**: Service that uses Google's Gemini API to generate concise summaries
4. **Podcast Generator**: Service that uses ElevenLabs to convert summaries to audio podcasts
5. **Web Application**: NextJS-based frontend for users to interact with the system

## Data Flow

The system processes information through the following workflow:

```
RSS Feeds → RSS Fetcher → Database → AI Summary Generator → Database → Podcast Generator → File System → Web Application
```

1. RSS Fetcher retrieves content from configured feeds
2. Content is stored in the database
3. AI Summary Generator creates summaries for new content
4. Summaries are stored in the database
5. Podcast Generator creates audio versions of summaries
6. Audio files are stored in the file system
7. Web Application provides access to all content forms

## Component Details

### Database (PostgreSQL)

- **Schema**: `rss`
- **Tables**:
  - `feeds`: RSS feed sources
  - `items`: Individual articles from feeds
  - `summaries`: AI-generated summaries
  - `podcasts`: Podcast metadata linking to audio files

### RSS Fetcher Service

- **Technology**: Node.js, TypeScript
- **Key Libraries**: rss-parser, node-cron, pg
- **Function**: Periodically fetches configured RSS feeds and stores new content
- **Schedule**: Configurable via CRON expression (default: hourly)

### AI Summary Generator

- **Technology**: Node.js, TypeScript
- **Key Libraries**: Genkit with Google Gemini API
- **Function**: Generates concise summaries of articles using AI
- **Schedule**: Configurable via CRON expression (default: every 3 hours)
- **Batch Processing**: Processes a configurable number of items per run

### Podcast Generator

- **Technology**: Node.js, TypeScript
- **Key Libraries**: Axios, ElevenLabs API
- **Function**: Converts text summaries to audio using text-to-speech
- **Schedule**: Configurable via CRON expression (default: every 6 hours)
- **Batch Processing**: Processes a configurable number of summaries per run
- **Output**: MP3 files organized by feed source

### Web Application

- **Technology**: NextJS, React, TypeScript
- **UI Framework**: Tailwind CSS, shadcn/ui components
- **Key Features**:
  - Browse and search feeds and articles
  - Read AI-generated summaries
  - Listen to podcast versions
  - Manage feed subscriptions
  - Bookmark favorite content

## Deployment Architecture

The system is fully containerized using Docker, allowing for easy deployment and scaling:

```
┌─────────────────────────────────────────┐
│              Docker Network              │
│                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐   │
│  │ NextJS  │ │   RSS   │ │   AI    │   │
│  │   App   │ │ Fetcher │ │ Summary │   │
│  └─────────┘ └─────────┘ └─────────┘   │
│                                         │
│  ┌─────────┐ ┌─────────────────────┐   │
│  │ Podcast │ │                     │   │
│  │Generator│ │     PostgreSQL      │   │
│  └─────────┘ │                     │   │
│              └─────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

Each component runs in its own container, with shared volumes for persistent storage of the database and podcast files.

## Configuration

The system is configured via environment variables, with sensible defaults for rapid deployment. Key configuration parameters include:

- Database connection string
- API keys for Google Gemini and ElevenLabs
- CRON schedules for each service
- Batch sizes for processing
- Voice IDs for podcast generation

## Performance Considerations

1. **Database Indexing**: Indexes are created on frequently queried fields
2. **Batch Processing**: All background services use batch processing to avoid overwhelming external APIs
3. **CRON Scheduling**: Services run at different intervals to distribute load
4. **File System Organization**: Podcast files are organized by feed for efficient retrieval

## Security Considerations

1. **API Keys**: All API keys are stored as environment variables
2. **Database Access**: Services access the database with minimal required permissions
3. **Input Validation**: All inputs are validated before processing

## Monitoring and Logging

Each service includes comprehensive logging to help diagnose issues:

- Service startup and configuration
- Processing of feeds, summaries, and podcasts
- Errors and warnings
- API rate limit information
- Performance metrics

## Future Enhancements

Potential enhancements to the system include:

1. **User Authentication**: Adding user accounts for personalized content
2. **Recommendation Engine**: Suggesting content based on user preferences
3. **Additional Content Sources**: Beyond RSS (e.g., Twitter, newsletters)
4. **Enhanced Analytics**: Tracking reading habits and popular content
5. **Mobile Application**: Native mobile experience
