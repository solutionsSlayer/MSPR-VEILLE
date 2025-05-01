# Docker Configuration for RSS Veille Project

This directory contains the Docker configuration for the PostgreSQL database used in the RSS Veille project.

## Overview

The setup includes:
- PostgreSQL 16 database server
- Initialization scripts for database schema and sample data
- Persistent volume for database data

## Database Structure

The database is initialized with the following schema:

- `rss.feeds`: Table for storing RSS feed sources
- `rss.items`: Table for storing individual RSS items/articles
- `rss.summaries`: Table for storing AI-generated summaries of articles
- `rss.podcasts`: Table for storing podcast versions generated with ElevenLabs

## How to Use

### Starting the Database

From this directory, run:

```bash
docker-compose up -d
```

This will start the PostgreSQL container in detached mode.

### Connecting to the Database

You can connect to the database using the following credentials:

- Host: localhost
- Port: 5432
- Database: veille_db
- Username: veille_user
- Password: veille_password

Example connection string for your application:
```
postgresql://veille_user:veille_password@localhost:5432/veille_db
```

### Stopping the Database

```bash
docker-compose down
```

To remove the volume as well (this will delete all data):

```bash
docker-compose down -v
```

## Database Maintenance

### Viewing Logs

```bash
docker logs veille-postgres
```

### Accessing the PostgreSQL CLI

```bash
docker exec -it veille-postgres psql -U veille_user -d veille_db
```

### Backing Up Data

```bash
docker exec -t veille-postgres pg_dump -U veille_user veille_db > backup.sql
```

### Restoring Data

```bash
cat backup.sql | docker exec -i veille-postgres psql -U veille_user -d veille_db
```
