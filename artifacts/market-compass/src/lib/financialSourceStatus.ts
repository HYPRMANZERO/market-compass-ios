/** Read-only provenance snapshots for the encrypted local workspace.
 * An import timestamp, source reporting date and approved transaction date
 * describe different events. None establishes a live bank balance.
 */
import {documentTimeContext} from './documentTimeContext.ts';
import type {LocalFinanceDocument} from './localFinanceDocs.ts';
import type {ExpenseEntry} from './monthlyExpenses.ts';

export type FinancialSourceStatus={
  latestApprovedDay:string|null;
  latestReportedDay:string|null;
  latestImportedDay:string|null;
  approvedCount:number;
  documentCount:number;
  futureApprovedCount:number;
  futureDocumentCount:number;
  daysSinceReport:number|null;
  bankConnected:false;
};
function validDay(day:unknown):string|null{
  if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
  const d=new Date(day+'T12:00:00Z');
  return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===day?day:null;
}
function importDay(value:unknown):string|null{
  if(typeof value!=='string')return null;
  const date=new Date(value);
  return Number.isFinite(date.getTime())?validDay(date.toISOString().slice(0,10)):null;
}
function newest(days:Array<string|null>):string|null{
  const known=days.filter((v):v is string=>v!==null);
  return known.length?known.sort().at(-1)!:null;
}
function age(day:string|null,today:string):number|null{
  if(!day)return null;
  return Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(day+'T12:00:00Z'))/86400000);
}
/** No network access, storage writes, or assumptions about bank connectivity. */
export function financialSourceStatus(
  entries:readonly ExpenseEntry[],
  documents:readonly LocalFinanceDocument[],
  today:string
):FinancialSourceStatus{
  const asOf=validDay(today);
  if(!asOf)throw Error('Invalid source review date');
  const safeEntries=Array.isArray(entries)?entries:[];
  const safeDocs=Array.isArray(documents)?documents:[];
  const ledgerDays=safeEntries.map(e=>validDay(e?.date));
  const documentDays=safeDocs.map(d=>{
    if(!d||!Array.isArray(d.lines))return null;
    const range=d.timeContext??documentTimeContext('',d.lines);
    return validDay(range?.to)??validDay(range?.asOf);
  });
  const importedDays=safeDocs.map(d=>importDay(d?.importedAt));
  const past=(days:Array<string|null>)=>days.filter((d):d is string=>d!==null&&d<=asOf);
  const latestReportedDay=newest(past(documentDays));
  return {
    latestApprovedDay:newest(past(ledgerDays)),
    latestReportedDay,
    latestImportedDay:newest(past(importedDays)),
    approvedCount:safeEntries.length,
    documentCount:safeDocs.length,
    futureApprovedCount:ledgerDays.filter(d=>d!==null&&d>asOf).length,
    futureDocumentCount:documentDays.filter(d=>d!==null&&d>asOf).length,
    daysSinceReport:age(latestReportedDay,asOf),
    bankConnected:false
  };
}
