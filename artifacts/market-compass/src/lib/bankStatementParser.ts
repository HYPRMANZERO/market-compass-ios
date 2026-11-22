/**
 * Conservative parsing for selectable-text bank statements where a row can
 * contain a transaction date, description, debit/credit and running balance.
 * Bank figures and dates remain historical, owner-reviewed evidence only.
 *
 * Example: "27 Mar 26 FEE: PAYSHAP PAYMENT -7.00 2,622.72"
 * => date=2026-03-27, amount=-7.00, runningBalance=2622.72.
 * Never import the running balance as an expense or infer missing dates.
 */
export type BankStatementLine={
  label:string;amount:number|null;date:string|null;
  direction:'incoming'|'outgoing'|'unclassified';
  semanticRole:'transaction'|'balance-reference';
  semanticField?:'statement-balance';
  runningBalance?:number;
};
const MONTHS:Record<string,number>={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,
  jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
const DATE=/\b(\d{1,2})(?:\s+|-)(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s+|-)(\d{2}|\d{4})\b|\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})\b|\b(\d{4})-(\d{2})-(\d{2})\b/i;
function yearOf(v:string):number{
  const n=Number(v);
  return v.length===4?n:n<=79?2000+n:1900+n;
}
/** Explicit dates, including South African bank statement "27 Mar 26". */
export function bankStatementDate(value:string):{date:string;matched:string}|null{
  const found=DATE.exec(value);
  if(!found)return null;
  let y:number,m:number,d:number;
  if(found[1]){d=+found[1];m=MONTHS[found[2].slice(0,3).toLowerCase()];y=yearOf(found[3]);}
  else if(found[4]){d=+found[4];m=+found[5];y=yearOf(found[6]);}
  else {y=+found[7];m=+found[8];d=+found[9];}
  if(!y||y<1900||y>2100||!m||m<1||m>12||!d||d>31)return null;
  const dt=new Date(Date.UTC(y,m-1,d));
  if(dt.getUTCFullYear()!==y||dt.getUTCMonth()!==m-1||dt.getUTCDate()!==d)return null;
  return {date:dt.toISOString().slice(0,10),matched:found[0]};
}
type NumberToken={raw:string;start:number;end:number};
const AMOUNTS=/(^|\s)([+-]?\(?\s*(?:R\s*)?(?:\d{1,3}(?:[ ,]\d{3})+|\d{1,9})[.,]\d{2}\)?)(?=$|\s)/gi;
/** ZAR amount with grouping, signed prefix and decimal dot/comma. */
export function statementMoney(input:string):number|null{
  let s=input.replace(/[\s\u00a0]/g,'').replace(/[Rr]/g,'');
  const bracketed=s.startsWith('(')&&s.endsWith(')');
  if(bracketed)s=s.slice(1,-1);
  const lastComma=s.lastIndexOf(','),lastDot=s.lastIndexOf('.');
  if(lastComma>lastDot)s=s.replace(/\./g,'').replace(',','.');
  else s=s.replace(/,/g,'');
  if(!/^[+-]?\d+(?:\.\d{2})$/.test(s))return null;
  const n=Number(s)*(bracketed?-1:1);
  return Number.isFinite(n)&&Math.abs(n)<=10_000_000?Math.round(n*100)/100:null;
}
function tokens(text:string):NumberToken[]{
  const found:NumberToken[]=[];AMOUNTS.lastIndex=0;
  for(const m of text.matchAll(AMOUNTS)){
    const raw=m[2].trim(),start=(m.index??0)+m[1].length;
    found.push({raw,start,end:start+m[2].length});
  }
  return found;
}
const BALANCE_ONLY=/\b(?:available balance|statement balance|opening balance|closing balance|balance brought forward|balance from previous statement|current balance)\b/i;
const HEADING=/\b(?:debit\s+credit\s+balance|transaction date\s+description|date\s+transaction\s+details)\b/i;
const VALID_DESCRIPTION=/[A-Za-z]{3,}/;
/**
 * Fail closed on ambiguous multi-amount lines instead of treating a balance
 * as a payment. A row without an explicit date is never a transaction.
 */
