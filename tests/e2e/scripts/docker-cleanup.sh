#!/bin/bash

set -e

COMMAND=${1:-all}
COMPOSE_FILE="tests/e2e/compose.yml"

echo "Cleaning up Docker environment..."
echo "   Command: $COMMAND"

cd "$(dirname "$0")/../../.."

echo "Stopping containers..."
docker compose -f "$COMPOSE_FILE" --profile "$COMMAND" down

echo "Cleanup complete!"
