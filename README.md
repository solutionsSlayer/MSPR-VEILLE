# MSPR Veille - RSS Feed Aggregator with AI Summaries and Podcasts

This project is a technological watch (veille) application that aggregates RSS feeds, processes them with AI to create summaries, and generates podcasts using ElevenLabs.

## Features

- RSS feed aggregation and storage
- AI-powered article summarization
- Podcast generation with ElevenLabs
- Web interface for browsing and managing feeds

## Tech Stack

- NextJS for the frontend and API
- PostgreSQL for data storage
- Docker for containerization
- TypeScript for type safety
- AI services for summaries
- ElevenLabs for podcast generation

## Setup & Development

### Prerequisites

- Docker and Docker Compose
- Node.js 20 or later
- npm or yarn

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

3. Start the PostgreSQL database with Docker
```bash
# From the project root
docker-compose up -d postgres
```

4. Run the development server
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

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

# Start all services (when ready)
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
- `/src/ai`: AI integration
- `/docker`: Docker configuration files

## Contributing

1. Create a feature branch
2. Make your changes
3. Submit a pull request

## License

[License information here]
