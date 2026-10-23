// What src/extract.mjs imports from node, for its browser build: only the OCR paths touch these,
// and the web never takes them.
export const execFile = () => { throw new Error('no OCR in the browser'); };
export const existsSync = () => false;
export const fileURLToPath = () => '';
export const tmpdir = () => '';
export const join = (...a) => a.join('/');
export default { tmpdir, join, writeFile: async () => {}, rm: async () => {} };
