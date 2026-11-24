import type {InboxDocument} from './reviewInbox.ts';
import {validatedDocumentTimeContext} from './documentTimeContext.ts';

type SourceGroupBasis='source-period'|'as-of'|'imported'|'unknown';
type GroupInfo={month:string;basis:SourceGroupBasis;sortDate:string};

function sourceGroup(item:InboxDocument):GroupInfo{
  // Revalidate even the read-only summary: malformed dates never label
  // old statement evidence as a verified financial reporting period.
  const period=validatedDocumentTimeContext(item.timeContext);
  if(period?.from&&period.to){
    const start=period.from.slice(0,7),end=period.to.slice(0,7);
    return {month:start===end?start:start+' to '+end,
      basis:'source-period',sortDate:period.to};
  }
  if(period?.asOf){
    return {month:'As of '+period.asOf.slice(0,7),
      basis:'as-of',sortDate:period.asOf};
  }
  // A file import date describes only the import event. Do not silently
  // substitute it for an undated payment, salary date or statement period.
  if(typeof item.importedAt==='string'&&/^\d{4}-\d{2}-\d{2}/.test(item.importedAt)){
    return {month:'Imported '+item.importedAt.slice(0,7),
      basis:'imported',sortDate:item.importedAt.slice(0,10)};
  }
  return {month:'Unknown source and import period',basis:'unknown',sortDate:''};
}

/** Group source-dated evidence by its actual period, not the upload month.
 * Preserve legacy imports in a visibly separate import-date fallback.
 * No grouped item is a payment, approval or live financial balance.
 */
export function groupedDocumentReview(items:InboxDocument[]){
  const groups=new Map<string,{info:GroupInfo;documents:InboxDocument[]}>();
  for(const item of Array.isArray(items)?items:[]){
    if(!item||typeof item.id!=='string')continue;
    const info=sourceGroup(item);
    const key=info.basis+':'+info.month;
    const group=groups.get(key);
    if(group)group.documents.push(item);
    else groups.set(key,{info,documents:[item]});
  }
  const rank:Record<SourceGroupBasis,number>={
    'source-period':0,'as-of':1,'imported':2,'unknown':3
  };
  return [...groups.values()]
    .sort((a,b)=>rank[a.info.basis]-rank[b.info.basis]||
      b.info.sortDate.localeCompare(a.info.sortDate)||
      a.info.month.localeCompare(b.info.month))
    .map(({info,documents})=>({
      month:info.month,basis:info.basis,documents,
      needsReview:documents.reduce((n,item)=>n+item.needsReview,0),
      approved:documents.reduce((n,item)=>n+item.approved,0)
    }));
}
