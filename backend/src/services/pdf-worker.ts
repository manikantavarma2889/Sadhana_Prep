import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const require = createRequire(import.meta.url);
const standardFontDataUrl = join(dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts').replaceAll('\\', '/') + '/';

async function extract(buffer: Uint8Array) {
  const task = getDocument({
    data: new Uint8Array(buffer), disableFontFace: true, useSystemFonts: false,
    stopAtErrors: true, maxImageSize: 1_000_000, standardFontDataUrl,
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 15) return { error: 'Use a PDF with no more than 15 pages.' };
    let text = '';
    for (let number = 1; number <= pdf.numPages && text.length < 24_000; number++) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      for (const item of content.items) {
        if ('str' in item) text += item.str + (item.hasEOL ? '\n' : ' ');
        if (text.length >= 24_000) break;
      }
      text += '\n';
      page.cleanup();
    }
    return { text: text.trim().slice(0, 24_000) };
  } finally {
    await task.destroy();
  }
}

process.once('message', async buffer => {
  const result = buffer instanceof Uint8Array
    ? await extract(buffer).catch(() => ({ error: 'This PDF could not be read. Use an unlocked, text-based PDF.' }))
    : { error: 'This PDF could not be read.' };
  process.send?.(result, () => { if (process.connected) process.disconnect?.(); });
});
