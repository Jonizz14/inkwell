#!/usr/bin/env bash
# Builds "Inkwell.app" on this Mac, installs it into /Applications and
# puts a shortcut on the Desktop. Run from the project folder:  npm run install:mac
set -euo pipefail
cd "$(dirname "$0")/.."

npm ci
# Apple Vision OCR helper used for scanned pages (needs Xcode command line tools)
mkdir -p src/bin
swiftc -O tools/vision-ocr.swift -o src/bin/vision-ocr
./scripts/build-haptic.sh
# read-along: follows your voice with macOS speech recognition
swiftc -O tools/read-along.swift -o src/bin/read-along
npx electron-builder --mac dir --publish never

APP=$(ls -d dist/mac*/"Inkwell.app" | head -1)
rm -rf "/Applications/Inkwell.app"
cp -R "$APP" /Applications/
# locally built apps are not quarantined, but clear the flag just in case
xattr -cr "/Applications/Inkwell.app" 2>/dev/null || true
# reminder banners and the desktop widgets (optional: the app works without them)
./scripts/build-remind.sh || echo "(reminder helper skipped)"
./scripts/build-widget.sh || echo "(widgets skipped)"

# Desktop shortcut (Finder alias)
osascript -e 'tell application "Finder" to make alias file to POSIX file "/Applications/Inkwell.app" at POSIX file (POSIX path of (path to desktop folder))' >/dev/null 2>&1 \
  || ln -sfn "/Applications/Inkwell.app" "$HOME/Desktop/Inkwell"

mkdir -p "$HOME/Documents/Inkwell"
echo
echo "Done: /Applications/Inkwell.app (shortcut on the Desktop)."
echo "Drop PDFs into: $HOME/Documents/Inkwell"
open "/Applications/Inkwell.app"
