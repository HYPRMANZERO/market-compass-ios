import type {AssistantEdition} from './assistantEdition';

/** A shared UI menu. It does not grant backend permissions or bank connectivity. */
export type CompassActionId =
  | 'vault' | 'document' | 'scan-payments' | 'source-status' | 'debt-plan'
  | 'spend-review' | 'markets' | 'voice' | 'permissions'
  | 'scan-files' | 'memory' | 'tasks' | 'research' | 'devices';

export type CompassAction = Readonly<{
  id:CompassActionId;
  label:string;
  group:'finance'|'personal';
}>;

const financeActions:readonly CompassAction[]=[
  {id:'vault',label:'Encrypted Vault',group:'finance'},
  {id:'document',label:'Add document',group:'finance'},
  {id:'scan-payments',label:'Scan saved payments',group:'finance'},
  {id:'source-status',label:'Source status',group:'finance'},
  {id:'debt-plan',label:'Debt planning',group:'finance'},
  {id:'spend-review',label:'Spend review',group:'finance'},
  {id:'markets',label:'Markets',group:'finance'},
  {id:'voice',label:'Voice controls',group:'finance'},
  {id:'permissions',label:'AI permissions',group:'finance'},
];

const personalActions:readonly CompassAction[]=[
  {id:'scan-files',label:'Choose files to scan',group:'personal'},
  {id:'memory',label:'Personal memory',group:'personal'},
  {id:'tasks',label:'Tasks / planning',group:'personal'},
  {id:'research',label:'Research tools',group:'personal'},
  {id:'devices',label:'Device link / private network status',group:'personal'},
];

export const isPersonalOnlyAction=(action:CompassActionId):boolean=>
  personalActions.some(item=>item.id===action);

/** Personal = entire Finance set plus Personal extras; Finance = Finance set only. */
export function compassActionsForEdition(edition:AssistantEdition):readonly CompassAction[]{
  return edition==='personal'?[...financeActions,...personalActions]:[...financeActions];
}
