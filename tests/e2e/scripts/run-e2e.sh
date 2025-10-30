#!/bin/bash

set -e

COMMAND=${1:-all}
SCRIPT_DIR="$(dirname "$0")"

echo "═══════════════════════════════════════════════════"
echo "  FJSF E2E Test Suite"
echo "  Testing: $COMMAND"
echo "═══════════════════════════════════════════════════"
echo ""

bash "$SCRIPT_DIR/docker-setup.sh" "$COMMAND"
echo ""

bash "$SCRIPT_DIR/docker-test.sh" "$COMMAND"
TEST_EXIT_CODE=$?
echo ""

bash "$SCRIPT_DIR/docker-cleanup.sh" "$COMMAND"
echo ""

echo "═══════════════════════════════════════════════════"
if [ $TEST_EXIT_CODE -eq 0 ]; then
  echo "  E2E Tests PASSED"
else
  echo "  E2E Tests FAILED"
fi
echo "═══════════════════════════════════════════════════"

exit $TEST_EXIT_CODE
