// Regenerates Sources/Islet/InkyFrames.swift from Inkwell's mascot (src/renderer/inky.js).
// Usage: node Tools/inky-frames.js ~/Projects/inkwell
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(process.argv[2], 'src/renderer/inky.js'), 'utf8');
const a = src.indexOf('const SPRITE = (() => {');
const b = src.indexOf('// a frame as SVG');
const SPRITE = eval(src.slice(a, b).replace('const SPRITE =', '(').replace(/;\s*$/, '') + ')');
const want = ['idle', 'blink', 'lookL', 'lookR', 'happy', 'happy2', 'wave', 'wave2', 'read', 'readL', 'readR', 'love', 'love2', 'starry', 'starry2', 'proud', 'sleep', 'sleep2'];
let out = '// Generated from Inkwell src/renderer/inky.js (the SPRITE frames) by Tools/inky-frames.js.\n'
  + '// 26×16 pixels per frame. X ink body, W page colour (eyes, mouth), g grey, R red, P pink, B blue, Y gold.\n'
  + 'enum InkyFrames {\n    static let all: [String: [String]] = [\n';
for (const k of want) out += `        "${k}": [\n` + SPRITE[k].map((r) => `            "${r}",`).join('\n') + '\n        ],\n';
out += '    ]\n}\n';
fs.writeFileSync(path.join(__dirname, '..', 'Sources/Islet/InkyFrames.swift'), out);
