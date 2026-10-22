# Accessibility

Inkwell is a reading app, so it should work for as many readers as possible. This page says
honestly what works today and what doesn't yet.

## What works

- **Keyboard:** the main actions have shortcuts (highlight `H`, save word `W`, vocabulary `V`,
  focus `F`, session `S`, notes `N`, menu `⌘K`). All of them are listed in **Settings → Shortcuts**.
  On Windows, read `⌘` as `Ctrl`.
- **Reading comfort:** text size from 50% to 200%, line height, column width, reading font, and
  how much focus mode dims the other paragraphs.
- **Light and dark themes**, following the system or set by hand.
- **Reduced motion:** with *Reduce motion* turned on in the system, animations are skipped or
  shortened.
- **Haptics are optional:** trackpad taps on macOS can be turned off in **Settings → Haptics**.
- **Three interface languages:** Uzbek, English and Russian.

## Known limitations

- Screen readers (VoiceOver, NVDA) **haven't been tested properly**. Some buttons have labels,
  but charts, the flashcards and focus mode are likely hard to use with a screen reader.
- Charts show their values on hover; there's no table for every chart yet (the reading chart
  has one).
- Some text in the light theme is light grey and may not meet WCAG contrast everywhere.
- Read-along (following your voice) is macOS-only.

## Supported environments

macOS on Apple Silicon (the released `.dmg` is arm64) and Windows 10/11 (x64).

## Reporting a barrier

If something stops you from using Inkwell, please
[open an issue](../../issues/new?template=accessibility.yml). Say what you were trying to do,
what assistive technology you use (if any), and your OS. Accessibility issues get priority.
