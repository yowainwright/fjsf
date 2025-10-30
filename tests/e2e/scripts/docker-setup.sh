#!/bin/bash

set -e

COMMAND=${1:-all}
COMPOSE_FILE="tests/e2e/compose.yml"

echo "Setting up Docker environment for E2E tests..."
echo "   Command: $COMMAND"

cd "$(dirname "$0")/../../.."

echo "Building Docker images..."
docker compose -f "$COMPOSE_FILE" --profile "$COMMAND" build

echo "Docker setup complete!"
