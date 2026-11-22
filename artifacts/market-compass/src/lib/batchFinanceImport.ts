/**
 * Sequential, on-device multi-file importer. No network requests or file
 * uploads. A temporary password is used only by local PDF.js and never stored.
 */
import {extractLocalFinanceDocument,MAX_FINANCE_FILES,MAX_FINANCE_FILE_BYTES,
 type LocalFinanceDocument} from './localFinanceDocs.ts';
import {extractLocalPdfText,MAX_LOCAL_PDF_BYTES,type PdfProgress} from './localPdfText.ts';
export type BatchImportSummary={
  drafts:LocalFinanceDocument[];duplicateCount:number;failedCount:number;
  passwordRequiredCount:number;oversizeCount:number;
};
export type BatchReadOptions={
 existing:readonly LocalFinanceDocument[];label:string;password:string;
 signal?:AbortSignal;
 progress?:(status:{file:number;total:number;page:number;pages:number;stage:string})=>void;
 pdfReader?:(file:File,password:string,opts:{signal?:AbortSignal;onProgress?:(p:PdfProgress)=>void})=>Promise<string>;
};
export async function importFinanceBatch(files:readonly File[],options:BatchReadOptions):Promise<BatchImportSummary>{
 if(!Array.isArray(files)||!files.length)throw Error('Select one or more financial documents.');
 const capacity=MAX_FINANCE_FILES-options.existing.length;
 if(capacity<=0)throw Error('Your encrypted document summary capacity is full.');
 const ids=new Set(options.existing.map(x=>x.id));
 const result:BatchImportSummary={drafts:[],duplicateCount:0,failedCount:0,
  passwordRequiredCount:0,oversizeCount:0};
 const reader=options.pdfReader??extractLocalPdfText;
 for(let i=0;i<files.length;i++){
  options.signal?.throwIfAborted();
  if(result.drafts.length>=capacity){result.failedCount+=files.length-i;break;}
  const file=files[i];
  options.progress?.({file:i+1,total:files.length,page:0,pages:0,stage:'reading'});
  const pdf=/\.pdf$/i.test(file.name);
  const validExt=/\.(pdf|csv|txt|json)$/i.test(file.name);
  if(!validExt||!file.size||file.size>(pdf?MAX_LOCAL_PDF_BYTES:MAX_FINANCE_FILE_BYTES)){
   result.oversizeCount++;result.failedCount++;continue;
  }
  try{
   // Keep a single PDF in memory at once; do not access a folder or path.
   const text=pdf?await reader(file,options.password,{
      signal:options.signal,
      onProgress:p=>options.progress?.({file:i+1,total:files.length,
        page:p.page,pages:p.total,stage:p.stage})
    }):await file.text();
   options.signal?.throwIfAborted();
   // Stable local digest prevents replaying the same extracted document into
   // different encrypted records. No raw text or file bytes are persisted.
   const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
   const hex=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
   const id=(hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+
     hex.slice(16,20)+'-'+hex.slice(20,32)) as ReturnType<typeof crypto.randomUUID>;
   if(ids.has(id)){result.duplicateCount++;continue;}
   const safeLabel=options.label.trim()||'Financial document '+(i+1);
   options.progress?.({file:i+1,total:files.length,page:0,pages:0,stage:'classifying'});
   const draft=extractLocalFinanceDocument(file.name,text,safeLabel,{id});
   if(!draft.lines.length)throw Error('No reviewed financial facts.');
   ids.add(id);
   result.drafts.push(draft);
  }catch(error){
   if(options.signal?.aborted)throw Error('Batch import cancelled; nothing was saved.');
   result.failedCount++;
   if(error instanceof Error&&/password|encrypted/i.test(error.message))
     result.passwordRequiredCount++;
  }
 }
 return result;
}
