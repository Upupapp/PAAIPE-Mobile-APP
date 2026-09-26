#!/usr/bin/env sh
# Boot the Firestore emulator and run the offline-queue integration test against
# it. Installs firebase-tools locally on first run (gitignored).
set -e
cd "$(dirname "$0")"

export PATH="$HOME/.bun/bin:$PATH"

if [ ! -x node_modules/.bin/firebase ]; then
  echo "installing firebase-tools locally…"
  npm install --no-audit --no-fund
fi

# Run the bun script inside the emulator's lifecycle so the emulator is up for
# the duration and torn down afterwards.
node_modules/.bin/firebase emulators:exec \
  --only firestore \
  --project postflowit-autos \
  "bun flush.integration.mjs"
