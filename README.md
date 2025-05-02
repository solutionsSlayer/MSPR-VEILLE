# QuantumWatch - RSS Feed Aggregator with AI Summaries and Podcasts

This project is a technological watch (veille) application focused on quantum cryptography. It aggregates RSS feeds, uses Google's Gemini AI for summarization, generates podcasts with ElevenLabs, and provides a web interface for authenticated users.

**Note:** Access to the application requires authentication. Default credentials are `user` / `password`.

## Features

- User Authentication
- RSS feed aggregation and storage from configured sources
- AI-powered article summarization using Google Gemini
- Podcast generation from summaries using ElevenLabs
- Web interface for browsing feeds, articles, summaries, and listening to podcasts
- Background CRON job for automated fetching, summarization, and podcast generation

## Tech Stack

- NextJS (App Router) for the frontend and API
- React Context for Authentication State Management
- PostgreSQL for data storage
- Docker & Docker Compose for containerization
- TypeScript for type safety
- Genkit with Google Gemini AI for summaries
- ElevenLabs API for podcast generation
- `node-cron` for scheduling background tasks
- `shadcn/ui` and Tailwind CSS for styling

## System Architecture

The system consists of several interconnected components orchestrated via Docker Compose:

1.  **PostgreSQL Database**: Stores feed sources, articles, AI summaries, and podcast metadata. Schema defined in `docker/init/01-schema.sql`.
2.  **NextJS Web Application (`app` service)**: Provides the user interface and API endpoints. Handles user authentication and serves content. Runs on port 3000.
3.  **CRON Service (`cron` service)**: Runs background tasks (`src/services/cron-jobs.ts`) on schedule:
    *   Fetches RSS feeds.
    *   Generates AI summaries for new articles.
    *   Generates podcasts from summaries using ElevenLabs.

For a conceptual overview, see [System Architecture](./docs/system-architecture.md) (may need updates based on recent changes).

## Setup & Development

### Prerequisites

- Docker and Docker Compose
- Node.js 20 or later
- pnpm (install via `npm install -g pnpm`)
- API keys for Google Gemini and ElevenLabs

### Installation

1.  Clone the repository:
    ```bash
    git clone [repository-url]
    cd MSPR-VEILLE # Or your project directory name
    ```

2.  Install dependencies:
    ```bash
    pnpm install
    ```

3.  Create a `.env` file in the project root based on `.env.example`:
    ```bash
    cp .env.example .env
    ```

4.  Update the `.env` file with your API keys and any other necessary configurations (like Telegram Bot Token/Chat ID if used):
    ```env
    DATABASE_URL=postgresql://veille_user:veille_password@localhost:5432/veille_db
    GOOGLE_GENAI_API_KEY=your-gemini-api-key
    ELEVENLABS_API_KEY=your-elevenlabs-api-key
    ELEVENLABS_EN_VOICE_ID=your_english_voice_id # Optional, defaults exist
    ELEVENLABS_FR_VOICE_ID=your_french_voice_id # Optional, defaults exist

    # Optional Telegram Integration
    # TELEGRAM_BOT_TOKEN=your_telegram_bot_token
    # TELEGRAM_CHAT_ID=your_telegram_chat_id

    # Optional CRON Overrides (defaults are in docker-compose.yml)
    # RSS_FETCH_CRON="*/30 * * * *" # Example: Every 30 mins
    # AI_SUMMARY_CRON="0 */2 * * *" # Example: Every 2 hours
    # PODCAST_GEN_CRON="0 */4 * * *" # Example: Every 4 hours
    # RUN_JOBS_ON_STARTUP=true # Example: Run jobs once when cron service starts
    ```
    *(Ensure `DATABASE_URL` points to `localhost` for local development without Docker for the DB).*

