#!/usr/bin/env bash
###############################################################################
# EcoWoods Platform - Quick Start Script
# Usage: ./scripts/start.sh
###############################################################################

set -e

echo "============================================"
echo "  EcoWoods Platform - Starting Up"
echo "============================================"
echo ""

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed. Please install Docker first."
    echo "  https://docs.docker.com/get-docker/"
    exit 1
fi

# Check for Docker Compose
if ! docker compose version &> /dev/null; then
    echo "ERROR: Docker Compose is not available."
    echo "  Please install Docker Compose or update Docker."
    exit 1
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "  .env created. Edit it to customize settings."
    echo ""
fi

# Build and start
echo "Building and starting services..."
echo ""
docker compose up --build -d

echo ""
echo "============================================"
echo "  EcoWoods Platform is running!"
echo "============================================"
echo ""
echo "  API:             http://localhost:8000"
echo "  API Docs:        http://localhost:8000/docs"
echo "  Admin Dashboard: http://localhost:8000/admin/"
echo "  Database:        localhost:5432"
echo ""
echo "  Default admin credentials:"
echo "    Username: admin"
echo "    Password: admin123"
echo ""
echo "  To stop:  docker compose down"
echo "  To logs:  docker compose logs -f"
echo "============================================"
