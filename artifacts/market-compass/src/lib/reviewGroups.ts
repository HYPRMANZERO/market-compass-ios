import type {InboxDocument} from './reviewInbox.ts';
/** Group saved local evidence by *import* month, not a transaction date. */
export function groupedDocumentReview(items:InboxDocument[]){
  const groups=new Map<string,InboxDocument[]>();
  for(const item of Array.isArray(items)?items:[]){
    if(!item||typeof item.id!=='string')continue;
    const month=typeof item.importedAt==='string'&&/^\d{4}-\d{2}-\d{2}/.test(item.importedAt)
      ? item.importedAt.slice(0,7):'Unknown import date';
    groups.set(month,[...(groups.get(month)||[]),item]);
  }
  return [...groups].sort(([a],[b])=>b.localeCompare(a)).map(([month,documents])=>({
    month,documents,needsReview:documents.reduce((n,d)=>n+d.needsReview,0),
    approved:documents.reduce((n,d)=>n+d.approved,0)
  }));
}
