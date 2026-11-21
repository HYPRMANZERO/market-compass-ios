import {useState} from 'react';
import type {LocalFinanceDocument} from '@/lib/localFinanceDocs';
import {makeAccountProfile,maskDocumentPII,type DocumentFact} from '@/lib/documentIntelligence';

type Account={name:string;balance:string;apr:string;minimumPayment:string};
type Props={
  documents:LocalFinanceDocument[];
  existingAccounts:Account[];
  currency:string;
  onCreate:(account:Account)=>void;
};
const money=(n:number,currency:string)=>new Intl.NumberFormat('en-ZA',{
  style:'currency',currency,maximumFractionDigits:2
}).format(n);
const fieldNames:Record<DocumentFact['field'],string>={
  'statement-balance':'Statement/reference balance','settlement-quotation':'Settlement quotation',
  'original-principal':'Original amount financed',
  'instalment':'Contractual monthly instalment','previous-instalment':'Previous instalment',
  'residual-value':'Residual/balloon value','annual-rate':'Quoted annual interest',
  'net-pay':'Net pay','amount-due':'Amount due',
  'running-balance':'Last dated running balance (historical)'
};
const usable=(f:DocumentFact,key:'balance'|'apr'|'minimumPayment')=>
  (key==='balance'&&f.field==='statement-balance'&&f.amount!==null)||
  (key==='apr'&&f.field==='annual-rate'&&f.ratePercent!==undefined)||
  (key==='minimumPayment'&&f.field==='instalment'&&f.amount!==null);