5.  **Option A: Run everything with Docker Compose (Recommended)**
    *   Build and start all services:
        ```bash
        docker-compose up --build -d
        ```
    *   The application will be available at [http://localhost:3000](http://localhost:3000).
    *   The CRON jobs will run in the background within the `veille-cron` container. Check logs: `docker logs veille-cron -f`

6.  **Option B: Run database in Docker, App locally**
    *   Start only the PostgreSQL database with Docker:
        ```bash
        docker-compose up -d postgres
        ```
        *Wait a few seconds for the database to initialize.*
    *   Run the Next.js development server locally:
        ```bash
        pnpm dev # App runs on http://localhost:9002 by default in dev
        ```
    *   **Run CRON jobs locally (in a separate terminal):**
        ```bash
        # Ensure .env file has correct DATABASE_URL (localhost:5432) and API keys
        pnpm cron:start
        ```

### Accessing the Application

-   Navigate to the application URL (e.g., `http://localhost:3000`).
-   You will be redirected to the login page (`/login`).
-   Use the default credentials:
    *   Username: `user`
    *   Password: `password`

## Key Components & Functionality

-   **Authentication**: Uses React Context (`src/context/AuthContext.tsx`) with mock credentials stored locally. Routes are protected, redirecting unauthenticated users to `/login`.
-   **Feed Display**: `/` (Home) route displays the list of RSS feeds using `src/components/rss/FeedList.tsx`.
-   **Article Display**:
    *   `/articles`: Shows all articles using `src/components/rss/ArticleList.tsx`.
    *   `/feeds/[id]`: Shows articles for a specific feed, also using `ArticleList`.
    *   `/articles/[id]`: Shows detailed view of a single article with tabs for content, summary, and podcast using `src/components/rss/ArticleDetail.tsx`.
-   **Summary & Podcast Generation**:
    *   Triggered automatically by the `cron` service based on `AI_SUMMARY_CRON` and `PODCAST_GEN_CRON` schedules.
    *   Can also be triggered manually from the `ArticleDetail` page if not already generated.
    *   Uses API routes (`/api/articles/[id]/summary`, `/api/articles/[id]/podcast`) which interact with Genkit/Gemini and ElevenLabs.
-   **Storage**:
    *   Metadata (feeds, items, summaries, podcast details) is stored in the PostgreSQL database.
    *   Generated podcast audio files (`.mp3`) are stored in the `public/podcasts` directory within the `app` and `cron` containers (mounted via the `podcast_data` Docker volume). These are served directly by Next.js.
-   **CRON Job**: The `cron` service runs the script `src/services/cron-jobs.ts`, orchestrating the background tasks for fetching and processing content.

## ElevenLabs Integration

ElevenLabs is used for Text-to-Speech via `/api/articles/[id]/podcast` and the CRON job.

-   Configure your API key in the `.env` file (`ELEVENLABS_API_KEY`).
-   Optionally, set specific voice IDs (`ELEVENLABS_EN_VOICE_ID`, `ELEVENLABS_FR_VOICE_ID`). Default voices are used if not set.
-   Generated audio is saved to the `public/podcasts` volume.

## Docker Configuration

-   `docker-compose.yml`: Defines the `postgres`, `app`, and `cron` services.
-   `Dockerfile`: Multi-stage build for the Next.js application, used by both `app` and `cron` services.
-   `docker/init`: Contains SQL scripts (`01-schema.sql`, `02-data.sql`) to initialize the database schema and add sample feeds on first startup.
-   Volumes:
    *   `postgres_data`: Persists PostgreSQL data.
    *   `podcast_data`: Persists generated podcast audio files and makes them accessible to the `app` service for serving.

### Database Connection Details (within Docker network)

-   Host: `postgres`
-   Port: `5432`
-   Database: `veille_db`
-   Username: `veille_user`
-   Password: `veille_password`
-   Connection string: `postgresql://veille_user:veille_password@postgres:5432/veille_db`

## Project Structure

-   `/src/app`: NextJS App Router pages and API routes.
-   `/src/components`: React components (UI elements, RSS specific components).
-   `/src/context`: React Context providers (e.g., `AuthContext`).
-   `/src/lib`: Utility functions, logger.
-   `/src/services`: Background service logic (`cron-jobs.ts`).
-   `/src/ai`: Genkit configuration and flows.
-   `/docker`: Docker configuration (`init` scripts).
-   `/docs`: Project documentation.
-   `/public/podcasts`: (Created at runtime) Stores generated podcast audio files.

## Contributing

1.  Create a feature branch.
2.  Make your changes.
3.  Ensure code quality (linting, type checking).
4.  Submit a pull request.

## License

[Specify License Here - e.g., MIT]
