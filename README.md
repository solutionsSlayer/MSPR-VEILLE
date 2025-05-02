# MSPR Veille - RSS Feed Aggregator with AI Summaries and Podcasts

This project is a technological watch (veille) application that aggregates RSS feeds, processes them with Google's Gemini AI to create summaries, and generates podcasts using ElevenLabs.

## Features

- RSS feed aggregation and storage
- AI-powered article summarization with Google Gemini
- Podcast generation with ElevenLabs
- Web interface for browsing and managing feeds

## Tech Stack

- NextJS for the frontend and API
- PostgreSQL for data storage
- Docker for containerization
- TypeScript for type safety
- Google Gemini AI for summaries
- ElevenLabs for podcast generation

## System Architecture

The system consists of several components:

1. **PostgreSQL Database**: Stores all feeds, articles, summaries, and podcast metadata
2. **RSS Fetcher Service**: CRON job that fetches RSS feeds and stores articles
3. **AI Summary Service**: CRON job that generates summaries using Google Gemini
4. **Podcast Generator Service**: CRON job that creates audio content using ElevenLabs
5. **NextJS Web Application**: Frontend for users to access content

For a detailed architecture overview, see [System Architecture](./docs/system-architecture.md).

## Setup & Development

### Prerequisites

- Docker and Docker Compose
- Node.js 20 or later
- npm or yarn
- API keys for Google Gemini and ElevenLabs

### Installation

1. Clone the repository
```bash
git clone [repository-url]
cd MSPR-VEILLE
```

2. Install dependencies
```bash
npm install
```

3. Create a `.env` file based on `.env.example` in the `src` directory:
```bash
cp src/.env.example src/.env
```

4. Update the `.env` file with your API keys:
```
GOOGLE_GENAI_API_KEY=your-gemini-api-key
ELEVENLABS_API_KEY=your-elevenlabs-api-key
```

5. Start the PostgreSQL database with Docker
```bash
docker-compose up -d postgres
```

6. Run the development server
```bash
npm run dev
```

7. Open [http://localhost:9002](http://localhost:9002) in your browser

### Starting Services Individually

You can run each service independently during development:

```bash
# RSS Fetcher
npm run start:rss-fetcher

# AI Summary Generator
npm run start:ai-summary

# Podcast Generator
npm run start:podcast-generator
```

### Deploying with Docker

To deploy the complete system with Docker:

```bash
# Create a .env file in the root directory
cp src/.env.example .env

# Start all services
docker-compose up -d
```

## ElevenLabs Integration

This project uses ElevenLabs for Text-to-Speech conversion to create podcasts from article summaries. For details on how the integration works, see [ElevenLabs Integration](./docs/elevenlabs-integration.md).

To configure ElevenLabs:

1. Create an account at [ElevenLabs](https://elevenlabs.io/)
2. Get your API key from the Profile settings
3. Select voices from their voice library or create custom voices
4. Set the API key and voice IDs in your `.env` file

## Docker Configuration

The project uses Docker for containerization:

### Database Setup

- PostgreSQL 16 is used for data storage
- Configuration is in `docker-compose.yml`
- Database initialization scripts are in `docker/init/`

### Starting Services

```bash
# Start just the database
docker-compose up -d postgres

# Start all services
docker-compose up -d
```

### Database Connection

- Host: localhost (or postgres in Docker network)
- Port: 5432
- Database: veille_db
- Username: veille_user
- Password: veille_password

Connection string: `postgresql://veille_user:veille_password@localhost:5432/veille_db`

## Project Structure

- `/src/app`: NextJS application routes
- `/src/components`: React components
- `/src/lib`: Utility functions
- `/src/services`: Backend services
  - `/src/services/rss-fetcher`: Service for fetching RSS feeds
  - `/src/services/ai-summary`: Service for generating AI summaries
  - `/src/services/podcast-generator`: Service for creating podcasts
- `/src/ai`: AI integration with Gemini
- `/docker`: Docker configuration files
- `/docs`: Project documentation

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

[License information here]
