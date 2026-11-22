/**
 * Reconstruct Standard Bank's Date / Description / Payments / Deposits /
 * Balance table from local PDF.js selectable-text geometry.
 *
 * Only produces structured rows when all five headers can be located in
 * separate PDF text fragments. Unknown layouts fall back to generic extraction
 * and MUST NOT infer credit/debit from unsigned numbers.
 *
 * Geometry and unredacted original text are ephemeral and never stored.
 */
type PdfItem={str:string;transform?:number[];width?:number;hasEOL?:boolean};
type Part={text:string;x:number;y:number;right:number;order:number};
type Row={y:number;parts:Part[]};
type Headers={date:Part;description:Part;payments:Part;deposits:Part;balance:Part};

function toRows(items:ReadonlyArray<unknown>):Row[]|null {
  const parts:Part[]=[];
  for(let i=0;i<items.length;i++){
    const item=items[i];
    if(!item||typeof item!=='object'||!('str' in item)||
      typeof item.str!=='string'||!('transform' in item)||
      !Array.isArray(item.transform)||item.transform.length<6)continue;
    const a=item as PdfItem;
    const t=a.transform!;
    if(!Number.isFinite(t[4])||!Number.isFinite(t[5]))continue;
    const txt=a.str.replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();
    if(!txt)continue;
    const x=t[4],y=t[5];
    const approximateWidth=txt.length*5.1;
    const w=typeof a.width==='number'&&Number.isFinite(a.width)&&a.width>0?
      a.width:approximateWidth;
    parts.push({text:txt,x,y,right:x+w,order:i});
  }
  if(parts.length<8)return null;
  const rows:Row[]=[];
  for(const p of parts){
    const row=rows.find(r=>Math.abs(r.y-p.y)<=2.5);
    if(row)row.parts.push(p);
    else rows.push({y:p.y,parts:[p]});
  }
  for(const r of rows)r.parts.sort((a,b)=>a.x-b.x||a.order-b.order);
  rows.sort((a,b)=>b.y-a.y);
  return rows;
}
const LABELS=['date','description','payments','deposits','balance'] as const;
function headersIn(row:Row):Headers|null{
  const result:Record<string,Part>={};
  for(const p of row.parts){
    const value=p.text.toLowerCase().replace(/[:]/g,'').trim();
    if((LABELS as readonly string[]).includes(value))result[value]=p;
  }
  if(LABELS.some(k=>!result[k]))return null;
  const h=result as Headers;
  if(!(h.date.x<h.description.x&&h.description.x<h.payments.x&&
       h.payments.x<h.deposits.x&&h.deposits.x<h.balance.x))return null;
  return h;
}
const MONEY=/^[+-]?\(?\s*(?:R\s*)?\d[\d ,.]*[.,]\d{2}\)?$/i;
function nearestMoneyColumn(p:Part,h:Headers):'payments'|'deposits'|'balance'|null{
  const columns=['payments','deposits','balance'] as const;
  const distances=columns.map(column=>({column,
    distance:Math.abs(p.right-h[column].right)}))
    .sort((a,b)=>a.distance-b.distance);
  const spacing=Math.min(h.deposits.right-h.payments.right,
    h.balance.right-h.deposits.right);
  // Ambiguously centred between two numeric columns? Reject the row.
  if(distances[0].distance>Math.max(40,spacing*0.47)||
     distances[1].distance-distances[0].distance<5)return null;
  return distances[0].column;
}
/**
 * Encoded pipe fields: STDBANK|date|description|payment|deposit|balance.
 * A prefix prevents other financial documents being mistaken for this table.
 */
export function layoutStandardBankPdfLines(items:ReadonlyArray<unknown>):string[]|null{
  const rows=toRows(items);
  if(!rows)return null;
  const headerIndex=rows.findIndex(r=>headersIn(r)!==null);
  if(headerIndex<0)return null;
  let header=headersIn(rows[headerIndex])!;
  const output:string[]=[];
  let previous:{index:number;y:number}|null=null;
  for(const row of rows.slice(headerIndex+1)){
    const repeatedHeader=headersIn(row);
    if(repeatedHeader){header=repeatedHeader;previous=null;continue;}
    const dateLimit=header.description.x-4;
    const descLimit=header.payments.x-14;
    const amountStart=(header.description.x+header.payments.x)/2;
    const dateParts:Part[]=[],descriptionParts:Part[]=[];
    const values:{payments:string;deposits:string;balance:string}={
      payments:'',deposits:'',balance:''
    };
    let ambiguous=false;
    for(const p of row.parts){
      // Avoid leaking delimiter characters into our ephemeral table protocol.
      const clean={...p,text:p.text.replace(/[|]/g,' ')};
      if(p.x<dateLimit){dateParts.push(clean);continue;}
      // Right-aligned values can extend left of the payment header.
      const isAmount=p.x>=amountStart&&MONEY.test(p.text);
      if(isAmount){
        const column=nearestMoneyColumn(p,header);
        if(!column||values[column]){ambiguous=true;break;}
        values[column]=p.text;
      } else if(p.x<descLimit){
        descriptionParts.push(clean);
      } else {
        ambiguous=true;
        break;
      }
    }
    const date=dateParts.map(p=>p.text).join(' ').trim();
    const description=descriptionParts.map(p=>p.text).join(' ').trim();
    // A description-only subline can follow a dated transaction;
    // do not inherit its date or create a new transaction row.
    const isSubline=!date&&!values.payments&&!values.deposits&&!values.balance&&
      description!==''&&!ambiguous;
    if(isSubline&&previous&&Math.abs(previous.y-row.y)<18){
      const i=previous.index;
      const cells=output[i].split('|');
      if(cells[2]&&cells[2].length<100){
        cells[2]=(cells[2]+' '+description).slice(0,130);
        output[i]=cells.join('|');
      }
      continue;
    }
    previous=null;
    if(ambiguous)continue;
    const validTransaction=/^\d{1,2}\s+[a-z]{3,9}\s+\d{2,4}$/i.test(date)&&
      Boolean(description)&&Boolean(values.payments)!==Boolean(values.deposits)&&
      Boolean(values.balance);
    const balanceOnly=!date&&
      /\b(?:statement opening balance|opening balance|closing balance)\b/i.test(description)&&
      !values.payments&&!values.deposits&&Boolean(values.balance);
    if(!validTransaction&&!balanceOnly)continue;
    const encoded=['STDBANK',date,description,
      values.payments,values.deposits,values.balance].join('|');
    output.push(encoded);
    previous=validTransaction?{index:output.length-1,y:row.y}:null;
  }
  return output.length?output:null;
}
