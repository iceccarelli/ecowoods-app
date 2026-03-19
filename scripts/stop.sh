#!/usr/bin/env bash
###############################################################################
# EcoWoods Platform - Stop Script
###############################################################################

set -e

echo "Stopping EcoWoods Platform..."
docker compose down
echo "All services stopped."
