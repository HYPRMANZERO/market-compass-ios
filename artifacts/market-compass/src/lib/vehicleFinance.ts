/**
 * Conservative, local, deterministic classification of vehicle-finance PDF text.
 * Does not use AI, network access, raw PDF persistence, or inferred transactions.
 * A contractual instalment, settlement quote, or statement balance is never
 * evidence that a payment occurred. All matches require owner review.
 */
export type FinanceDocumentKind='absa-vehicle-finance'|'vehicle-finance'|'unclassified';
export type FinanceRole='contract-term'|'balance-reference'|'rate-reference'|'transaction'|'unclassified';
export type FinanceField='original-principal'|'previous-instalment'|'instalment'|
  'residual-value'|'settlement-quotation'|'statement-balance'|'annual-rate'|'completed-payment';
export type FinanceLine={
  label:string;amount:number|null;date:string|null;direction:'unclassified';
  semanticRole:FinanceRole;semanticField?:FinanceField;ratePercent?:number;
};
const section=/(?:\b(?:vehicle (?:asset )?finance|vehicle instalment|vehicle installment|instalment sale|installment sale|amount financed|original amount financed|residual value|settlement value|current instalment amount|current installment amount)\b)/i;
export function detectFinanceDocument(text:string,hint=''):FinanceDocumentKind {
  const joined=(text+'\n'+hint).slice(0,200_000);
  const source=/\babsa\b/i.test(joined);
  const terms=[
    /\b(?:vehicle finance|vehicle asset finance|instalment sale|installment sale)\b/i,
    /\b(?:original amount financed|amount financed)\b/i,
    /\b(?:current|new|old|previous)\s+instal(?:ment|lment)/i,
    /\b(?:residual value|settlement value|settlement amount)\b/i
  ].filter(r=>r.test(joined)).length;
  if(terms<2 || !section.test(joined))return 'unclassified';
  return source?'absa-vehicle-finance':'vehicle-finance';
}
const specs: {field:FinanceField;role:FinanceRole;match:RegExp}[]=[
  {field:'original-principal',role:'contract-term',match:/\b(?:original amount financed|amount originally financed|principal financed)\b/i},
  {field:'residual-value',role:'contract-term',match:/\b(?:residual value|balloon payment|guaranteed future value)\b/i},
  {field:'previous-instalment',role:'contract-term',match:/\b(?:old|previous|prior)\s+instal(?:ment|lment)/i},
  {field:'instalment',role:'contract-term',match:/\b(?:current|new|revised|monthly)\s+instal(?:ment|lment)|\binstalment amount\b|\binstallment amount\b/i},
  {field:'settlement-quotation',role:'balance-reference',match:/\b(?:settlement value|settlement amount|settlement quotation|settlement figure)\b/i},
  {field:'statement-balance',role:'balance-reference',match:/\b(?:balance from previous statement|outstanding balance|balance brought forward|closing balance)\b/i},
  {field:'annual-rate',role:'rate-reference',match:/\b(?:interest rate|annual rate|rate of interest|prime lending rate|annual percentage rate|apr)\b/i},
  {field:'completed-payment',role:'transaction',match:/\b(?:payment received|payment processed|payment made|paid on|debit order collected|debit order paid|receipt of payment)\b/i}
];
const normalize=(s:string)=>s.replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
const splitKnownFields=(s:string)=>s.replace(/\s+(?=(?:original amount financed|amount originally financed|current instalment amount|current installment amount|new instalment|new installment|old instalment|old installment|previous instalment|previous installment|residual value|settlement value|current settlement value|balance from previous statement|outstanding balance|interest rate|annual percentage rate|payment received)\b)/gi,'\n');
const month:{[key:string]:number}={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const dateFound=(text:string):string|null=>{
  const match=text.match(/\b(\d{4})-(\d{2})-(\d{2})\b|\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b|\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/i);
  if(!match)return null;
  let y:number,m:number,d:number;
  if(match[1]){y=+match[1];m=+match[2];d=+match[3];}
  else if(match[4]){y=+match[6];m=+match[5];d=+match[4];}
  else {y=+match[9];m=month[match[8].slice(0,3).toLowerCase()];d=+match[7];}
  const t=new Date(Date.UTC(y,m-1,d));
  return y>=2000&&y<=2100&&t.getUTCFullYear()===y&&t.getUTCMonth()===m-1&&t.getUTCDate()===d?
    String(y)+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'):null;
};
const monetary=/\b(?:ZAR|R)\s*((?:\d{1,3}(?:[ ,]\d{3})+|\d{1,10})(?:[.,]\d{2})?)\b/gi;
const amountFrom=(text:string):number|null=>{
  const matches=[...text.matchAll(monetary)].map(x=>x[1]);
  if(matches.length!==1)return null; // One source row with 2 amounts is ambiguous.
  let amount=matches[0].replace(/\s/g,'');
  const comma=amount.lastIndexOf(','),dot=amount.lastIndexOf('.');
  if(comma>=0&&dot>=0){
    amount=comma>dot?amount.replace(/\./g,'').replace(',','.'):amount.replace(/,/g,'');
  } else if(comma>=0){
    amount=amount.replace(',','.');
  }
  const n=Number(amount);
  return Number.isFinite(n)&&n>=0&&n<=10_000_000?Math.round(n*100)/100:null;
};
const percentFrom=(s:string):number|undefined=>{
  const m=s.match(/(?:\b(?:rate|interest|apr)\b[^%]{0,50})?(\d{1,2}(?:[.,]\d{1,3})?)\s*%/i);
  if(!m)return undefined;
  const n=Number(m[1].replace(',','.'));
  return Number.isFinite(n)&&n>=0&&n<=100?n:undefined;
};
/** Preserve only bounded finance fields; raw identifying text is masked by caller. */
export function extractVehicleFinanceLines(text:string):FinanceLine[]{
  const results:FinanceLine[]=[];
  const rows=splitKnownFields(text).split(/\r?\n/).slice(0,1600);
  for(const raw of rows){
    const label=normalize(raw);
    if(label.length<5)continue;
    const spec=specs.find(x=>x.match.test(label));
    if(!spec)continue;
    const isRate=spec.role==='rate-reference';
    const amount=isRate?null:amountFrom(label);
    const ratePercent=isRate?percentFrom(label):undefined;
    if(amount===null&&ratePercent===undefined)continue;
    const item:FinanceLine={
      label:label.slice(0,130),amount,date:dateFound(label),
      direction:'unclassified',semanticRole:spec.role,semanticField:spec.field
    };
    if(ratePercent!==undefined)item.ratePercent=ratePercent;
    results.push(item);
    if(results.length>=61)break;
  }
  return results;
}
/** Existing imported items without semanticRole also need protection. */
export function isFinanceReferenceLabel(label:string):boolean{
  const role=specs.find(x=>x.match.test(label))?.role;
  return role==='contract-term'||role==='balance-reference'||role==='rate-reference';
}
