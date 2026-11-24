/**
 * Source-dated time context. A statement reporting period dates the DOCUMENT,
 * never an undated payment or a current balance. Only explicit header dates
 * or valid, preserved row dates are used.
 */
import {bankStatementDate} from './bankStatementParser.ts';
export type DocumentTimeContext={
 from:string|null; to:string|null; asOf:string|null;
 basis:'explicit-period'|'dated-rows'|'explicit-as-of';
};
const DT=String.raw`(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[./]\d{1,2}[./]\d{2,4}|\d{1,2}\s+[a-z]{3,9}\s+\d{2,4})`;
function explicitDate(text:string):string|null{
 const value=text.trim();
 const parsed=bankStatementDate(value);
 return parsed&&parsed.matched.toLowerCase()===value.toLowerCase()?parsed.date:null;
}
export function documentTimeContext(
 text:string,lines:ReadonlyArray<{date:string|null}>
):DocumentTimeContext|null{
 const dates=(Array.isArray(lines)?lines:[]).map(x=>x?.date||'')
   .filter((value):value is string=>typeof value==='string'&&explicitDate(value)===value)
   .sort();
 const rows=dates.length?{from:dates[0],to:dates.at(-1)!}:null;
 let explicit:{from:string;to:string}|null=null;
 let asOf:string|null=null;
 const headerLines=String(text).split(/\r?\n/).slice(0,180);
 const period=new RegExp(String.raw`\b(?:statement period|reporting period|billing period|period covered|pay period|period from)\s*[:\-]?\s*(`+DT+String.raw`)\s*(?:to|through|until|–|—|\s+-\s+)\s*(`+DT+String.raw`)`,'i');
 const asOfPattern=new RegExp(String.raw`\b(?:statement date|report date|as at|as of|balance as at|closing date|payment date|pay date|issue date)\s*[:\-]?\s*(`+DT+String.raw`)`,'i');
 for(const line of headerLines){
   if(!explicit){
     const match=period.exec(line);
     if(match){
       const start=explicitDate(match[1]),end=explicitDate(match[2]);
       if(start&&end&&start<=end)explicit={from:start,to:end};
     }
   }
   if(!asOf){
     const match=asOfPattern.exec(line);
     if(match)asOf=explicitDate(match[1]);
   }
   if(explicit&&asOf)break;
 }
 if(explicit)return {...explicit,asOf,basis:'explicit-period'};
 if(rows)return {...rows,asOf,basis:'dated-rows'};
 return asOf?{from:null,to:null,asOf,basis:'explicit-as-of'}:null;
}
/**
 * Preserve only normalized date evidence in the encrypted vault.
 * Reject forged or structurally inconsistent reporting dates during import.
 * These dates describe source coverage; they never fill missing transaction dates.
 */
export function validatedDocumentTimeContext(input:unknown):DocumentTimeContext|null{
 if(!input||typeof input!=='object'||Array.isArray(input))return null;
 const value=input as Record<string,unknown>;
 const iso=(v:unknown):v is string=>{
   if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
   const when=new Date(v+'T12:00:00Z');
   return Number.isFinite(when.getTime())&&when.toISOString().slice(0,10)===v;
 };
 const nullable=(v:unknown)=>v===null||iso(v);
 if(!nullable(value.from)||!nullable(value.to)||!nullable(value.asOf))return null;
 const from=value.from as string|null,to=value.to as string|null,asOf=value.asOf as string|null;
 if((from===null)!==(to===null)|| (from&&to&&from>to))return null;
 const basis=value.basis;
 if(basis==='explicit-as-of'){
   if(from!==null||to!==null||asOf===null)return null;
 }else if(basis==='explicit-period'||basis==='dated-rows'){
   if(from===null||to===null)return null;
 }else return null;
 return {from,to,asOf,basis};
}

/** UI-only summary for saved excerpts; source bytes are not retained. */
export function sourceTimeContext(document:{lines:ReadonlyArray<{date:string|null}>;timeContext?:DocumentTimeContext}):DocumentTimeContext|null{
 return document.timeContext??documentTimeContext('',document.lines);
}
export function timeContextLabel(value:DocumentTimeContext|null|undefined):string{
 if(!value)return 'No source period identified';
 if(value.from&&value.to&&value.from!==value.to)return value.from+' to '+value.to;
 if(value.from)return value.from;
 return value.asOf?'As of '+value.asOf:'No source period identified';
}
