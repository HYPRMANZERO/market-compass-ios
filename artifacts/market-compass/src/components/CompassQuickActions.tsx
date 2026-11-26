import {ArrowRight,ShieldCheck} from 'lucide-react';
import type {AssistantEdition} from '@/lib/assistantEdition';
import {compassActionsForEdition,type CompassActionId} from '@/lib/compassActionMenu';

type Props={edition:AssistantEdition;onAction:(id:CompassActionId)=>void};
export default function CompassQuickActions({edition,onAction}:Props){
  const actions=compassActionsForEdition(edition);
  const groups=edition==='personal'?(['finance','personal'] as const):(['finance'] as const);
  return <section aria-label="Compass quick actions" className="mc-chat-quick-actions px-2 py-2">
    <h3 className="text-[14px] font-bold">Compass actions</h3>
    <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
      {edition==='personal'
        ? 'Every finance action plus your everyday assistant tools.'
        : 'Finance-only actions. Personal planning and research tools are available in Compass Personal.'}
    </p>
    {groups.map(group=><div key={group} className="mt-3" aria-label={group==='finance'?'Finance actions':'Personal actions'}>
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[.08em] text-muted-foreground">
        {group==='finance'?'Finance & secure workspace':'Personal assistant'}
      </h4>
      <div className="fin-action-list">
        {actions.filter(action=>action.group===group).map(action=>
          <button type="button" key={action.id} onClick={()=>onAction(action.id)}
            aria-label={action.label}
            className="fin-action-row">
            <span className="min-w-0 flex-1">{action.label}</span>
            <ArrowRight size={15} aria-hidden="true" className="shrink-0"/>
          </button>)}
      </div>
    </div>)}
    <p className="mt-3 flex items-start gap-2 text-[10px] leading-4 text-muted-foreground">
      <ShieldCheck size={14} aria-hidden="true" className="mt-0.5 shrink-0"/>
      Encrypted local data stays on this device. No bank connection or payment is activated by these shortcuts.
    </p>
  </section>;
}
