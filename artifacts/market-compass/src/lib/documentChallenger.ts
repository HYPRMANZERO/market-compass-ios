/** A second opinion on document type from an exported, synthetic-only scikit-learn model.
 * This classifier sees ONLY already-extracted browser-local labels, never stored
 * raw files or passwords. It cannot change the deterministic document parser,
 * dates, transaction direction, amounts, deduplication, account balances or
 * owner's final approval decision. Never interpret softmax as verified accuracy.
 */
import {SYNTHETIC_DOCUMENT_CLASSIFIER as MODEL} from './syntheticDocumentClassifier.ts';
import type {DocumentCategory} from './documentIntelligence.ts';
import type {LocalFinanceDocument} from './localFinanceDocs.ts';
export type DocumentChallengerVerdict={
 status:'insufficient'|'agrees'|'disagrees'|'proposal';
 suggested:DocumentCategory|null;
 syntheticConfidence:number|null;
 syntheticOnly:true;
 explanation:string;
};
const FALLBACK:DocumentChallengerVerdict={
 status:'insufficient',suggested:null,syntheticConfidence:null,syntheticOnly:true,
 explanation:'Independent synthetic classifier has insufficient evidence; review the original extracted document facts.'
};
const allowed=new Set<DocumentCategory>([
 'bank-statement','vehicle-finance','payslip','credit-card','personal-loan','mortgage',
 'utility-bill','invoice','receipt','investment-statement','tax-document','unclassified'
]);
type Source=Pick<LocalFinanceDocument,'label'|'lines'|'accountProfile'>;
export function reviewDocumentClassification(doc:Source):DocumentChallengerVerdict {
 if(!MODEL || MODEL.schema!=='market-compass-document-challenger-v1'||
   MODEL.trainedOnPersonalDocuments!==false||MODEL.canApproveTransactions!==false||
   MODEL.canOverwriteDatesOrAmounts!==false||MODEL.classes.length!==MODEL.coefficients.length||
   MODEL.classes.length!==MODEL.intercepts.length||MODEL.maxInputChars>1800)
   return FALLBACK;
 // No accountProfile, detected category, source amounts, dates, passwords,
 // private server call, or document bytes are supplied to the challenger.
 const title=doc.label.replace(/\b\d[\d\s./-]{5,}\b/g,' ');
 const labels=doc.lines.slice(0,24).map(x=>x.label).join(' ');
 const raw=(title+' '+labels).slice(0,MODEL.maxInputChars).toLowerCase();
 const words=raw.match(/[a-z0-9]{2,}/g)??[];
 if(words.length<4)return FALLBACK;
 const active=new Set<string>();
 for(let i=0;i<words.length;i++){
   active.add(words[i]);
   if(i+1<words.length)active.add(words[i]+' '+words[i+1]);
 }
 const vocabulary=MODEL.vocabulary as Record<string,number>;
 const indices=[...active].map(token=>vocabulary[token]).filter((x):x is number=>
   typeof x==='number'&&Number.isInteger(x)&&x>=0&&x<MODEL.coefficients[0].length);
 if(indices.length<2)return FALLBACK;
 const logits=MODEL.classes.map((_,k)=>MODEL.intercepts[k]+indices.reduce((sum,i)=>sum+MODEL.coefficients[k][i],0));
 if(logits.some(x=>!Number.isFinite(x)))return FALLBACK;
 const max=Math.max(...logits);
 const exp=logits.map(x=>Math.exp(x-max));
 const total=exp.reduce((a,b)=>a+b,0);
 if(!Number.isFinite(total)||total<=0)return FALLBACK;
 const ranked=exp.map((x,i)=>({candidate:MODEL.classes[i] as DocumentCategory,p:x/total}))
   .sort((a,b)=>b.p-a.p);
 const top=ranked[0],runner=ranked[1];
 if(!allowed.has(top.candidate)||top.p<MODEL.approvalThreshold||
   top.p-runner.p<.25)return FALLBACK;
 const current=doc.accountProfile?.category??'unclassified';
 const syntheticConfidence=Math.round(top.p*1000)/1000;
 if(current===top.candidate)
   return {status:'agrees',suggested:top.candidate,syntheticConfidence,syntheticOnly:true,
     explanation:'An independent synthetic-only text classifier agrees with the original document-type rule; this does not verify its accuracy.'};
 if(current==='unclassified')
   return {status:'proposal',suggested:top.candidate,syntheticConfidence,syntheticOnly:true,
     explanation:'Possible type from a synthetic-only second opinion. Inspect the original document; no category is changed automatically.'};
 return {status:'disagrees',suggested:top.candidate,syntheticConfidence,syntheticOnly:true,
   explanation:'Independent synthetic-only second opinion differs from document classification. Verify the source manually before approval.'};
}
