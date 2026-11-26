/** Account links must be explicit. Never infer a bank account from merchant text. */
import type {ExpenseEntry} from './monthlyExpenses.ts';
export type HistoryAccount={id:string;name:string};
export type AccountHistoryGroup={id:string;name:string;entries:ExpenseEntry[];outflow:number;inflow:number};
const isDated=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&
  !Number.isNaN(Date.parse(date+'T00:00:00Z'))&&
  new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
export function accountTransactionHistory(
  accounts:HistoryAccount[],entries:ExpenseEntry[],currency:string
):{groups:AccountHistoryGroup[];unlinked:ExpenseEntry[]}{
  const known=new Set(accounts.map(a=>a.id));
  const eligible=(Array.isArray(entries)?entries:[]).filter(e=>e&&
    e.currency===currency&&isDated(e.date)&&Number.isFinite(e.amount)&&e.amount>0);
  const ordered=[...eligible].sort((a,b)=>b.date.localeCompare(a.date)||b.recordedAt.localeCompare(a.recordedAt));
  const groups=accounts.map(a=>{
    const rows=ordered.filter(e=>e.debtAccountId===a.id);
    return {id:a.id,name:a.name,entries:rows,
      inflow:rows.filter(e=>e.kind==='income').reduce((n,e)=>n+e.amount,0),
      outflow:rows.filter(e=>e.kind==='expense'||e.kind==='debt-payment').reduce((n,e)=>n+e.amount,0)};
  });
  return {groups,unlinked:ordered.filter(e=>!e.debtAccountId||!known.has(e.debtAccountId))};
}