function AccountCard({document,currency,existingAccounts,onCreate}:{
  document:LocalFinanceDocument;currency:string;
  existingAccounts:Account[];onCreate:(a:Account)=>void
}){
  // Legacy encrypted excerpts remain readable without modifying their source.
  const profile=document.accountProfile??makeAccountProfile(
    document.lines.map(l=>l.label).join('\n'),document.label,document.lines);
  const [edit,setEdit]=useState(false);
  const [name,setName]=useState(profile.name);
  const [balance,setBalance]=useState('');
  const [apr,setApr]=useState('');
  const [minimumPayment,setMinimumPayment]=useState('');
  const [confirmed,setConfirmed]=useState(false);
  const [error,setError]=useState('');
  const eligible=['vehicle-finance','credit-card','mortgage','personal-loan'].includes(profile.category);
  function save(){
    setError('');
    const clean=maskDocumentPII(name).slice(0,80);
    if(clean.length<3||/[\d@<>]/.test(clean)){setError('Use a descriptive account name without personal identifiers.');return;}
    if(existingAccounts.some(a=>a.name.toLowerCase()===clean.toLowerCase())){
      setError('An account with this label is already in Debt Plan. Review that account to avoid duplicates.');return;
    }
    const figures=[balance,apr,minimumPayment];
    if(figures.some(v=>v!==''&&(!/^\d+(?:\.\d{1,2})?$/.test(v)||!Number.isFinite(Number(v))||Number(v)>1e10))){
      setError('Enter valid nonnegative amounts with up to two decimal places.');return;
    }
    if(apr!==''&&Number(apr)>200){setError('APR exceeds the supported range.');return;}
    if(figures.some(v=>v!=='')&&!confirmed){
      setError('Confirm that entered balances, rates and payments were checked against sufficiently recent evidence.');return;
    }
    if(!window.confirm('Create a Debt Plan account from reviewed entries? Historical references are not automatically verified. No bank request or payment will be made.'))return;
    onCreate({name:clean,balance,apr,minimumPayment});
    setEdit(false);setConfirmed(false);
  }
  return <article className="rounded-xl border border-border bg-background p-3">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-[13px] font-bold">{profile.name}</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {profile.category.replaceAll('-',' ')} · {profile.confidence==='uncertain'?'Category needs checking':'Matched document terms'}
        </p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Source: {maskDocumentPII(document.label).slice(0,70)} · imported {document.importedAt.slice(0,10)}
        </p>
      </div>
      <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold">
        {profile.facts.length} reference facts
      </span>
    </div>
    {profile.facts.length>0?
      <dl className="mt-3 space-y-2">
        {profile.facts.slice(0,12).map((f,index)=>
          <div key={index} className="rounded-lg bg-muted/50 p-2.5 text-[11px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <dt className="font-medium">{fieldNames[f.field]}</dt>
              <dd className="font-bold">{f.ratePercent!==undefined?f.ratePercent+'%':
                f.amount===null?'Amount unclear':money(f.amount,currency)}</dd>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Historical document evidence · {f.asOf??'date unknown'} · unverified
            </p>
            {edit&&eligible&&(['balance','apr','minimumPayment'] as const).map(key=>
              usable(f,key)?<button type="button" key={key}
                onClick={()=>{
                  const value=key==='apr'?f.ratePercent:f.amount;
                  const setter=key==='balance'?setBalance:key==='apr'?setApr:setMinimumPayment;
                  setter(value===undefined||value===null?'':String(value));
                  setConfirmed(false);
                }}
                className="mt-2 mr-2 min-h-9 rounded-lg border border-border px-2 text-[11px]">
                Review as {key==='minimumPayment'?'monthly payment':key==='apr'?'APR':'balance'}
              </button>:null)}
          </div>)}
      </dl>:
      <p className="mt-3 text-[11px] text-muted-foreground">
        No reliable labelled account figures found. Review the document excerpts before entering any values.
      </p>}
    {eligible&&<div className="mt-3">
      <button type="button" onClick={()=>{setEdit(v=>!v);setError('');}}
        className="min-h-11 w-full rounded-lg border border-primary/30 px-3 text-[12px] font-semibold">
        {edit?'Close account review':'Review fields for Debt Plan'}
      </button>
      {edit&&<div className="mt-3 space-y-3 border-t border-border pt-3">
        <p className="text-[11px] leading-5 text-muted-foreground">
          The document may be old. No historical amount is copied automatically.
          Review candidate figures above or enter current values manually.
          Empty fields stay unconfirmed in Debt Plan.
        </p>
        {([
          ['Account name',name,setName],
          ['Current balance (optional)',balance,setBalance],
          ['Annual interest rate % (optional)',apr,setApr],
          ['Monthly repayment (optional)',minimumPayment,setMinimumPayment]
        ] as const).map(([title,value,setter])=>
          <label key={title} className="block text-[11px] font-semibold">
            {title}
            <input type="text" autoComplete="off" value={value}
              onChange={e=>{setter(e.target.value);setConfirmed(false);}}
              className="mt-1 min-h-11 w-full rounded-xl border border-input bg-card px-3 text-[16px]"/>
          </label>)}
        <label className="flex items-start gap-2 text-[11px] leading-5">
          <input type="checkbox" className="mt-1" checked={confirmed}
            onChange={e=>setConfirmed(e.target.checked)}/>
          I checked the entered figures against an appropriate recent source. An old statement alone does not establish today's balance.
        </label>
        {error&&<p role="alert" className="text-[11px] text-destructive">{error}</p>}
        <button type="button" onClick={save}
          className="min-h-11 w-full rounded-lg bg-primary px-3 text-[12px] font-semibold text-primary-foreground">
          Add reviewed account to Debt Plan
        </button>
      </div>}
    </div>}
  </article>;
}
/** Evidence display is live from the unlocked encrypted vault; no new storage. */
export default function AccountEvidenceReview({documents,existingAccounts,currency,onCreate}:Props){
  const safe=Array.isArray(documents)?documents.filter(d=>d&&Array.isArray(d.lines)):[];
  return <section className="mb-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
    aria-label="Accounts detected from documents">
    <h2 className="text-[15px] font-bold">Accounts recognised from documents</h2>
    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
      Masked, source-dated figures for your review. Saving evidence does not create a verified balance,
      an account transaction, or a bank connection.
    </p>
    {safe.length===0?<p className="mt-3 text-[11px] text-muted-foreground">Upload a statement or finance document to begin.</p>:
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {safe.map(d=><AccountCard key={d.id} document={d}
          existingAccounts={existingAccounts} currency={currency} onCreate={onCreate}/>)}
      </div>}
  </section>;
}
