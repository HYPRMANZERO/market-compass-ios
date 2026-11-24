import { useState } from 'react';
import { FileUp, Landmark, ShieldCheck, WalletCards } from 'lucide-react';

type Bank = { id: string; name: string; monogram: string; color: string; description?: string };
const banks: Bank[] = [
  { id: 'standard-bank', name: 'Standard Bank', monogram: 'SB', color: '#0b467a' },
  { id: 'absa', name: 'Absa', monogram: 'A', color: '#c22138' },
  { id: 'fnb', name: 'FNB', monogram: 'FNB', color: '#04787c' },
  { id: 'nedbank', name: 'Nedbank', monogram: 'N', color: '#006c4d' },
  { id: 'capitec', name: 'Capitec', monogram: 'C', color: '#164677' },
  { id: 'discovery', name: 'Discovery Bank', monogram: 'D', color: '#333a79' },
  { id: 'gotyme', name: 'GoTyme Bank', monogram: 'GT', color: '#236589', description: 'Previously TymeBank' },
  { id: 'bank-zero', name: 'Bank Zero', monogram: '0', color: '#222b3e' },
  { id: 'mukuru', name: 'Mukuru', monogram: 'M', color: '#e85828', description: 'Mukuru Account & Card uses Bank Zero–Mukuru details; select Mukuru, not Bank Zero, for Mukuru statements' },
  { id: 'african-bank', name: 'African Bank', monogram: 'AB', color: '#592f82' },
  { id: 'investec', name: 'Investec', monogram: 'I', color: '#263c52' },
];

function BankMark({bank}:{bank:Bank}){
  const [failed,setFailed]=useState(false);
  const ext=bank.id==='absa'?'svg':['standard-bank','bank-zero'].includes(bank.id)?'jpg':'png';
  return <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-white text-[13px] font-extrabold shadow-sm" style={{color:bank.color}}>
    {failed?<Landmark size={25} aria-hidden="true"/>:<img src={`${import.meta.env.BASE_URL}bank-logos/${bank.id}.${ext}`} alt="" loading="eager" decoding="async"
      className="h-full w-full object-contain p-1.5" onError={()=>setFailed(true)}/>}
  </span>;
}

export default function BankCarousel({
  compact = false, showStandardBankConnect = false, onImportDocuments, onAddAccount,
}: {
  compact?: boolean;
  showStandardBankConnect?: boolean;
  onImportDocuments?: () => void;
  onAddAccount?: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const chosen = banks.find(bank => bank.id === selected);
  return <section className="rounded-2xl border border-border bg-card p-4 shadow-sm" aria-label="Choose a South African bank" data-testid="bank-carousel">
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2"><Landmark size={18} aria-hidden="true" className="text-primary"/><h2 className="text-[15px] font-bold">Choose your bank</h2></div>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Swipe to browse South African banks and account providers.</p>
      </div>
      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">Statements</span>
    </div>
    <div role="list" aria-label="South African banking providers" className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain px-1 pb-3 [scrollbar-width:thin]" style={{WebkitOverflowScrolling: 'touch'}}>
      {banks.map(bank => <div role="listitem" key={bank.id} className="w-[116px] min-w-[116px] snap-start sm:w-[132px] sm:min-w-[132px]">
        <button type="button" aria-label={`Select ${bank.name}`} aria-pressed={selected === bank.id} data-testid={`bank-option-${bank.id}`}
          onClick={() => setSelected(bank.id)} className={`flex min-h-[122px] w-full flex-col items-center justify-center gap-2 rounded-2xl border px-2 py-3 text-center transition-colors ${selected === bank.id ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-border bg-background active:bg-muted'}`}>
          <BankMark bank={bank}/>
          <span className="line-clamp-2 min-h-[30px] text-[11px] font-semibold leading-[15px]">{bank.name}</span>
        </button>
      </div>)}
    </div>
    {chosen ? <div className="mt-2 rounded-xl border border-border bg-background p-3" role="region" aria-label={`${chosen.name} account options`} data-testid="selected-bank-options">
      <p className="flex items-center gap-2 text-[13px] font-bold"><WalletCards size={16} className="text-primary"/>{chosen.name}</p>
      {chosen.description && <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{chosen.description}</p>}
      <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{showStandardBankConnect&&chosen.id==='standard-bank'
        ?'A secure Standard Bank consent setup is available below. Bank sign-in only becomes active after partner approval and read-only API onboarding.'
        :'Secure live account linking is not enabled for this provider. You can import a statement for local review; importing does not establish a bank connection or update a balance automatically.'}</p>
      {showStandardBankConnect&&chosen.id==='standard-bank'&&<a href="#mc-standard-bank-connection" className="mt-2 inline-flex min-h-11 items-center text-[12px] font-semibold text-primary">Go to Standard Bank connection options</a>}
      <div className="mt-3 flex flex-wrap gap-2">
        {onImportDocuments && <button type="button" onClick={onImportDocuments} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-3 text-[12px] font-semibold text-primary-foreground"><FileUp size={16}/> Import statement</button>}
        {onAddAccount && <button type="button" onClick={onAddAccount} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-[12px] font-semibold"><WalletCards size={16}/> Add debt record manually</button>}
      </div>
    </div> : <p className="mt-1 text-[11px] leading-5 text-muted-foreground">Tap a bank card to see supported options. No banking password is requested.</p>}
    {!compact && <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-muted-foreground"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-primary"/>Bank and fintech brands are shown for identification only, not as connected partners or live integrations.</p>}
  </section>;
}
