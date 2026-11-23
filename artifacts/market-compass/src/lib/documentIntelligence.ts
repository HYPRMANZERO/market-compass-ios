/**
 * Local, explainable document classification. Not a language-model response.
 * Ollama is the only permitted model for future optional AI-assisted review.
 * Store only masked/allowlisted summary facts, never the source document.
 */
export type DocumentCategory='bank-statement'|'vehicle-finance'|'payslip'|
  'credit-card'|'personal-loan'|'mortgage'|'utility-bill'|'invoice'|
  'investment-statement'|'tax-document'|'unclassified';
export type DocumentFactField='statement-balance'|'settlement-quotation'|
  'original-principal'|'instalment'|'previous-instalment'|'residual-value'|
  'annual-rate'|'net-pay'|'gross-pay'|'basic-pay'|'paye'|'uif'|'total-deductions'|
  'pension'|'medical-aid'|'allowance'|'bonus'|'overtime'|'amount-due'|'running-balance';
export type DocumentFact={field:DocumentFactField;amount:number|null;ratePercent?:number;
  asOf:string|null;sourceLabel:string;historical:true};
export type AccountProfile={name:string;institution:string;category:DocumentCategory;
  accountType?:string;confidence:'matched-terms'|'uncertain';facts:DocumentFact[]};
