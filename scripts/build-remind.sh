#!/usr/bin/env bash
# Builds the reminder helper (tools/remind.swift) and puts it into the installed app's
# Contents/MacOS, where macOS treats it as the app itself; then signs the app again, since
# a new file inside the bundle breaks its signature. Run again after every install.
set -euo pipefail
cd "$(dirname "$0")/.."
APP="${1:-/Applications/Inkwell.app}"

mkdir -p src/bin
swiftc -O tools/remind.swift -o src/bin/remind
cp src/bin/remind "$APP/Contents/MacOS/Reminder"
# the helper carries the app's own identifier, or usernotificationsd sees a stranger ("remind")
codesign --force --sign - --identifier uz.javohir.articles365 "$APP/Contents/MacOS/Reminder"
codesign --force --sign - --identifier uz.javohir.articles365 "$APP"
echo "reminder helper installed in $APP"
