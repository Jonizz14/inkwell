#!/usr/bin/env bash
# Builds the widget extension (tools/widget.swift) without Xcode and puts it into the
# installed app's Contents/PlugIns, then signs the app again and registers the extension.
# Then: right-click the desktop → Edit Widgets → search "365".
set -euo pipefail
cd "$(dirname "$0")/.."
APP="${1:-/Applications/365 Articles.app}"
ID=uz.javohir.articles365.widget
OUT=src/bin/ReaderWidget.appex

rm -rf "$OUT"
mkdir -p "$OUT/Contents/MacOS"
swiftc -O -parse-as-library -module-name ReaderWidget \
  -target arm64-apple-macos14.0 -application-extension -Xlinker -application_extension -Xlinker -e -Xlinker _NSExtensionMain \
  \
  tools/widget.swift -o "$OUT/Contents/MacOS/ReaderWidget"

cat > "$OUT/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key><string>$ID</string>
  <key>CFBundleName</key><string>ReaderWidget</string>
  <key>CFBundleDisplayName</key><string>365 Articles</string>
  <key>CFBundleExecutable</key><string>ReaderWidget</string>
  <key>CFBundlePackageType</key><string>XPC!</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleSupportedPlatforms</key><array><string>MacOSX</string></array>
  <key>DTPlatformName</key><string>macosx</string>
  <key>DTSDKName</key><string>macosx$(xcrun --show-sdk-version)</string>
  <key>DTPlatformVersion</key><string>$(xcrun --show-sdk-version)</string>
  <key>DTSDKBuild</key><string>$(xcrun --show-sdk-build-version)</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>$(date +%s)</string>
  <key>LSMinimumSystemVersion</key><string>14.0</string>
  <key>NSExtension</key>
  <dict><key>NSExtensionPointIdentifier</key><string>com.apple.widgetkit-extension</string></dict>
</dict>
</plist>
EOF

ENT=$(mktemp)
cat > "$ENT" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>com.apple.security.app-sandbox</key><true/></dict></plist>
EOF
codesign --force --sign - --identifier "$ID" --entitlements "$ENT" "$OUT"

mkdir -p "$APP/Contents/PlugIns"
rm -rf "$APP/Contents/PlugIns/ReaderWidget.appex"
cp -R "$OUT" "$APP/Contents/PlugIns/"
# the redraw is asked for from the app's own process (notify.js), through a Node addon
TMP=$(mktemp -d)
swiftc -O -parse-as-library -target arm64-apple-macos14.0 -emit-object tools/widgetkit.swift -o "$TMP/wk-swift.o"
clang -O2 -target arm64-apple-macos14.0 -DNODE_GYP_MODULE_NAME=widgetkit -I"$(dirname "$(dirname "$(command -v node)")")/include/node" -c tools/widgetkit.c -o "$TMP/wk-c.o"
swiftc -target arm64-apple-macos14.0 -emit-library "$TMP/wk-swift.o" "$TMP/wk-c.o" -o src/bin/widgetkit.node -framework WidgetKit -Xlinker -undefined -Xlinker dynamic_lookup
rm -rf "$TMP"
mkdir -p "$APP/Contents/Resources/app/src/bin"
cp src/bin/widgetkit.node "$APP/Contents/Resources/app/src/bin/"

# the widgets open the app through articles365:// (main.js, open-url)
PL="$APP/Contents/Info.plist"
if ! /usr/libexec/PlistBuddy -c "Print :CFBundleURLTypes" "$PL" >/dev/null 2>&1; then
  /usr/libexec/PlistBuddy -c "Add :CFBundleURLTypes array" \
    -c "Add :CFBundleURLTypes:0 dict" \
    -c "Add :CFBundleURLTypes:0:CFBundleURLName string uz.javohir.articles365" \
    -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes array" \
    -c "Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string articles365" "$PL"
fi
# sign the app around it without touching the extension's own signature (it carries the sandbox)
codesign --force --sign - --identifier uz.javohir.articles365 "$APP"
pluginkit -a "$APP/Contents/PlugIns/ReaderWidget.appex" || true
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP" || true
mkdir -p "$HOME/Library/Containers/$ID/Data"
echo "widget installed in $APP"