const institutions=[
  ['ABSA',/\babsa\b/i],['FNB',/\bfnb\b|\bfirst national bank\b/i],
  ['Standard Bank',/\bstandard bank\b/i],['Nedbank',/\bnedbank\b/i],
  ['Capitec',/\bcapitec\b/i],['Discovery Bank',/\bdiscovery bank\b/i],
  ['African Bank',/\bafrican bank\b/i],['TymeBank',/\btymebank\b/i]
] as const;
const names:Record<DocumentCategory,string>={
  'bank-statement':'Bank account','vehicle-finance':'Vehicle finance',
  'payslip':'Employment income','credit-card':'Credit card',
  'personal-loan':'Personal loan','mortgage':'Home loan',
  'utility-bill':'Utilities','invoice':'Invoice',
  'investment-statement':'Investment account','tax-document':'Tax document',
  'unclassified':'Unclassified document'
};
const patterns:ReadonlyArray<{category:DocumentCategory;matches:RegExp[]}>=[
  {category:'vehicle-finance',matches:[
    /\bvehicle (?:asset )?finance\b|\binstalment sale\b|\binstallment sale\b/i,
    /\boriginal amount financed\b|\bresidual value\b|\bvehicle instalment\b|\bcar finance\b/i]},
  {category:'credit-card',matches:[
    /\bcredit card statement\b|\bcredit facility\b|\bcard account\b/i,
    /\bminimum repayment\b|\bminimum payment due\b|\bcredit limit\b/i]},
  {category:'mortgage',matches:[
    /\bhome loan\b|\bmortgage\b/i,
    /\bbond account\b|\bproperty finance\b/i]},
  {category:'personal-loan',matches:[
    /\bpersonal loan\b|\bterm loan\b|\bunsecured loan\b/i,
    /\bloan agreement\b|\bloan account\b/i]},
  {category:'payslip',matches:[
    /\bpayslip\b|\bpay slip\b|\bpay advice\b/i,
    /\bnet pay\b|\bgross pay\b|\bPAYE\b/i]},
  {category:'bank-statement',matches:[
    /\bbank statement\b|\bstatement of account\b|\b3.month statement\b|\bthree.month statement\b/i,
    /\btransaction date\b|\bopening balance\b|\bclosing balance\b|\bavailable balance\b|\bpayments\s+deposits\s+balance\b|\bSTDBANK\b/i]},
  {category:'investment-statement',matches:[
    /\binvestment statement\b|\bportfolio statement\b/i,
    /\bunits held\b|\bholdings statement\b|\bmarket value\b/i]},
  {category:'utility-bill',matches:[
    /\bmunicipal account\b|\belectricity bill\b|\bwater bill\b/i,
    /\bservice charges\b|\bmeter reading\b/i]},
  {category:'invoice',matches:[
    /\btax invoice\b|\binvoice number\b/i,
    /\binvoice date\b|\bamount payable\b/i]},
  {category:'tax-document',matches:[
    /\bIRP5\b|\bIT3\b|\bincome tax assessment\b/i,
    /\bSARS\b|\btax return\b/i]}
];
export function classifyDocument(text:string,fileHint=''):Pick<AccountProfile,'name'|'institution'|'category'|'confidence'|'accountType'>{
  const haystack=(text+'\n'+fileHint).slice(0,2_000_000);
  // Issuing bank must be identifiable in the document heading, never simply
  // mentioned as a merchant/payee elsewhere or inferred from a file name.
  const firstLines=text.split(/\r?\n/).slice(0,14);
  // Payment narrations can mention other banks. Never treat a bank name in a
  // dated transfer or beneficiary line as the source institution.
  const headerLines=firstLines.filter((line,index)=>{
    if(index>5||/\b(?:transfer|payment to|beneficiary|merchant|debit|withdrawal|deposit|pos purchase|eft to)\b/i.test(line)||
      /^\s*(?:\d{4}-\d{2}-\d{2}|\d{2}[\/-]\d{2}[\/-]\d{2,4}|\d{2}\s+[a-z]{3}\s+\d{2,4})\b/i.test(line))return false;
    return /\b(?:statement|account|finance|bank|credit card|savings|cheque|current|issued by)\b/i.test(line)||
      institutions.some(([,pattern])=>pattern.test(line)&&line.trim().length<=32);
  });
  const heading=headerLines.join(' ').slice(0,1500);
  const foundInstitutions=institutions.filter(([,pattern])=>pattern.test(heading));
  const institution=foundInstitutions.length===1?foundInstitutions[0][0]:'Unidentified provider';
  const accountTypeMatch=heading.match(/\b(cheque|current|savings|transmission|transactional|credit card|business)\s+(?:bank\s+)?(?:account|statement)\b|\baccount\s+type\s*[:\-]?\s*(cheque|current|savings|transmission|transactional|credit card|business)\b/i);
  const accountType=accountTypeMatch?(accountTypeMatch[1]??accountTypeMatch[2]).toLowerCase():undefined;
  // File names may contain identifiers; do not reuse them as account names.
  const ranked=patterns.map(p=>({kind:p.category,
    score:p.matches.reduce((score,re)=>score+(re.test(haystack)?1:0),0)}))
    .sort((a,b)=>b.score-a.score);
  const best=ranked[0];
  const tied=best.score>0&&ranked[1]?.score===best.score;
  const header=text.split(/\r?\n/).slice(0,5).join(' ');
  const headingMatches=tied?ranked.filter(candidate=>candidate.score===best.score&&
    patterns.find(pattern=>pattern.category===candidate.kind)?.matches[0].test(header)):[];
  const category:DocumentCategory=tied?(headingMatches.length===1?headingMatches[0].kind:
    ranked.some(candidate=>candidate.kind==='bank-statement'&&candidate.score===best.score)?'bank-statement':'unclassified'):
    best.score>0?best.kind:'unclassified';
  return {name:institution==='Unidentified provider'?names[category]:
    category==='bank-statement'?institution+' '+(accountType?accountType+' ':'')+'account':institution+' '+names[category],
    institution,category,accountType,confidence:!tied&&best.score>=2&&institution!=='Unidentified provider'?'matched-terms':'uncertain'};
}
/** Strong PII redaction for stored excerpts: never save full account/ID numbers. */
export function maskDocumentPII(text:string):string{
  return text
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email]')
    .replace(/(?:\+27|0)\d(?:[\s-]?\d){8,10}/g,'[phone]')
    .replace(/\b((?:account(?:\s+(?:number|no|nr|#))?|a\/c|acc|id(?:entity)?(?:\s+(?:number|no|nr))?|passport(?:\s+(?:number|no))?))\s*[:#-]?\s*((?:\d[\d\s-]{5,24}|[A-Z]{1,3}\d[\dA-Z\s-]{5,24}))\b/gi,
      (_whole,prefix:string)=>prefix+' [redacted identifier]')
    .replace(/\b\d(?:[\s-]?\d){7,18}\b/g,'[redacted number]')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi,'[link]')
    .replace(/[\x00-\x1f<>]/g,' ').replace(/\s+/g,' ').trim();
}
const factFields=new Set<DocumentFactField>([
  'statement-balance','settlement-quotation','original-principal','instalment',
  'previous-instalment','residual-value','annual-rate','net-pay','gross-pay','basic-pay',
  'paye','uif','total-deductions','pension','medical-aid','allowance','bonus',
  'overtime','amount-due','running-balance'
]);
export function isFactField(x:unknown):x is DocumentFactField{
  return typeof x==='string'&&factFields.has(x as DocumentFactField);
}
export function isDocumentCategory(x:unknown):x is DocumentCategory{
  return typeof x==='string'&&Object.prototype.hasOwnProperty.call(names,x);
}
export function safeAccountProfile(input:unknown):AccountProfile|null{
  if(!input||typeof input!=='object'||Array.isArray(input))return null;
  const v=input as Record<string,unknown>;
  if(typeof v.name!=='string'||v.name.length<3||v.name.length>80||
    /[0-9@<>]/.test(v.name)||typeof v.institution!=='string'||v.institution.length>40||
    /[0-9@<>]/.test(v.institution)||
    (v.accountType!==undefined&&(typeof v.accountType!=='string'||v.accountType.length>30||!/^(cheque|current|savings|transmission|transactional|credit card|business|unspecified)$/i.test(v.accountType)))||
    !isDocumentCategory(v.category)||
    !['matched-terms','uncertain'].includes(String(v.confidence))||
    !Array.isArray(v.facts)||v.facts.length>32)return null;
  const facts:DocumentFact[]=[];
  for(const o of v.facts){
    if(!o||typeof o!=='object'||Array.isArray(o))return null;
    const f=o as Record<string,unknown>;
    if(!isFactField(f.field)||f.historical!==true||
      (f.amount!==null&&(typeof f.amount!=='number'||!Number.isFinite(f.amount)||
        (f.amount<0&&!['statement-balance','running-balance'].includes(String(f.field)))||Math.abs(f.amount)>10_000_000))||
      (f.asOf!==null&&(typeof f.asOf!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(f.asOf)))||
      typeof f.sourceLabel!=='string'||f.sourceLabel.length>130||
      (f.ratePercent!==undefined&&(typeof f.ratePercent!=='number'||
        !Number.isFinite(f.ratePercent)||f.ratePercent<0||f.ratePercent>100)))return null;
    const fact:DocumentFact={field:f.field,amount:f.amount as number|null,
      asOf:f.asOf as string|null,sourceLabel:maskDocumentPII(f.sourceLabel),historical:true};
    if(f.ratePercent!==undefined)fact.ratePercent=f.ratePercent as number;
    facts.push(fact);
  }
  return {name:v.name,institution:v.institution,category:v.category,
    ...(typeof v.accountType==='string'?{accountType:v.accountType}:{}),
    confidence:v.confidence as AccountProfile['confidence'],facts};
}
export function makeAccountProfile(
  text:string,label:string,excerpts:ReadonlyArray<{
    label:string;amount:number|null;date:string|null;semanticField?:string;
    ratePercent?:number;runningBalance?:number;payrollField?:string
  }>
):AccountProfile{
  const info=classifyDocument(text);
  const facts:DocumentFact[]=[];
  for(const e of excerpts){
    let field:DocumentFactField|undefined=isFactField(e.payrollField)?e.payrollField:
      isFactField(e.semanticField)?e.semanticField:undefined;
    if(!field){
      const l=e.label.toLowerCase();
      if(/\b(?:closing balance|outstanding balance|statement balance)\b/.test(l))field='statement-balance';
      else if(/\b(?:net pay|take home pay)\b/.test(l))field='net-pay';
      else if(/\b(?:amount due|total due|payment due)\b/.test(l))field='amount-due';
    }
    if(!field || (e.amount===null&&e.ratePercent===undefined))continue;
    facts.push({field,amount:e.amount,asOf:e.date,
      sourceLabel:maskDocumentPII(e.label).slice(0,130),historical:true,
      ...(e.ratePercent===undefined?{}:{ratePercent:e.ratePercent})});
    if(facts.length>=31)break;
  }
  // A dated running balance is observation of that statement row, not a
  // current bank feed or a second transaction. Keep only the latest dated row.
  // Reverse order before stable sorting, so the last occurrence on the
  // latest date wins rather than the first entry from that same day.
  const observed=[...excerpts].reverse().filter(e=>
    typeof e.runningBalance==='number'&&Number.isFinite(e.runningBalance)&&
    typeof e.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(e.date))
    .sort((a,b)=>(b.date??'').localeCompare(a.date??''));
  if(observed.length&&facts.length<32){
    const latest=observed[0] as typeof observed[number]&{runningBalance:number};
    facts.push({field:'running-balance',amount:latest.runningBalance,
      asOf:latest.date,sourceLabel:'Running balance after dated transaction',
      historical:true});
  }
  return {...info,facts};
}
