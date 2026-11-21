/**
 * Offline-first read-only agent question queue, within the EXISTING unlocked
 * encrypted iPhone vault. No IndexedDB duplication, background network worker,
 * device-control opcode, financial action, or automatic dispatch.
 * The owner explicitly taps "Send" when connected to an authorized backend.
 */
export type QueuedReadOnlyQuestion={
  id:string;question:string;createdAt:string;kind:'read_only_question';status:'pending';
};
export const MAX_OFFLINE_QUESTIONS=20;
export const OFFLINE_QUESTION_TTL_MS=7*24*60*60*1000;
const idPattern=/^[0-9a-f-]{20,64}$/i;
const leading=/^(?:what(?:'s| is| are| was| were| do| did| can| should| would)?|when|where|why|how|which|who|show|summari[sz]e|review|compare|explain|check|list|calculate|estimate|analyse|analyze|tell me|give me|can you (?:show|explain|review|check|summari[sz]e|compare|list))\b/i;
const blocked=/\b(?:transfer|send money|withdraw|deposit|buy|sell|trade|purchase|execute|approve|authorize|authorise|delete|erase|wipe|restart|stop|start|install|uninstall|download|upload|run code|run command|shell|powershell|ssh|credential|password|secret|api key|make a payment|pay someone|pay my|place an order|place a trade)\b/i;

/** This is a syntactic safeguard, not a complete semantic permission system.
 * Backend still enforces a separate read-only tool registry on every request. */
export function isReadOnlyOfflineQuestion(input:string):boolean{
  if(typeof input!=='string'||input.trim().length<3||input.length>500||
    /[\r\n\x00-\x1f]/.test(input)||blocked.test(input))return false;
  return leading.test(input.trim());
}
export function validateQueuedQuestion(input:unknown):QueuedReadOnlyQuestion|null{
  if(input===null||typeof input!=='object'||Array.isArray(input))return null;
  const obj=input as Record<string,unknown>;
  if(typeof obj.id!=='string'||!idPattern.test(obj.id)||
    typeof obj.question!=='string'||!isReadOnlyOfflineQuestion(obj.question)||
    typeof obj.createdAt!=='string'||!Number.isFinite(Date.parse(obj.createdAt))||
    new Date(obj.createdAt).toISOString()!==obj.createdAt||
    obj.kind!=='read_only_question'||obj.status!=='pending')return null;
  return {id:obj.id,question:obj.question.trim(),createdAt:obj.createdAt,
    kind:'read_only_question',status:'pending'};
}
export function eligibleToSendQueuedQuestion(input:unknown,now=new Date()):boolean{
  const item=validateQueuedQuestion(input);
  if(!item||!(now instanceof Date)||!Number.isFinite(now.getTime()))return false;
  const age=now.getTime()-Date.parse(item.createdAt);
  return age>=0&&age<=OFFLINE_QUESTION_TTL_MS;
}
export function enqueueOfflineQuestion(
  input:unknown,question:string,{now=new Date(),id=crypto.randomUUID()}={}
):{items:QueuedReadOnlyQuestion[];created:QueuedReadOnlyQuestion}{
  if(!(now instanceof Date)||!Number.isFinite(now.getTime())||!isReadOnlyOfflineQuestion(question))
    throw Error('Only short read-only questions can be queued. Commands that act on devices, funds or files require separate online approval.');
  const items=Array.isArray(input)?input.map(validateQueuedQuestion):[];
  if(items.some(x=>!x))throw Error('Existing offline queue needs repair or encrypted backup before changing it.');
  const safe=items as QueuedReadOnlyQuestion[];
  if(safe.length>=MAX_OFFLINE_QUESTIONS)throw Error('Offline queue is full. Review and remove an older request first.');
  if(safe.some(x=>x.question.toLowerCase()===question.trim().toLowerCase()))
    throw Error('That question is already waiting in the encrypted offline queue.');
  if(typeof id!=='string'||!idPattern.test(id)||safe.some(x=>x.id===id))
    throw Error('Invalid unique queue identity.');
  const created={id,question:question.trim(),createdAt:now.toISOString(),
    kind:'read_only_question' as const,status:'pending' as const};
  return {items:[...safe,created],created};
}
export function removeOfflineQuestion(input:unknown,id:string):QueuedReadOnlyQuestion[]{
  if(!Array.isArray(input))return [];
  return input.map(validateQueuedQuestion).filter((x):x is QueuedReadOnlyQuestion=>
    Boolean(x&&x.id!==id));
}
