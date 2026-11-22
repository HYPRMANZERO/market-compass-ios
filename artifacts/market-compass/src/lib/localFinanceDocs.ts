import {detectFinanceDocument,extractVehicleFinanceLines,classifyFinanceLabel,type FinanceDocumentKind,type FinanceField,type FinanceRole} from './vehicleFinance.ts';
import {classifyDocument,makeAccountProfile,maskDocumentPII,safeAccountProfile,type AccountProfile} from './documentIntelligence.ts';
import {bankStatementDate,parseBankStatementText} from './bankStatementParser.ts';

/**
 * Local-only, owner-reviewed financial-file intake.
 *
 * Text-based CSV, TXT and JSON can be parsed inside Safari without uploading
 * any file. Keep ONLY bounded, redacted, human-reviewed excerpts in the
 * existing passphrase-encrypted workspace. This is not OCR or bank verification.
 * Locally extracted selectable PDF text is supported, including PDFs opened
 * with a temporary password; images, DOCX, XLSX and OCR are NOT supported.
 */
export type LocalFinanceLine={
  label:string;
  amount:number|null;
  date:string|null;
  direction:'incoming'|'outgoing'|'unclassified';
  semanticRole?:FinanceRole;
  semanticField?:FinanceField;
  ratePercent?:number;
  /** Historical running balance on a dated bank statement row; NOT a payment. */
  runningBalance?:number;
};
export type LocalFinanceDocument={
  id:string;
  label:string;
  importedAt:string;
  format:'csv'|'txt'|'json'|'pdf';
  source:'owner-selected-iphone-file';
  bankVerified:false;
  complete:false;
  lines:LocalFinanceLine[];
  truncated:boolean;
  documentKind?:FinanceDocumentKind;
  accountProfile?:AccountProfile;
};
export const MAX_FINANCE_FILES=100;
export const MAX_FINANCE_FILE_BYTES=16_000_000;
export const MAX_FINANCE_LINES=300;
const labelOk=(v:unknown):v is string=>typeof v==='string'&&
  v.trim().length>=2&&v.trim().length<=70&& !/[\x00-\x1f<>]/.test(v);
const asObject=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function dateOf(value:unknown):string|null{
  if(typeof value!=='string')return null;
  const v=value.trim();
  let match=v.match(/^(\d{4})[-/](\d{2})[-/](\d{2})(?:T.*)?$/);
  let year:string,month:string,day:string;
  if(match){[year,month,day]=match.slice(1,4);}
  else {
    match=v.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
    if(match){
      day=match[1].padStart(2,'0');month=match[2].padStart(2,'0');year=match[3];
    }else{
      const named=v.match(/^(\d{1,2})[\s-]+([a-z]{3,9})[\s,-]+(\d{4})$/i);
      if(!named)return null;
      const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
      const monthIndex=months.indexOf(named[2].slice(0,3).toLowerCase());
      if(monthIndex<0)return null;
      day=named[1].padStart(2,'0');month=String(monthIndex+1).padStart(2,'0');year=named[3];
    }
  }
  const date=year+'-'+month+'-'+day;
  const stamp=new Date(date+'T00:00:00Z');
  return Number.isFinite(stamp.getTime())&&stamp.toISOString().slice(0,10)===date?date:null;
}
/** Only an explicit payroll payment date may date an otherwise undated pay row.
 * A statement period, contract date or import timestamp is never a debit date. */
