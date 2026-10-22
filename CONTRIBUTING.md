# Contributing to Inkwell

Thanks for wanting to help! Bug reports, ideas, translations and code are all welcome.

## Before you start

- **Bugs and ideas:** open an [issue](../../issues/new/choose) first. For a bug, say which OS and
  Inkwell version you use and how to make it happen.
- **Security problems:** don't open a public issue. See [SECURITY.md](SECURITY.md).
- **Bigger changes:** open an issue to talk about it before writing a lot of code, so your work
  fits where the app is going.

## Setting up

You need Node.js 20+ (CI uses 22). On macOS, the Xcode command line tools for the Swift helpers.

```bash
git clone https://github.com/Jonizz14/inkwell.git
cd inkwell
npm install
npm start                 # run the app
npm test                  # PDF extraction test
npm run build:mac-tools   # macOS only: Vision OCR, read-along and haptics helpers
```

Your notes live in the app's data folder (see the README). If you test with real data, **back up
`notes.json` first**; it holds every highlight, word and note.

## How the code is written

- Plain JavaScript, HTML and CSS: no framework and no bundler. `src/renderer/` is the interface,
  `src/main.js` the Electron main process, `tools/` the Swift helpers for macOS.
- Match the code around you: names, comment density (comments say *why*), small functions.
- Motion: animate only `transform`, `opacity` and `filter`, and respect `prefers-reduced-motion`.
  The interface is black and white; please don't add accent colours.
- Every text the user sees goes through `t()` with strings for **Uzbek, English and Russian**.
- Anything macOS-only must fail quietly on Windows (check `api.platform`).

## Pull requests

1. Fork the repo and create a branch from `main`.
2. Keep each PR about one thing. Describe what changed and how you tested it; screenshots or a
   short screen recording help a lot for UI changes.
3. Run `npm test` and try the app on at least one OS.
4. Fill in the PR template.

Every push to `main` builds and publishes a release, so PRs are merged only after they've been
tried in the app.

By contributing you agree that your work is licensed under the project's
[AGPL-3.0](LICENSE) license. Please follow the [Code of Conduct](CODE_OF_CONDUCT.md).
