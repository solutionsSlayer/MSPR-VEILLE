#!/bin/bash

# Start the PostgreSQL database container
echo "Starting PostgreSQL container..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Check if the container is running
if docker ps | grep veille-postgres > /dev/null; then
    echo "PostgreSQL is running!"
    echo "Connection details:"
    echo "  Host: localhost"
    echo "  Port: 5432"
    echo "  Database: veille_db"
    echo "  Username: veille_user"
    echo "  Password: veille_password"
    echo ""
    echo "Connection string: postgresql://veille_user:veille_password@localhost:5432/veille_db"
else
    echo "Error: PostgreSQL container failed to start!"
fi
