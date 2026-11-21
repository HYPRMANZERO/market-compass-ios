/**
 * Shared input contract for locally imported statements and a future
 * separately-authorised, read-only bank connector.
 *
 * A feed can supply transaction facts, NOT an instruction to mutate the
 * encrypted spending ledger. Candidates are unapproved until owner review.
 * Source identifiers, credentials and full account numbers are NOT persisted.
 */
import {bankStatementDate,parseBankStatementText,type BankStatementLine} from './bankStatementParser.ts';
export type FinancialSource='bank-statement-pdf'|'bank-statement-text'|'bank-api-readonly';
export type FinancialDirection='incoming'|'outgoing'|'unclassified';
export type FinancialCandidate={
  source:FinancialSource;institution:string;accountLabel:string;
  /** ISO calendar date as present in the source; never inferred from import day */
  date:string;description:string;amount:number;currency:'ZAR';
  direction:FinancialDirection;runningBalance?:number;
  /** Reconciliation hint only: repeated identical entries may still be genuine. */
  matchHint:string;
  approval:'pending-owner-review';
  status:'posted'|'pending-bank';
};
export type ReadOnlyBankRow={
  date:string;description:string;amount:number;currency:string;
  runningBalance?:number;
  status:'posted'|'pending';
};
const ISO=/^\d{4}-\d{2}-\d{2}$/;
function dateOnly(value:string):string|null{
  if(!ISO.test(value))return null;
  const v=bankStatementDate(value);
  return v?.date===value?v.date:null;
}
const clean=(value:string,max:number)=>{
  return value.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[email]')
    .replace(/(?:\+27|0)\d(?:[\s-]?\d){8,10}/g,'[phone]')
    .replace(/\b\d(?:[\s-]?\d){7,18}\b/g,'[identifier]')
    .replace(/\b(?:account|a\/c|id(?:entity)?|passport)\s*(?:no\.?|number|nr\.?|#)?\s*[:#-]?\s*[0-9][0-9\s-]{5,22}\b/gi,'[identifier]')
    .replace(/[\x00-\x1f<>]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
};
const validAmount=(value:unknown):value is number=>typeof value==='number'&&
  Number.isFinite(value)&&value!==0&&Math.abs(value)<=10_000_000;
const validBalance=(value:unknown):value is number=>typeof value==='number'&&
  Number.isFinite(value)&&Math.abs(value)<=10_000_000;
const amountRound=(value:number)=>Math.round(value*100)/100;
function candidate(source:FinancialSource, institution:string, accountLabel:string,
  input:{date:string;description:string;amount:number;runningBalance?:number;status:'posted'|'pending-bank'}
):FinancialCandidate|null {
  const date=dateOnly(input.date);
  const description=clean(input.description,130);
  const safeInstitution=clean(institution,40).replace(/\d+/g,'').trim();
  const safeAccountLabel=clean(accountLabel,70);
  if(!date||!validAmount(input.amount)||description.length<3||
     safeInstitution.length<2||safeAccountLabel.length<3||
     safeAccountLabel!==accountLabel.trim()||/\d/.test(safeAccountLabel)||
     (input.runningBalance!==undefined&&!validBalance(input.runningBalance)))return null;
  const amount=amountRound(input.amount);
  const result:FinancialCandidate={
    source,institution:safeInstitution,accountLabel:safeAccountLabel,
    date,description,amount,currency:'ZAR',
    direction:amount<0?'outgoing':amount>0?'incoming':'unclassified',
    matchHint:[safeAccountLabel.toLowerCase(),date,description.toLowerCase(),amount.toFixed(2)].join('|'),
    approval:'pending-owner-review',status:input.status
  };
  if(input.runningBalance!==undefined)
    result.runningBalance=amountRound(input.runningBalance);
  return result;
}
/** PDF/TXT candidates from explicit dated rows only; labelled balances excluded. */
export function normalizeStatementCandidates(
  text:string,source:'bank-statement-pdf'|'bank-statement-text',
  institution:string,accountLabel:string,maxRows=300
):{candidates:FinancialCandidate[];unresolved:number;truncated:boolean}{
  const parsed=parseBankStatementText(text,maxRows);
  let unresolved=0;
  const candidates:FinancialCandidate[]=[];
  for(const row of parsed.lines){
    if(row.semanticRole!=='transaction'||!row.date||!validAmount(row.amount)){unresolved++;continue;}
    const v=candidate(source,institution,accountLabel,{
      date:row.date,description:row.label,amount:row.amount,
      runningBalance:row.runningBalance,status:'posted'
    });
    if(v)candidates.push(v);
    else unresolved++;
  }
  return {candidates,unresolved,truncated:parsed.truncated};
}
/**
 * Future bank connector boundary. A caller supplies rows only after separate
 * official read-only authorisation. No network, secrets or credential handling.
 * API source trust does not constitute owner approval or spending classification.
 */
export function normalizeReadOnlyBankRows(
  rows:readonly ReadOnlyBankRow[],institution:string,accountLabel:string
):{candidates:FinancialCandidate[];rejected:number}{
  const candidates:FinancialCandidate[]=[];let rejected=0;
  for(const row of rows){
    if(!row||row.currency!=='ZAR'||!['posted','pending'].includes(row.status)){
      rejected++;continue;
    }
    const v=candidate('bank-api-readonly',institution,accountLabel,{
      date:row.date,description:row.description,amount:row.amount,
      runningBalance:row.runningBalance,
      status:row.status==='pending'?'pending-bank':'posted'
    });
    if(v)candidates.push(v);else rejected++;
  }
  return {candidates,rejected};
}
