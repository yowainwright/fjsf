#!/bin/bash

set -e

COMMAND=${1:-all}
COMPOSE_FILE="tests/e2e/compose.yml"

echo "Running E2E tests in Docker..."
echo "   Command: $COMMAND"

cd "$(dirname "$0")/../../.."

echo "Starting test containers..."
docker compose -f "$COMPOSE_FILE" --profile "$COMMAND" up --abort-on-container-exit --exit-code-from "test-$COMMAND"

EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
  echo "All tests passed!"
else
  echo "Tests failed with exit code: $EXIT_CODE"
fi

exit $EXIT_CODE
