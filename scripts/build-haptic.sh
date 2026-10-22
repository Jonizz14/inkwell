#!/usr/bin/env bash
# Builds src/bin/haptic.node (trackpad taps, tools/haptic.swift + haptic.c). Run before
# build-remind.sh / build-widget.sh: copying it into the app breaks the signature they make.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p src/bin
TMP=$(mktemp -d)
swiftc -O -parse-as-library -target arm64-apple-macos14.0 -emit-object tools/haptic.swift -o "$TMP/h-swift.o"
clang -O2 -target arm64-apple-macos14.0 -DNODE_GYP_MODULE_NAME=haptic -I"$(dirname "$(dirname "$(command -v node)")")/include/node" -c tools/haptic.c -o "$TMP/h-c.o"
swiftc -target arm64-apple-macos14.0 -emit-library "$TMP/h-swift.o" "$TMP/h-c.o" -o src/bin/haptic.node -framework AppKit -framework CoreFoundation -Xlinker -undefined -Xlinker dynamic_lookup
rm -rf "$TMP"
echo "built src/bin/haptic.node"
