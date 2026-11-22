/**
 * Conservative South African payslip evidence extraction, not a bank ledger.
 * No raw employee/employer names, account/ID numbers or full PDF stored here.
 * Figures are historical payroll references; a payslip is not proof of deposit.
 */
export const PAYROLL_FIELDS=[
  'gross-pay','net-pay','basic-pay','paye','uif','total-deductions',
  'pension','medical-aid','allowance','bonus','overtime'
] as const;
export type PayrollField=typeof PAYROLL_FIELDS[number];
export type PayrollEvidence={
  field:PayrollField; amount:number; date:string|null;
  label:string; direction:'unclassified';semanticRole:'balance-reference';
  payrollField:PayrollField
};
const rules:ReadonlyArray<[PayrollField,RegExp]>=[
  ['net-pay',/^(?:net(?:\s+(?:pay|salary|earnings|remuneration))?|take[\s-]?home(?:\s+pay)?|amount\s+(?:paid|payable)\s+to\s+employee|net\s+payable)\b/i],
  ['gross-pay',/^(?:gross(?:\s+(?:pay|salary|earnings|remuneration))?|total\s+(?:gross\s+)?earnings|total\s+remuneration)\b/i],
  ['total-deductions',/^total\s+(?:employee\s+)?deductions?\b/i],
  ['paye',/^(?:paye|pay\s+as\s+you\s+earn|employee(?:s)?\s+tax|income\s+tax\s+deducted)\b/i],
  ['uif',/^(?:employee\s+)?uif(?:\s+contribution)?\b/i],
  ['basic-pay',/^(?:basic\s+(?:salary|pay|wage)|ordinary\s+pay)\b/i],
  ['pension',/^(?:pension|retirement|provident)(?:\s+(?:fund|contribution))?\b/i],
  ['medical-aid',/^(?:medical\s+aid|medical\s+scheme)(?:\s+contribution)?\b/i],
  ['allowance',/^(?:travel|housing|transport|cellphone|phone|subsistence)\s+allowance\b/i],
  ['bonus',/^(?:bonus|performance\s+bonus|incentive|commission)\b/i],
  ['overtime',/^overtime(?:\s+(?:pay|hours?\s+paid))?\b/i]
];
const iso=(value:string):string|null=>{
 const t=value.trim();
 const direct=t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
 const dm=t.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
 const year=direct?.[1]??dm?.[3],month=direct?.[2]??dm?.[2]?.padStart(2,'0'),
   day=direct?.[3]??dm?.[1]?.padStart(2,'0');
 if(!year||!month||!day)return null;
 const candidate=year+'-'+month+'-'+day;
 const date=new Date(candidate+'T00:00:00Z');
 return Number.isFinite(date.valueOf())&&date.toISOString().slice(0,10)===candidate?candidate:null;
};
const months:Record<string,number>={
 january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,
 september:9,october:10,november:11,december:12
};
export function payrollPeriodDate(text:string):string|null{
 const head=text.slice(0,16000);
 const labelled=head.match(/\b(?:payment\s+date|pay\s+date|date\s+paid|period\s+ending|period\s+end|payroll\s+date)\b\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/i);
 if(labelled)return iso(labelled[1]);
 const range=head.match(/\b(?:pay\s+period|salary\s+period|period\s+(?:covered|from))\s*[:\-]?\s*(?:\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})\s*(?:to|through|until|\-)\s*(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})/i);
 if(range)return iso(range[1]);
 const month=head.match(/\b(?:payroll\s+period|pay\s+period|salary\s+month|month\s+of|period\s+for)\s*[:\-]?\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i);
 if(month){
  const y=Number(month[2]),m=months[month[1].toLowerCase()];
  if(y<2000||y>2100)return null;
  return new Date(Date.UTC(y,m,0)).toISOString().slice(0,10);
 }
 return null;
}
const amount=(raw:string):number|null=>{
 let s=raw.trim().replace(/^(?:R|ZAR)\s*/i,'').replace(/\s/g,'');
 const bracket=s.startsWith('(')&&s.endsWith(')');
 if(bracket)s=s.slice(1,-1);
 if(/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(s))s=s.replace(/\./g,'').replace(',','.');
 else if(/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(s))s=s.replace(/,/g,'');
 else if(/^\d+,\d{2}$/.test(s))s=s.replace(',','.');
 if(!/^\d+(?:\.\d{1,2})?$/.test(s))return null;
 const v=Number(s);
 return Number.isFinite(v)&&v>=0&&v<=10_000_000?Math.round(v*100)/100:null;
};
const moneyToken=/(?:R\s*|ZAR\s*)?(?:\d{1,3}(?:[ ,]\d{3})+|\d+)(?:[.,]\d{2})/gi;
export function extractPayslipEvidence(text:string):{date:string|null;items:PayrollEvidence[];ambiguous:number}{
 if(typeof text!=='string')throw Error('Invalid payslip contents');
 const date=payrollPeriodDate(text);
 const results=new Map<PayrollField,PayrollEvidence>();
 let ambiguous=0;
 for(const raw of text.split(/\r?\n/).slice(0,12000)){
  const line=raw.replace(/\t/g,' ').replace(/\s+/g,' ').trim();
  if(!line||line.length>240||/\b(?:ytd|year\s*to\s*date|annual|employer\s+contribution)\b/i.test(line))continue;
  const entry=rules.find(([,rule])=>rule.test(line));
  if(!entry)continue;
  const [field,rule]=entry;
  const labelMatch=line.match(rule);
  if(!labelMatch)continue;
  const rest=line.slice(labelMatch[0].length).replace(/^[\s:=-]+/,'').trim();
  const values=[...rest.matchAll(moneyToken)];
  // A column containing "Current" and "YTD" is ambiguous without geometry.
  // Do not guess which monetary column belongs to this pay period.
  if(values.length!==1){ambiguous++;continue;}
  const v=amount(values[0][0]);
  if(v===null||values[0].index!==0&&/[A-Za-z0-9]/.test(rest.slice(0,values[0].index))){ambiguous++;continue;}
  if(results.has(field)){ambiguous++;results.delete(field);continue;}
  results.set(field,{field,amount:v,date,label:field.replaceAll('-',' '),
    direction:'unclassified',semanticRole:'balance-reference',payrollField:field});
 }
 return {date,items:[...results.values()],ambiguous};
}
