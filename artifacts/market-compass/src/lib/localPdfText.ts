import {layoutStandardBankPdfLines} from './standardBankPdfLayout.ts';
/**
 * Bounded, device-only extraction of selectable text from a PDF.
 *
 * The original PDF and temporary password are never persisted or uploaded.
 * PDF.js and its worker are bundled with the PWA (no external CDN).
 * JavaScript cannot guarantee immediate erasure of immutable password strings
 * from browser-managed memory; we drop references after each attempt instead.
 */
// Browser PDF.js currently materialises the source in memory. This is a
// device-safety ceiling, not a business/document-page limit.
export const MAX_LOCAL_PDF_BYTES = 64*1024*1024;
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
export const MAX_LOCAL_PDF_PAGES = Number.POSITIVE_INFINITY;
export const MAX_LOCAL_PDF_TEXT_CHARS = 2_000_000;
export type PdfProgress={page:number;total:number;stage:'reading'|'extracting'};
export type PdfReadOptions={signal?:AbortSignal;onProgress?:(progress:PdfProgress)=>void};

export async function extractLocalPdfText(file: File, temporaryPassword = '',options:PdfReadOptions={}): Promise<string> {
  if (!(file instanceof File) || !/\.pdf$/i.test(file.name)) {
    throw Error('Select a PDF document from iPhone Files.');
  }
  if (!file.size || file.size > MAX_LOCAL_PDF_BYTES) {
    throw Error('This PDF exceeds the 64 MB on-device memory safety limit. Use a local desktop parser or split the export; nothing was saved.');
  }

  // Lazy-load the matching parser and worker from this PWA, not a public CDN.
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  if(options.signal?.aborted)throw Error('PDF processing cancelled; nothing was saved.');
  options.onProgress?.({page:0,total:0,stage:'reading'});
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
    if (pdf.numPages < 1) throw Error('The PDF contains no pages. Nothing was saved.');
    const lines: string[] = [];
    let length = 0;
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      if(options.signal?.aborted)throw Error('PDF processing cancelled; nothing was saved.');
      options.onProgress?.({page:pageNumber,total:pdf.numPages,stage:'extracting'});
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      // PDF text order is not always reading order. Reconstruct line positions
      // from transform x/y so "R 3 543,36" stays beside its source label.
      // Keep explicit EOL fallback for PDFs without usable coordinates.
      const genericLines=layoutSelectablePdfLines(content.items);
      // Where a native five-column statement table is present, preserve the
      // actual Payments/Deposits positions using PDF geometry. Keep only
      // institution/header context and available-balance notes from the generic
      // text to avoid treating the same row as two transactions.
      const tableLines=layoutStandardBankPdfLines(content.items);
      const pageLines=tableLines?[
        ...genericLines.filter(line=>
          /\b(?:standard bank|three.month statement|3.month statement|available balance)\b/i.test(line) &&
          !/^\d{1,2}\s+[a-z]{3,9}\s+\d{2,4}\b/i.test(line)).slice(0,12),
        ...tableLines
      ]:genericLines;
      for(const line of pageLines){
        length+=line.length+1;
        if(length>MAX_LOCAL_PDF_TEXT_CHARS)
          throw Error('PDF contains too much extractable text. Select fewer pages.');
        lines.push(line);
      }
      page.cleanup();
      // Yield between pages so Safari can repaint the progress dialog.
      if(pageNumber%2===0)await new Promise<void>(resolve=>setTimeout(resolve,0));
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
    if (error instanceof Error && /^(PDF must|PDF contains|PDF exceeds|This PDF has|This PDF exceeds|PDF processing cancelled|The PDF contains)/.test(error.message)) {
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
