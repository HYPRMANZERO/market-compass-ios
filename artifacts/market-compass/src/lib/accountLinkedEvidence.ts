/**
 * Read-only account provenance summary for owner-approved Spend entries.
 * Linked transaction dates are historical evidence, NEVER a date proving
 * the separately entered Debt Plan balance, bank sync or reconciliation.
 * Bad/future-dated rows remain untouched and surface as review warnings.
 */
import type {ExpenseEntry} from './monthlyExpenses.ts';

export type AccountLinkedEvidence={
  latestTransactionDay:string|null;
  approvedLinkedCount:number;
  futureDatedCount:number;
  invalidDatedCount:number;
  otherCurrencyCount:number;
  recentEntries:ExpenseEntry[];
};

function validDay(value:unknown):value is string{
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const date=new Date(value+'T12:00:00Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;
}
const goodAmount=(entry:ExpenseEntry)=>
  typeof entry.amount==='number'&&Number.isFinite(entry.amount)&&entry.amount>0;
const goodKind=(entry:ExpenseEntry)=>
  ['income','expense','debt-payment','transfer'].includes(entry.kind);

export function accountLinkedEvidence(
  entries:readonly ExpenseEntry[],accountId:string,currency:string,today:string
):AccountLinkedEvidence{
  if(!validDay(today))throw Error('Invalid local account review day');
  const result:AccountLinkedEvidence={
    latestTransactionDay:null,approvedLinkedCount:0,
    futureDatedCount:0,invalidDatedCount:0,otherCurrencyCount:0,recentEntries:[]
  };
  if(!accountId||!Array.isArray(entries))return result;
  const eligible:ExpenseEntry[]=[];
  for(const entry of entries){
    if(!entry||entry.debtAccountId!==accountId)continue;
    if(entry.currency!==currency){result.otherCurrencyCount++;continue;}
    if(!validDay(entry.date)||!goodAmount(entry)||!goodKind(entry)){
      result.invalidDatedCount++;continue;
    }
    if(entry.date>today){result.futureDatedCount++;continue;}
    eligible.push(entry);
  }
  eligible.sort((a,b)=>b.date.localeCompare(a.date)||b.recordedAt.localeCompare(a.recordedAt));
  result.approvedLinkedCount=eligible.length;
  result.latestTransactionDay=eligible[0]?.date??null;
  result.recentEntries=eligible.slice(0,5);
  return result;
}