function payslipPayDate(text:string):string|null{
  const matched=text.slice(0,30_000).match(
    /(?:^|\n)\s*(?:pay date|payment date|date paid|payday)\s*[:=-]?\s*(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[/.]\d{1,2}[/.]\d{4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/im
  );
  return matched?dateOf(matched[1]):null;
}
function maskText(value:unknown,max=130):string{
  if(typeof value!=='string')return '';
  // Mask common identifiers; not a guarantee that every possible item of
  // personal information has been removed. The owner must review the preview.
  return maskDocumentPII(value).replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email]')
    .replace(/(?:\+27|0)\d(?:[\s-]?\d){8,10}/g,'[phone]')
    .replace(/\b(?:\d[\s-]?){12,19}\b/g,'[long-number]')
    .replace(/\b(?:\d{4}[\s-]?){2,4}\d{0,4}\b/g,'[number]')
    .replace(/\b\d{8,11}\b/g,'[number]')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi,'[link]')
    .replace(/[<>]/g,'')
    .replace(/[\r\n\t]+/g,' ')
    .replace(/\s+/g,' ').trim().slice(0,max);
}
function moneyOf(value:unknown):number|null{
  if(typeof value==='number')return Number.isFinite(value)&&Math.abs(value)<=10_000_000?
    Math.round(value*100)/100:null;
  if(typeof value!=='string')return null;
  let s=value.trim().replace(/^(?:ZAR|R)\s*/i,'').replace(/\s/g,'');
  if(!s)return null;
  const negative=s.startsWith('(')&&s.endsWith(')');
  if(negative)s=s.slice(1,-1);
  // South African exports commonly use 1,234.56; only accept the decimal
  // comma when there is a single ungrouped comma and <=2 decimal digits.
  if(/^\d+,\d{1,2}$/.test(s))s=s.replace(',','.');
  else s=s.replace(/,/g,'');
  if(!/^[+-]?\d+(?:\.\d{1,2})?$/.test(s))return null;
  const n=Number(s)*(negative?-1:1);
  return Number.isFinite(n)&&Math.abs(n)<=10_000_000?Math.round(n*100)/100:null;
}
function splitCsv(text:string,delimiter:','|';'):string[][]{
  const rows:string[][]=[];
  let row:string[]=[],field='',quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(quoted&&text[i+1]==='"'){field+='"';i++;}
      else if(!quoted && field!=='')throw Error('CSV quote occurs inside a value.');
      else quoted=!quoted;
    }else if(!quoted&&(c===delimiter||c==='\n'||c==='\r')){
      if(c===delimiter){row.push(field);field='';}
      else {row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';if(c==='\r'&&text[i+1]==='\n')i++;}
    }else field+=c;
    if(rows.length>20000)throw Error('This CSV has too many rows for safe on-device processing; use a desktop split.');
  }
  if(quoted)throw Error('CSV has an unclosed quoted value.');
  row.push(field);if(row.some(x=>x.trim()))rows.push(row);
  return rows;
}
function parseCsv(text:string):LocalFinanceLine[]{
  const delimiter=(text.split(/\r?\n/,1)[0].match(/;/g)||[]).length>
    (text.split(/\r?\n/,1)[0].match(/,/g)||[]).length?';':',';
  // Keep the row parser strict to one delimiter, not mixing column separators.
  const rows=splitCsv(text,delimiter);
  if(rows.length<2)throw Error('CSV must contain a header and at least one row.');
  const header=rows[0].map(x=>x.trim().toLowerCase().replace(/[^a-z0-9]+/g,' '));
  const find=(choices:string[])=>header.findIndex(x=>choices.includes(x));
  const labelIdx=find(['description','details','transaction description','narrative','reference','item','particulars','name','pay item']);
  const dateIdx=find(['date','transaction date','posting date','value date','pay date','period']);
  const amountIdx=find(['amount','transaction amount','value','total','net amount','net pay','gross pay']);
  const debitIdx=find(['debit','debits','withdrawal','money out','paid out']);
  const creditIdx=find(['credit','credits','deposit','money in','paid in']);
  if(labelIdx<0 || (amountIdx<0&&(debitIdx<0&&creditIdx<0)))
    throw Error('Unsupported CSV columns. Export a table with Description and Amount (or Debit/Credit), optionally Date.');
  const out:LocalFinanceLine[]=[];
  for(const row of rows.slice(1)){
    if(out.length>=MAX_FINANCE_LINES+1)break;
    const description=maskText(row[labelIdx],130);
    if(!description)continue;
    let direction:LocalFinanceLine['direction']='unclassified';
    let amount=amountIdx>=0?moneyOf(row[amountIdx]):null;
    if(amount===null&&creditIdx>=0){const credit=moneyOf(row[creditIdx]);if(credit!==null&&credit!==0){amount=Math.abs(credit);direction='incoming';}}
    if(amount===null&&debitIdx>=0){const debit=moneyOf(row[debitIdx]);if(debit!==null&&debit!==0){amount=Math.abs(debit);direction='outgoing';}}
    if(amount===null)continue;
    // Signed values are not always direction-labelled by banks. Do not guess
    // when a generic Amount field has an unknown sign convention.
    out.push({label:description,amount,date:dateIdx>=0?dateOf(row[dateIdx]):null,direction});
  }
  return out;
}
function parseText(text:string):LocalFinanceLine[]{
  const out:LocalFinanceLine[]=[];
  for(const raw of text.split(/\r?\n/).slice(0,25000)){
    if(out.length>=MAX_FINANCE_LINES+1)break;
    const trimmed=raw.trim();if(trimmed.length<3)continue;
    const sourceDate=bankStatementDate(trimmed);
    const body=sourceDate?trimmed.replace(sourceDate.matched,' '):trimmed;
    // Read a complete numeric token. Dates and second currency values
    // must never be interpreted as amounts.
    const currencyValues=[...body.matchAll(/(?:^|[^\w.,+-])([+-]?)\s*(?:ZAR|R)\s*([+-]?\d+(?:[.,]\d+|[ \u00a0]\d{3}\b)*)/gi)];
    if(currencyValues.length>1)continue;
    const known=body.match(/\b(?:salary|basic pay|gross pay|gross earnings|net pay|paye|tax|deduction|amount due|invoice total|total due|take home pay|payment|total paid|receipt total|amount paid|subtotal|vat|insurance|fuel|rent|car payment)\b[\s:=]*([+-]?\d+(?:[.,]\d+|[ \u00a0]\d{3}\b)*)(?![\d.,%])/i);
    const match=currencyValues[0];
    let token=match?match[1]+match[2]:known?.[1];
    if(!token)continue;
    token=token.replace(/\s/g,'');
    if(/^[+-]?\d{1,3}(?:\.\d{3})+,\d{2}$/.test(token))token=token.replace(/\./g,'').replace(',','.');
    else if(/^[+-]?\d+,\d{1,2}$/.test(token))token=token.replace(',','.');
    else if(!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(token))continue;
    const amount=moneyOf(token);
    if(amount===null)continue;
    const date=sourceDate?.date??null;
    const desc=maskText(trimmed,130);if(!desc)continue;
    out.push({label:desc,amount,date,direction:'unclassified'});
  }
  return out;
}
function parseJson(text:string):LocalFinanceLine[]{
  let value:unknown;
  try{value=JSON.parse(text);}catch{throw Error('Selected JSON is not valid.');}
  const source=Array.isArray(value)?value:
    asObject(value)&&Array.isArray(value.transactions)?value.transactions:
    asObject(value)&&Array.isArray(value.entries)?value.entries:null;
  if(!source)throw Error('JSON must contain a transactions or entries array. Owner-budget-v1 files belong in the Owner budget section.');
  const out:LocalFinanceLine[]=[];
  for(const row of source.slice(0,MAX_FINANCE_LINES+1)){
    if(!asObject(row))continue;
    const label=maskText(row.description??row.label??row.details??row.name,130);
    const amount=moneyOf(row.amount??row.value??row.total);
    if(!label||amount===null)continue;
    out.push({label,amount,date:dateOf(row.date??row.transactionDate),
      direction:row.direction==='incoming'||row.direction==='outgoing'?row.direction:'unclassified'});
  }
  return out;
}
export function validateLocalFinanceDocument(input:unknown):LocalFinanceDocument|null{
  if(!asObject(input)||typeof input.id!=='string'||!/^[0-9a-f-]{20,64}$/i.test(input.id)||
    !labelOk(input.label)||typeof input.importedAt!=='string'||
    !Number.isFinite(Date.parse(input.importedAt))||
    input.source!=='owner-selected-iphone-file'||input.bankVerified!==false||
    input.complete!==false||input.truncated!==true&&input.truncated!==false||
    !['csv','txt','json','pdf'].includes(String(input.format))||
    !Array.isArray(input.lines)||input.lines.length<1||input.lines.length>MAX_FINANCE_LINES)return null;
  const lines:LocalFinanceLine[]=[];
  for(const v of input.lines){
    if(!asObject(v)||typeof v.label!=='string'||
      v.label.trim().length<2||v.label.length>130||/[\x00-\x1f<>]/.test(v.label)||
      v.amount!==null&& (typeof v.amount!=='number'||!Number.isFinite(v.amount)||Math.abs(v.amount)>10_000_000)||
      v.date!==null&&dateOf(v.date)!==v.date||
      !['incoming','outgoing','unclassified'].includes(String(v.direction)))return null;
    if(v.semanticRole!==undefined && !['contract-term','balance-reference','rate-reference','transaction','unclassified'].includes(String(v.semanticRole)))return null;
    if(v.semanticField!==undefined && !['original-principal','previous-instalment','instalment','residual-value','settlement-quotation','statement-balance','annual-rate','completed-payment'].includes(String(v.semanticField)))return null;
    if(v.ratePercent!==undefined && (typeof v.ratePercent!=='number'||!Number.isFinite(v.ratePercent)||v.ratePercent<0||v.ratePercent>100))return null;
    if(v.runningBalance!==undefined && (typeof v.runningBalance!=='number'||!Number.isFinite(v.runningBalance)||Math.abs(v.runningBalance)>10_000_000||v.semanticRole!=='transaction'||v.date===null))return null;
    const line:LocalFinanceLine={label:v.label,amount:v.amount as number|null,date:v.date as string|null,
      direction:v.direction as LocalFinanceLine['direction']};
    if(v.semanticRole!==undefined)line.semanticRole=v.semanticRole as FinanceRole;
    if(v.semanticField!==undefined)line.semanticField=v.semanticField as FinanceField;
    if(v.ratePercent!==undefined)line.ratePercent=v.ratePercent as number;
    if(v.runningBalance!==undefined)line.runningBalance=v.runningBalance as number;
    lines.push(line);
  }
  if(input.documentKind!==undefined &&
    !['absa-vehicle-finance','vehicle-finance','unclassified'].includes(String(input.documentKind)))return null;
  const validated:LocalFinanceDocument={id:input.id,label:input.label.trim(),importedAt:input.importedAt,
    source:'owner-selected-iphone-file',bankVerified:false,complete:false,
    format:input.format as LocalFinanceDocument['format'],
    lines,truncated:input.truncated as boolean};
  if(input.documentKind!==undefined)validated.documentKind=input.documentKind as FinanceDocumentKind;
  if(input.accountProfile!==undefined){
    const profile=safeAccountProfile(input.accountProfile);
    if(!profile)return null;
    validated.accountProfile=profile;
  }
  return validated;
}
export function extractLocalFinanceDocument(
  fileName:string,text:string,ownerLabel:string,
  {now=new Date(),id=crypto.randomUUID()}={}
):LocalFinanceDocument{
  if(!labelOk(ownerLabel))throw Error('Enter a short label describing the file (2–70 characters).');
  if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('Invalid current date.');
  if(typeof text!=='string'||new TextEncoder().encode(text).byteLength>MAX_FINANCE_FILE_BYTES)
    throw Error('This text export exceeds the on-device processing safety capacity. Nothing was saved.');
  const extension=fileName.toLowerCase().split('.').pop();
  if(extension!=='csv'&&extension!=='txt'&&extension!=='json'&&extension!=='pdf')
    throw Error('Supported: CSV, TXT, transaction JSON and already-extracted PDF text. Photos, DOCX and spreadsheets need a separate offline extractor; nothing was uploaded.');
  const documentKind=extension==='pdf'?detectFinanceDocument(text,fileName+' '+ownerLabel):'unclassified';
  const classified=classifyDocument(text,fileName+' '+ownerLabel);
  const bankStatement=(extension==='pdf'||extension==='txt')&&
    classified.category==='bank-statement'&&documentKind==='unclassified'?
      parseBankStatementText(text,MAX_FINANCE_LINES):null;
  // Preserve dedicated bank statement and vehicle finance parsers so running
  // balances and contract amounts never masquerade as completed transactions.
  let lines:LocalFinanceLine[]=documentKind!=='unclassified'?
    extractVehicleFinanceLines(text).map(line=>({...line,label:maskText(line.label,130)})):
    bankStatement?bankStatement.lines.map(line=>({...line,label:maskText(line.label,130)})):
    extension==='csv'?parseCsv(text):
    extension==='txt'||extension==='pdf'?parseText(text):parseJson(text);
  // A payslip payment date is explicit evidence for payroll fields only,
  // never a substitute for an undated bank statement transaction.
  if(classified.category==='payslip'){
    const paidOn=payslipPayDate(text);
    if(paidOn)lines=lines.map(line=>line.date===null&&
      /\b(?:net pay|take home pay|gross pay|gross earnings|basic pay|paye)\b/i.test(line.label)
      ?{...line,date:paidOn}:line);
  }
  if(!lines.length)throw Error(bankStatement?
    'Bank statement found, but no complete dated transaction or labelled balance rows were read. Try a bank CSV export or check the PDF layout; nothing was saved.':
    'No financial rows with recognisable amounts were found. Nothing was saved.');
  const document={
    id,label:ownerLabel.trim(),importedAt:now.toISOString(),
    source:'owner-selected-iphone-file' as const,format:extension,
    bankVerified:false as const,complete:false as const,
    lines:lines.slice(0,MAX_FINANCE_LINES),truncated:bankStatement?.truncated===true||lines.length>MAX_FINANCE_LINES,
    documentKind,
    accountProfile:{...makeAccountProfile(text,ownerLabel,lines.slice(0,MAX_FINANCE_LINES)),...classified}
  };
  const validated=validateLocalFinanceDocument(document);
  if(!validated)throw Error('File review could not produce a safe bounded local document.');
  return validated;
}
/** Owner-confirmed migration of saved, already-redacted excerpt labels.
 * Keeps the same document and line IDs, dates, amounts, and ledger entries.
 * Cannot recover source text absent from a previous partial import. */
