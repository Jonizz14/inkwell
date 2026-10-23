// The PDF reader of the desktop app (src/extract.mjs), bundled for the browser by
// scripts/build-web.mjs: pdf.js runs its parsing in a worker; Vision and tesseract are left out
// (api.js asks for no OCR), node's modules are stood in for by node-stubs.mjs.
import { GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', import.meta.url).href;
export { extractPdf } from '../src/extract.mjs';
