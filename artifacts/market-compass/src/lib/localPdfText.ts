/**
 * Bounded, device-only extraction of selectable text from a PDF.
 *
 * The original PDF and temporary password are never persisted or uploaded.
 * PDF.js and its worker are bundled with the PWA (no external CDN).
 * JavaScript cannot guarantee immediate erasure of immutable password strings
 * from browser-managed memory; we drop references after each attempt instead.
 */
export const MAX_LOCAL_PDF_BYTES = 2_000_000;
/** Rebuild selectable text lines without saving PDF coordinates or raw bytes. */
export function layoutSelectablePdfLines(items:ReadonlyArray<unknown>):string[]{
  const fragments:{text:string;x:number;y:number;order:number;end:boolean}[]=[];
  for(let i=0;i<items.length;i++){
    const item=items[i];
    if(!item||typeof item!=='object'||!('str' in item)||
       typeof item.str!=='string')continue;
    const content=item.str.replace(/[\r\n\t]+/g,' ').trim();
    if(!content)continue;
    const matrix='transform' in item?item.transform:null;
    const valid=Array.isArray(matrix)&&matrix.length>=6&&
      Number.isFinite(matrix[4])&&Number.isFinite(matrix[5]);
    fragments.push({text:content,x:valid?Number(matrix[4]):NaN,
      y:valid?Number(matrix[5]):NaN,order:i,
      end:'hasEOL' in item&&item.hasEOL===true});
  }
  if(fragments.length===0)return [];
  if(fragments.every(x=>Number.isFinite(x.x)&&Number.isFinite(x.y))){
    const rows:{y:number;parts:typeof fragments}[]=[];
    // Coordinates are in PDF points. +/-2.5 accommodates glyph baselines.
    for(const frag of fragments){
      const row=rows.find(r=>Math.abs(r.y-frag.y)<=2.5);
      if(row)row.parts.push(frag);
      else rows.push({y:frag.y,parts:[frag]});
    }
    rows.sort((a,b)=>b.y-a.y);
    return rows.map(row=>row.parts.sort((a,b)=>a.x-b.x).map(p=>p.text).join(' '))
      .map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
  }
  const out:string[]=[];let current='';
  for(const frag of fragments){
    current+=(current?' ':'')+frag.text;
    if(frag.end){out.push(current);current='';}
  }
  if(current)out.push(current);
  return out;
}
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
      // PDF text order is not always reading order. Reconstruct line positions
      // from transform x/y so "R 3 543,36" stays beside its source label.
      // Keep explicit EOL fallback for PDFs without usable coordinates.
      const pageLines=layoutSelectablePdfLines(content.items);
      for(const line of pageLines){
        length+=line.length+1;
        if(length>MAX_LOCAL_PDF_TEXT_CHARS)
          throw Error('PDF contains too much extractable text. Select fewer pages.');
        lines.push(line);
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
