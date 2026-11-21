/**
 * Deterministic source-attributed answers from locally saved financial-file
 * excerpts. No prompts, models, network, bank reconciliation or financial
 * instructions; files remain within the encrypted iPhone workspace.
 */
import {validateLocalFinanceDocument,type LocalFinanceDocument} from './localFinanceDocs.ts';
const format=(x:number|null)=>x===null?'amount not identified':
  new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',
    minimumFractionDigits:2,maximumFractionDigits:2}).format(x);
const filler=new Set(['how','much','what','is','are','was','were','from','this',
  'that','the','my','me','for','about','show','tell','please','document','file',
  'files','imported','statement','payslip','report','record','recorded','in',
  'do','i','did','it','a','and','on','of','to','you','saved','an']);
const tokens=(value:string)=>value.toLowerCase().split(/[^a-z0-9]+/g)
  .filter(x=>x.length>=3&&!filler.has(x)).slice(0,10);
const evidenceNote='Owner-selected local document excerpt only. Not a complete statement or bank-verified, employer-verified or current balance. The original file was not sent to HYPRBOX or GitHub.';
export function answerFromOfflineFinanceDocs(
  raw:string, documents:LocalFinanceDocument[]|undefined|null
):string|null{
  if(typeof raw!=='string'||raw.trim().length<3||raw.length>500||
    !Array.isArray(documents)||documents.length===0)return null;
  const q=raw.toLowerCase().trim();
  const available=documents.map(validateLocalFinanceDocument)
    .filter((x):x is LocalFinanceDocument=>x!==null);
  if(!available.length)return null;
  const documentsIntent=/\b(payslips?|statements?|files?|documents?|imports?|exports?|receipts?|records?)\b/.test(q);
  const matches=available.filter(doc=>{
    const label=doc.label.toLowerCase();
    const words=tokens(label);
    return q.includes(label)||words.some(word=>q.includes(word));
  });
  if(!documentsIntent && matches.length===0)return null;
  if(/\b(how many|which|list|what|show)\b/.test(q)&&
     /\b(files|documents|imports|exports|records)\b/.test(q)&&
     !/\b(amount|cost|salary|pay|transaction|fee)\b/.test(q)){
    return 'Your encrypted iPhone workspace has '+available.length+
      ' owner-reviewed financial file'+(available.length===1?'':'s')+
      ': '+available.map(d=>d.label+' ('+d.lines.length+' excerpts)').join('; ')+
      '. '+evidenceNote;
  }
  const selected=matches.length?matches:(documentsIntent?available.slice(-1):[]);
  if(!selected.length)return null;
  const details=tokens(q);
  const lines=selected.flatMap(doc=>doc.lines.map(line=>({doc,line})));
  const ranked=lines.map(x=>({
    ...x,score:details.filter(t=>x.line.label.toLowerCase().includes(t)||
      (x.line.date??'').includes(t)).length
  })).sort((a,b)=>b.score-a.score);
  const relevant=ranked.some(x=>x.score>0)?ranked.filter(x=>x.score>0):ranked;
  const displayed=relevant.slice(0,5);
  if(!displayed.length)return null;
  const note=displayed.map(x=>x.doc.label+' · '+(x.line.date??'date not identified')+
    ' · '+x.line.label+' · '+format(x.line.amount)+
    (x.line.direction==='unclassified'?' · direction unknown':' · '+x.line.direction)).join('; ');
  const totalMore=relevant.length>displayed.length?
    ' There are '+(relevant.length-displayed.length)+' additional matching excerpts not shown in this short answer.':'';
  return 'I found these reviewed excerpts on this iPhone: '+note+'.'+totalMore+
    ' '+evidenceNote;
}
