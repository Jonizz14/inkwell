// Moving highlights, vocabulary and notes onto a rebuilt text lives in renderer/migrate.js, which
// the window loads as a plain script; this is it for node (scripts/reextract.mjs).
import { createRequire } from 'node:module';
export const { migrateRecord } = createRequire(import.meta.url)('./renderer/migrate.js');