export function reclassifySavedFinanceDocument(input:LocalFinanceDocument):LocalFinanceDocument{
  const existing=validateLocalFinanceDocument(input);
  if(!existing)throw Error('The encrypted document summary is invalid. Export a backup first.');
  const kind=detectFinanceDocument(existing.lines.map(l=>l.label).join('\n'),existing.label);
  if(kind==='unclassified')throw Error('Not enough saved context to classify this as vehicle finance. Reopen the original PDF if available.');
  const result=validateLocalFinanceDocument({...existing,documentKind:kind,
    lines:existing.lines.map(line=>{
      if(line.semanticRole)return line;
      const semantic=classifyFinanceLabel(line.label);
      return {...line,...semantic};
    })
  });
  if(!result)throw Error('Cannot safely classify stored excerpts.');
  return result;
}

export function addLocalFinanceDocument(current:unknown,document:LocalFinanceDocument):LocalFinanceDocument[]{
  if(!Array.isArray(current))throw Error('Invalid existing encrypted document list. Export a backup first.');
  const checked=current.map(validateLocalFinanceDocument);
  if(checked.some(x=>!x))throw Error('One of the existing encrypted document summaries is invalid. Back up before editing.');
  const safe=checked as LocalFinanceDocument[];
  const checkedDocument=validateLocalFinanceDocument(document);
  if(!checkedDocument||safe.length>=MAX_FINANCE_FILES||
     safe.some(x=>x.id===checkedDocument.id))throw Error('Document is invalid, duplicate, or the device document-summary capacity has been reached.');
  // Save the reconstructed allowlist object, NEVER the caller's untrusted
  // input. This prevents injected secrets, source paths or extra fields from
  // entering the encrypted workspace even if a caller uses type assertions.
  return [...safe,checkedDocument];
}
export function removeLocalFinanceDocument(current:unknown,id:string):LocalFinanceDocument[]{
  if(!Array.isArray(current))throw Error('Invalid encrypted document list.');
  const checked=current.map(validateLocalFinanceDocument);
  if(checked.some(x=>!x))throw Error('Unrecognised document data; cannot silently discard it.');
  return (checked as LocalFinanceDocument[]).filter(x=>x.id!==id);
}
