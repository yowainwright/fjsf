#!/bin/bash

npm uninstall -g fjsf 2>/dev/null || true
pnpm remove -g fjsf 2>/dev/null || true
bun remove -g fjsf 2>/dev/null || true

sudo rm -f /usr/local/bin/fjsf 2>/dev/null || true
sudo rm -f /usr/local/bin/fjsf-qjs 2>/dev/null || true

rm -rf ~/.fjsf

which fjsf 2>/dev/null && exit 1 || exit 0
