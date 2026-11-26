import {IonCard,IonRippleEffect} from '@ionic/react';
import {ArrowUpRight,LockKeyhole,ShieldCheck} from 'lucide-react';

/** Shared iPhone/desktop debt card using only local unlocked vault props. */
type Props={currency:string;totalDebt:number;accountsCount:number;onViewAccounts:()=>void};
const formatDebt=(amount:number,currency:string)=>{
  try{return new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:2}).format(amount);}
  catch{return currency+' '+amount.toFixed(2);}
};
export default function FinancialSpaceHero({currency,totalDebt,accountsCount,onViewAccounts}:Props){
  return <IonCard className="mc-wallet-hero" role="region" aria-label="Private financial overview" data-testid="financial-space-hero">
    <div className="mc-wallet-orbit mc-wallet-orbit-first" aria-hidden="true"/>
    <div className="mc-wallet-orbit mc-wallet-orbit-second" aria-hidden="true"/>
    <div className="mc-wallet-content">
      <div className="flex items-center justify-between gap-2">
        <span className="mc-wallet-eyebrow">YOUR FINANCIAL SPACE</span>
        <span className="mc-wallet-lock"><LockKeyhole size={12} aria-hidden="true"/> Private workspace</span>
      </div>
      {accountsCount
        ? <p className="mt-6 text-[11.5px] font-semibold uppercase tracking-[.13em] text-white/55">Total entered debt balances</p>
        : <p className="mt-2.5 text-[11.5px] leading-5 text-white/65">Add an account or import a statement to begin building your private picture.</p>}
      <h1 className="mc-wallet-number" data-testid="financial-space-debt-total">
        {accountsCount ? formatDebt(totalDebt,currency) : 'Start with clarity'}
      </h1>
      {accountsCount > 0 && <p className="mt-2.5 max-w-[440px] text-[11.5px] leading-5 text-white/65">
        Based on amounts you entered. Not a live or bank-verified balance.
      </p>}
      <div className="fin-hero-stats">
        <div className="fin-hero-stat">
          <span>Accounts</span>
          <strong>{accountsCount ? `${accountsCount} tracked` : 'None yet'}</strong>
        </div>
        <div className="fin-hero-stat">
          <span>Currency</span>
          <strong>{currency}</strong>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="mc-wallet-footnote"><ShieldCheck size={14} aria-hidden="true"/> Encrypted on your device</span>
        <button type="button" onClick={onViewAccounts} aria-label={accountsCount?'View saved accounts':'Add an account'} className="mc-wallet-cta ion-activatable">
          <IonRippleEffect/>{accountsCount ? 'View accounts' : 'Add account'} <ArrowUpRight size={15} aria-hidden="true"/>
        </button>
      </div>
    </div>
  </IonCard>;
}
