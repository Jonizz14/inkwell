#!/bin/bash
# Builds the Dynamic Notch (tools/notch, a small Swift app called Islet) into src/bin/Islet.app,
# so it ships inside Inkwell, in full and small updates alike. macOS only; needs Swift 5.9+.
set -e
cd "$(dirname "$0")/../tools/notch"
swift build -c release --arch arm64
APP=../../src/bin/Islet.app
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp .build/arm64-apple-macosx/release/Islet "$APP/Contents/MacOS/Islet"
cp Resources/Info.plist "$APP/Contents/Info.plist"
cp Resources/Islet.icns "$APP/Contents/Resources/Islet.icns"
clang -O2 -dynamiclib -fobjc-arc -framework Foundation -framework AppKit \
  Helper/MediaRemoteBridge.m -o "$APP/Contents/Resources/MediaRemoteBridge.dylib"
codesign --force --deep --sign - --identifier com.jakhongir.islet "$APP"
echo "built $APP"
