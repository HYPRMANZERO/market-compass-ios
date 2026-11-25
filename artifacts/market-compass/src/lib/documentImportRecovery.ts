/**
 * Privacy-safe guidance for on-device financial-file imports. Only a bounded
 * ordinal index and general reason survive an unsuccessful attempt; never
 * save filenames, passwords, raw PDF errors, extracted text or bank details.
 */
export type ImportRecoveryCode=
  'password'|'scanned'|'size'|'format'|'empty'|'capacity'|'unreadable';
export type ImportRecoveryFailure={index:number;code:ImportRecoveryCode};
export type ImportRecoveryAdvice={label:string;nextStep:string};
const GUIDANCE:Record<ImportRecoveryCode,ImportRecoveryAdvice>={
  password:{label:'Password required or incorrect',nextStep:
    'Open the original document in Files, confirm its password, and retry the selected PDF using the one-time local password field. The password is not saved.'},
  scanned:{label:'PDF has no selectable text',nextStep:
    'Export a text-based PDF or CSV from your bank. Image-only scans need a trusted offline OCR process; do not upload statements to an online converter.'},
  size:{label:'On-device size or extraction limit',nextStep:
    'For Safari memory safety, export a smaller date range or use a trusted desktop parser. Keep the original file. No unsupported partial import was saved.'},
  format:{label:'Unsupported file type',nextStep:
    'Select a PDF with selectable text, CSV, TXT or supported transaction JSON. Keep the original and avoid converting private documents on third-party sites.'},
  empty:{label:'No usable financial content',nextStep:
    'Confirm the export contains transactions or statement facts, not a blank file. Try a bank-provided CSV or selectable-text PDF.'},
  capacity:{label:'Encrypted review capacity reached',nextStep:
    'Finish and back up existing document reviews first. Do not delete saved records just to force a new import.'},
  unreadable:{label:'Document could not be read',nextStep:
    'Check the original file for corruption, then retry a readable PDF, CSV or TXT. Saved records and existing reviews have not been replaced.'}
};
export function importRecoveryAdvice(code:ImportRecoveryCode):ImportRecoveryAdvice{
  return GUIDANCE[code]??GUIDANCE.unreadable;
}
export function classifyImportFailure(error:unknown):ImportRecoveryCode{
  // Intentionally never returns the original error text, which may contain
  // document names, local paths or provider-specific sensitive information.
  const message=error instanceof Error?error.message:
    typeof error==='string'?error:'';
  if(/capacity|full|no space/i.test(message))return 'capacity';
  if(/password|encrypted|passwordexception/i.test(message))return 'password';
  if(/selectable text|scanned|offline ocr|image.only|scan only/i.test(message))return 'scanned';
  if(/64 mb|size limit|memory|too (?:much|large|many)|exceeds|maximum|oversize/i.test(message))return 'size';
  if(/unsupported|format|extension|file type/i.test(message))return 'format';
  if(/empty|no pages|no (?:reviewed|financial|usable|extractable)|blank/i.test(message))return 'empty';
  return 'unreadable';
}
/** Never include a filename, password, exception message or document text in
 * this list. The index is the 1-based position in the last selected batch. */
export function safeImportFailures(input:readonly ImportRecoveryFailure[]):ImportRecoveryFailure[]{
  if(!Array.isArray(input))return [];
  return input.slice(0,100).filter(x=>x&&Number.isSafeInteger(x.index)&&x.index>=1&&x.index<=10000&&
    typeof x.code==='string'&&Object.prototype.hasOwnProperty.call(GUIDANCE,x.code))
    .map(({index,code})=>({index,code}));
}
