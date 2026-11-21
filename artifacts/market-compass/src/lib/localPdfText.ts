/**
 * Bounded, device-only extraction of selectable text from a PDF.
 *
 * The original PDF and temporary password are never persisted or uploaded.
 * PDF.js and its worker are bundled with the PWA (no external CDN).
 * JavaScript cannot guarantee immediate erasure of immutable password strings
 * from browser-managed memory; we drop references after each attempt instead.
 */
export const MAX_LOCAL_PDF_BYTES = 2_000_000;
export const MAX_LOCAL_PDF_PAGES = 12;
export const MAX_LOCAL_PDF_TEXT_CHARS = 200_000;

export async function extractLocalPdfText(file: File, temporaryPassword = ''): Promise<string> {
  if (!(file instanceof File) || !/\.pdf$/i.test(file.name)) {
    throw Error('Select a PDF document from iPhone Files.');
  }
  if (!file.size || file.size > MAX_LOCAL_PDF_BYTES) {
    throw Error('Choose a text-based PDF smaller than 2 MB. No file was saved.');
  }

  // Lazy-load the matching parser and worker from this PWA, not a public CDN.
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const bytes = new Uint8Array(await file.arrayBuffer());
  let task: ReturnType<typeof pdfjs.getDocument> | undefined;
  try {
    if (bytes.byteLength > MAX_LOCAL_PDF_BYTES) throw Error('PDF exceeds the 2 MB limit.');
    task = pdfjs.getDocument({
      data: bytes,
      password: temporaryPassword || undefined,
      isEvalSupported: false,
      useSystemFonts: false,
    });
    const pdf = await task.promise;
    if (pdf.numPages < 1 || pdf.numPages > MAX_LOCAL_PDF_PAGES) {
      throw Error('PDF must contain 1–12 pages. Export a shorter statement first.');
    }
    const lines: string[] = [];
    let length = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let current = '';
      for (const item of content.items) {
        if (!('str' in item) || typeof item.str !== 'string') continue;
        const fragment = item.str.replace(/[\r\n\t]+/g, ' ').trim();
        if (fragment) current += (current ? ' ' : '') + fragment;
        if ('hasEOL' in item && item.hasEOL && current) {
          lines.push(current);
          length += current.length + 1;
          current = '';
        }
        if (length + current.length > MAX_LOCAL_PDF_TEXT_CHARS) {
          throw Error('PDF contains too much extractable text. Select fewer pages.');
        }
      }
      if (current) {
        lines.push(current);
        length += current.length + 1;
      }
      page.cleanup();
      if (length > MAX_LOCAL_PDF_TEXT_CHARS) {
        throw Error('PDF contains too much extractable text. Select fewer pages.');
      }
    }
    const text = lines.join('\n').trim();
    if (!text) {
      throw Error('This PDF has no selectable text. Scanned images need an offline OCR tool; nothing was saved.');
    }
    return text;
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException') {
      throw Error('This PDF requires a password or the temporary password was incorrect. Enter the PDF password and choose the file again. Nothing was saved.');
    }
    // Do not expose parser stack traces, document contents or a password.
    if (error instanceof Error && /^(PDF must|PDF contains|PDF exceeds|This PDF has)/.test(error.message)) {
      throw error;
    }
    throw Error('The PDF could not be read privately. Try a smaller, text-based PDF or export CSV/TXT; nothing was saved.');
  } finally {
    if (task) {
      try { await task.destroy(); } catch { /* PDF worker cleanup is best effort. */ }
    }
    // PDF.js may transfer its buffer to a worker; wipe if still accessible.
    if (bytes.byteLength) bytes.fill(0);
  }
}
