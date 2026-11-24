/**
 * Local, consented productivity helpers. No network, email sending, device
 * scanning, calendar insertion, or banking actions take place in this module.
 */
export const PERSONAL_CAPABILITIES = Object.freeze([
  { id:'daily_plan', title:'Daily plan', availability:'offline', effect:'local_draft' },
  { id:'calendar_export', title:'Calendar event (.ics)', availability:'offline', effect:'download_after_click' },
  { id:'message_draft', title:'Email or message draft', availability:'offline', effect:'copy_after_click' },
  { id:'selected_file_review', title:'Document review', availability:'user_selection', effect:'explicit_file_import' },
  { id:'cited_research', title:'Cited research', availability:'private_ai_required', effect:'read_only' },
  { id:'code_assistance', title:'Coding help', availability:'private_ai_required', effect:'text_only' },
  { id:'finance_review', title:'Financial analysis', availability:'vault_or_private_ai', effect:'read_only' },
] as const);

function clean(value:string,max:number):string {
  if(typeof value!=='string') throw Error('Enter text to create the draft.');
  const out=value.replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
  if(!out || out.length>max) throw Error('Text is empty or too long.');
  return out;
}

export function makeDailyPlan(goal:string):string {
  const task=clean(goal,150);
  return ['Daily focus: '+task,'',
    '1. Prepare (10 minutes): define what done looks like.',
    '2. Focus (25 minutes): work on the most important part.',
    '3. Review (5 minutes): note what worked and the next action.',
    '',
    'Created locally. This is a suggested plan, not a scheduled reminder.'].join('\n');
}

export function makeMessageDraft(subject:string,details:string):string {
  const topic=clean(subject,120),body=clean(details,800);
  return ['Subject: '+topic,'','Hello,','',body,'','Kind regards,','','Draft only. Not sent to anyone.'].join('\n');
}

function validLocalDateTime(date:string,time:string):Date {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time))
    throw Error('Choose a valid date and time.');
  const [year,month,day]=date.split('-').map(Number);
  const [hour,minute]=time.split(':').map(Number);
  const local=new Date(year,month-1,day,hour,minute);
  if(local.getFullYear()!==year||local.getMonth()!==month-1||local.getDate()!==day||
     local.getHours()!==hour||local.getMinutes()!==minute)
    throw Error('The selected local date or time is invalid.');
  return local;
}
const utc=(date:Date)=>date.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
const icsText=(v:string)=>v.replace(/\\/g,'\\\\').replace(/\n/g,'\\n')
  .replace(/;/g,'\\;').replace(/,/g,'\\,');
export function makeCalendarFile(title:string,date:string,time:string,minutes=30,createdAt=new Date()):string {
  const eventTitle=clean(title,120);
  if(!Number.isInteger(minutes)||minutes<5||minutes>480) throw Error('Choose a duration between 5 and 480 minutes.');
  const start=validLocalDateTime(date,time);
  const end=new Date(start.getTime()+minutes*60000);
  const suffix=[date.replace(/-/g,''),time.replace(':',''),eventTitle.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,24)].join('-');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Market Compass//Personal Offline Draft//EN',
    'BEGIN:VEVENT','UID:'+suffix+'@compass.local','DTSTAMP:'+utc(createdAt),
    'DTSTART:'+utc(start),'DTEND:'+utc(end),'SUMMARY:'+icsText(eventTitle),
    'DESCRIPTION:Explicitly exported by the device owner. No calendar integration or reminder has been activated.',
    'END:VEVENT','END:VCALENDAR',''].join('\r\n');
}