export function parseBankStatementRow(raw:string):BankStatementLine|null{
  // Preserve explicit PDF geometry: Date|Description|Payments|Deposits|Balance.
  // Deposits and payments are disjoint columns; do not guess direction from
  // an unsigned amount. The running balance is never the transaction amount.
  if(raw.startsWith('STDBANK|')){
    const cells=raw.split('|');
    if(cells.length!==6)return null;
    const [,dateText,desc,paymentText,depositText,balanceText]=cells;
    const cleaned=desc.replace(/\s+/g,' ').trim();
    const found=bankStatementDate(dateText);
    const balance=statementMoney(balanceText);
    if(balance===null)return null;
    if(!dateText.trim()&&!paymentText.trim()&&!depositText.trim()&&
       BALANCE_ONLY.test(cleaned)){
      return {label:cleaned.slice(0,130),amount:balance,date:null,
        direction:'unclassified',semanticRole:'balance-reference',
        semanticField:'statement-balance'};
    }
    if(!found||found.matched!==dateText.trim()||!VALID_DESCRIPTION.test(cleaned)||
       BALANCE_ONLY.test(cleaned)||Boolean(paymentText.trim())===Boolean(depositText.trim()))return null;
    const payment=paymentText.trim()!==''?statementMoney(paymentText):null;
    const deposit=depositText.trim()!==''?statementMoney(depositText):null;
    const amount=payment!==null?payment:deposit;
    if(amount===null||amount===0)return null;
    return {label:cleaned.slice(0,130),date:found.date,
      amount:payment!==null?-Math.abs(amount):Math.abs(amount),
      direction:payment!==null?'outgoing':'incoming',
      semanticRole:'transaction',runningBalance:balance};
  }
  const line=raw.replace(/[\t\u00a0]+/g,' ').replace(/\s+/g,' ').trim();
  if(line.length<7||line.length>1800||(HEADING.test(line)&&!BALANCE_ONLY.test(line)))return null;
  const date=bankStatementDate(line);
  const body=date?line.replace(date.matched,' ').replace(/\s+/g,' ').trim():line;
  const nums=tokens(BALANCE_ONLY.test(body)?body.replace(/:\s*/g,' '):body);
  if(BALANCE_ONLY.test(body)&&nums.length===1){
    const amount=statementMoney(nums[0].raw);
    if(amount===null)return null;
    return {label:body.slice(0,150),amount,date:date?.date??null,
      direction:'unclassified',semanticRole:'balance-reference',
      semanticField:'statement-balance'};
  }
  // An unidentified undated line cannot be backdated or counted as payment.
  if(!date||nums.length<1||nums.length>2)return null;
  const first=nums[0];
  const end=nums.at(-1)!;
  // Amount columns must be at the END of the row, not a reference in the middle.
  if(body.slice(end.end).trim()!=='')return null;
  if(nums.length===2&&body.slice(first.end,end.start).trim()!=='')return null;
  const description=body.slice(0,first.start).trim();
  if(!VALID_DESCRIPTION.test(description) || BALANCE_ONLY.test(description))return null;
  const amount=statementMoney(first.raw);
  if(amount===null||amount===0)return null;
  const result:BankStatementLine={
    label:description.slice(0,130),date:date.date,amount,
    direction:first.raw.trim().startsWith('-')||first.raw.trim().startsWith('(')?
      'outgoing':first.raw.trim().startsWith('+')?'incoming':'unclassified',
    semanticRole:'transaction'
  };
  if(nums.length===2){
    const runningBalance=statementMoney(end.raw);
    if(runningBalance===null)return null;
    result.runningBalance=runningBalance;
  }
  return result;
}
export function parseBankStatementText(text:string,maxLines=300):{lines:BankStatementLine[];truncated:boolean}{
  const rows=text.split(/\r?\n/),results:BankStatementLine[]=[];
  let truncated=false;
  for(const row of rows){
    const item=parseBankStatementRow(row);
    if(!item)continue;
    if(results.length>=maxLines){truncated=true;break;}
    results.push(item);
  }
  return {lines:results,truncated};
}
