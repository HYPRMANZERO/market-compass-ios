/**
 * Read-only regional terminology for category proposals.
 * Payment networks (ACH, SEPA, Bacs, UPI, Pix, PayShap, etc.) deliberately
 * do NOT appear as category rules: a rail identifies how money moved,
 * not what it purchased. This finite, versioned lexicon is not a bank feed.
 */
import {REGIONS,type RegionCode} from './regions.ts';
import type {ExpenseCategory} from './monthlyExpenses.ts';

export type RegionRule={category:ExpenseCategory;terms:readonly string[];explanation:string};
export type RegionalCategoryMatch={category:ExpenseCategory;reason:string;origin:'global'|'region'};

export function normalizeFinancialNarration(text:string):string{
 return typeof text==='string' ? text.toLocaleLowerCase('en')
   .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
   .replace(/[^\p{L}\p{N}]+/gu,' ').replace(/\s+/g,' ').trim() : '';
}
function matches(text:string,terms:readonly string[]):boolean{
 const padded=' '+text+' ';
 return terms.some(term=>{
   const phrase=normalizeFinancialNarration(term);
   return phrase.length>0&&padded.includes(' '+phrase+' ');
 });
}
const rule=(category:ExpenseCategory,explanation:string,...terms:string[]):RegionRule=>
 ({category,explanation,terms});

/** Global consumer and banking categories; no region-specific store names. */
const UNIVERSAL:readonly RegionRule[]=[
 rule('fees','Bank or finance fee wording','bank fee','bank charge','account fee','account maintenance fee','service fee','transaction fee','processing fee','late payment fee','overdraft fee','insufficient funds fee','nsf fee','card annual fee','foreign exchange fee','fx conversion fee','atm fee','withdrawal fee','finance charge','interest charged','interest debit','excess interest','debit order fee','commission charge','monthly fee','administration fee','payshap fee','sepa fee','ach fee','wire transfer fee','bacs fee','upi fee','pix fee','paynow fee','banking fees','bank charges'),
 rule('taxes','Explicit tax or duty payment','income tax','tax payment','tax remittance','vat payment','sales tax payment','property tax','payroll tax payment','withholding tax payment','customs duty','tax authority payment','tax bill','tax return payment'),
 rule('insurance','Insurance or coverage premium','insurance premium','insurance debit','life insurance','car insurance','vehicle insurance','home insurance','health insurance','medical insurance','insurance policy','policy premium','pet insurance','insurance renewal','insurer premium'),
 rule('health','Medical or healthcare description','pharmacy','pharmacist','hospital','healthcare','medical clinic','medical aid','doctor consultation','dentist','optometrist','prescription','medical bill','medication','physiotherapy','mental health counselling'),
 rule('education','Education or tuition payment','tuition','tuition fee','school fee','university fee','college fees','textbook','school supplies','student fees','exam fee','training course','education fee','education loan tuition'),
 rule('childcare','Childcare provider or school transport','daycare','day care','childcare','child care','nursery fee','preschool fee','creche','creche fee','babysitting','nanny salary'),
 rule('pets','Pet food, supplies or veterinary care','dog food','cat food','pet food','pet shop','pet store','pet supplies','veterinary','vet bill','veterinarian','pet grooming','kennel','bravecto','nexgard'),
 rule('subscriptions','Membership or subscription provider','netflix','spotify','showmax','disney plus','youtube premium','amazon prime membership','icloud','apple music','google one subscription','subscription','monthly membership','gym','gym membership','streaming subscription','fitness membership'),
 rule('utilities','Utility, telecom or connectivity charge','electricity','electricity bill','power bill','natural gas bill','gas utility','water bill','municipal utilities','utilities payment','airtime','mobile data','data bundle','internet bill','internet service','broadband bill','fiber internet','fibre internet','phone bill','mobile plan','postpaid mobile'),
 rule('housing','Rent, board or housing costs','rent payment','rental payment','monthly rent','landlord','housing levy','homeowners association','body corporate','property levy','property management fee','board payment','board and lodging','accommodation rent','apartment rent','housing payment'),
 rule('groceries','Groceries or supermarket receipt','groceries','grocery','supermarket','food store','fresh produce','grocery shopping','weekly food shopping'),
 rule('dining','Eating out, takeaway or coffee','restaurant','takeaway','take away food','fast food','coffee shop','cafe coffee','cappuccino','latte','dessert','breakfast meal','lunch meal','dinner meal','dine in','food delivery meal','takeout restaurant','kfc','mcdonalds','mcdonald s','nandos','nando s','steers','debonairs','burger king','starbucks'),
 rule('transport','Fuel, transit or local transportation','petrol','diesel','fuel station','gas station','fuel purchase','gasoline','uber trip','bolt ride','taxi fare','bus ticket','train ticket','rail ticket','metro fare','subway fare','public transport','parking ticket','parking fee','toll road','toll fee','commuter pass','car hire fuel'),
 rule('travel','Trip lodging or airline services','airline ticket','flight booking','hotel booking','hotel stay','hostel booking','travel agent','airfare','airport transfer','vacation booking','holiday booking','resort stay','tour booking'),
 rule('shopping','Retail clothing, home or electronics','clothing store','clothing purchase','apparel store','department store','furniture purchase','electronics store','hardware store','homeware','online shopping','retail store','shoe store'),
 rule('entertainment','Entertainment, games or ticket admission','movie theatre','cinema ticket','concert ticket','theatre ticket','video game purchase','gaming purchase','museum admission','event ticket','amusement park','entertainment venue'),
 rule('personal-care','Grooming and personal care','haircut','hair cut','hairdresser','barber','barbershop','hair salon','beauty salon','manicure','pedicure','personal grooming','toiletries','cosmetics'),
 rule('donations','Donation or charitable contribution','charity donation','charitable donation','donation to charity','church donation','religious donation','nonprofit donation','ngo donation','fundraising donation'),
 rule('business','Explicit business operating expense','business supplies','business expense','office supplies','business software license','business software licence','professional services fee','accounting fee','legal retainer','business registration fee'),
 rule('car','Vehicle maintenance, not loan repayment','vehicle service','car service','vehicle repair','car repair','car maintenance','tyre replacement','tire replacement','vehicle parts','car parts','auto repair','vehicle inspection')
];

/** Country names/terminology are applied only when the owner selects the country. */
const COUNTRIES:Partial<Record<RegionCode,readonly RegionRule[]>>={
 ZA:[
  rule('groceries','South Africa supermarket description','checkers','checkers sixty60','sixty60','sixty 60','pick n pay','pnp','shoprite','superspar','food lovers market','woolworths food','boxer superstores'),
  rule('transport','South Africa fuel or transport merchant','engen','caltex','astron energy','gautrain','metrorail','prasa'),
  rule('insurance','South Africa insurer narration','outsurance','miway'),
  rule('subscriptions','South Africa television subscription','dstv','multichoice subscription'),
  rule('taxes','South Africa tax authority payment','sars tax payment','sars payment','paye payment','uif contribution')
 ],
 NA:[rule('groceries','Namibia grocery merchant','woermann brock','shoprite namibia','pick n pay namibia')],
 BW:[rule('groceries','Botswana grocery merchant','choppies','shoprite botswana','spar botswana')],
 NG:[
  rule('groceries','Nigeria supermarket narration','shoprite nigeria','spar nigeria','justrite supermarket'),
  rule('shopping','Nigeria retail marketplace','jumia shopping','konga online'),
  rule('taxes','Nigeria tax narration','firs tax payment','paye nigeria','vat remittance')
 ],
 KE:[
  rule('groceries','Kenya supermarket narration','naivas','quickmart supermarket','carrefour kenya'),
  rule('taxes','Kenya tax payment narration','kra tax payment','kra itax payment')
 ],
 GH:[rule('groceries','Ghana grocery merchant','melcom supermarket','shoprite ghana')],
 ZM:[rule('groceries','Zambia grocery merchant','shoprite zambia','pick n pay zambia')],
 TZ:[rule('groceries','Tanzania supermarket description','shoppers plaza','shoppers supermarket tanzania')],
 UG:[rule('groceries','Uganda supermarket description','carrefour uganda','quality supermarket uganda')],
 MU:[rule('groceries','Mauritius supermarket description','super u mauritius','intermart mauritius')],
 GB:[
  rule('groceries','UK supermarket merchant','tesco','sainsburys','sainsbury','asda','morrisons','waitrose','ocado','lidl','aldi','co op food'),
  rule('taxes','UK tax or council tax narration','hmrc tax payment','council tax','self assessment tax'),
  rule('utilities','UK domestic utility narration','british gas bill','octopus energy','thames water bill'),
  rule('housing','UK housing narration','rent to landlord','ground rent','service charge leasehold')
 ],
 DE:[
  rule('groceries','German supermarket description','rewe','edeka','kaufland','lidl','aldi','lebensmittel','supermarkt'),
  rule('housing','German rent description','miete','mietzahlung'),
  rule('utilities','German household utility','stromrechnung','stromabschlag'),
  rule('taxes','German tax description','finanzamt steuerzahlung','einkommensteuer zahlung')
 ],
 FR:[
  rule('groceries','French food retail narration','carrefour','auchan','intermarche','supermarche','courses alimentaires'),
  rule('housing','French rent description','loyer','paiement loyer'),
  rule('fees','French bank fee description','frais bancaires','frais de tenue de compte'),
  rule('taxes','French tax description','impots paiement','taxe fonciere')
 ],
 ES:[
  rule('groceries','Spanish grocery description','mercadona','supermercado','eroski','dia supermercado'),
  rule('housing','Spanish rent description','alquiler vivienda','pago alquiler'),
  rule('taxes','Spanish tax payment','pago impuestos','hacienda impuestos')
 ],
 IT:[
  rule('groceries','Italian supermarket description','conad','esselunga','supermercato','coop supermercato'),
  rule('housing','Italian rent description','affitto','canone locazione'),
  rule('taxes','Italian tax payment','pagamento imposte','agenzia entrate tributo')
 ],
 NL:[
  rule('groceries','Dutch supermarket description','albert heijn','jumbo supermarkt','plus supermarkt','boodschappen'),
  rule('housing','Dutch rent description','huurbetaling','maandelijkse huur'),
  rule('insurance','Dutch insurance premium description','zorgverzekering premie')
 ],
 IE:[
  rule('groceries','Ireland grocery description','supervalu','dunnes stores','tesco ireland'),
  rule('taxes','Irish tax narration','revenue tax payment','local property tax ireland')
 ],
 CH:[
  rule('groceries','Swiss supermarket narration','migros supermarkt','coop supermarkt','denner'),
  rule('housing','Swiss rental payments','mietzins','mietzahlung'),
  rule('insurance','Swiss health insurance premium','krankenkasse praemie','krankenkasse pramie')
 ],
 US:[
  rule('groceries','US supermarket merchant','kroger','publix','trader joes','whole foods market','safeway','aldi usa','wegmans','stop and shop'),
  rule('taxes','US tax payment description','irs tax payment','federal income tax payment','state income tax payment','property taxes'),
  rule('health','US health provider bill','copay healthcare','medical copay','urgent care bill'),
  rule('housing','US housing association','hoa dues','hoa fee'),
  rule('education','US student education payment','student tuition payment','university bursar payment')
 ],
 CA:[
  rule('groceries','Canada grocery merchant','loblaws','sobeys','no frills','real canadian superstore','metro grocery','farm boy grocery'),
  rule('taxes','Canada revenue authority payment','cra tax payment','revenue quebec tax'),
  rule('utilities','Canada telecom or utilities','hydro bill','rogers internet bill','bell internet bill')
 ],
 BR:[
  rule('groceries','Brazil supermarket description','supermercado','pa o de acucar','pao de acucar','assai atacadista','carrefour brasil'),
  rule('housing','Brazil housing rent narration','aluguel','pagamento aluguel'),
  rule('taxes','Brazil tax payment','pagamento imposto','iptu pagamento','ipva pagamento','dar f imposto','darf imposto'),
  rule('utilities','Brazil electricity narration','conta de luz','conta de agua')
 ],
 AU:[
  rule('groceries','Australia supermarket merchant','coles','woolworths','iga supermarket','aldi australia'),
  rule('taxes','Australia tax authority payment','ato tax payment','australian taxation office payment'),
  rule('transport','Australia road toll or fuel','linkt toll','e tag toll','translink fare')
 ],
 NZ:[
  rule('groceries','New Zealand supermarket merchant','pak n save','paknsave','new world supermarket','woolworths nz','countdown supermarket'),
  rule('taxes','New Zealand tax authority payment','ird tax payment','inland revenue tax payment')
 ],
 IN:[
  rule('groceries','India grocery merchant','dmart','d mart','bigbasket','reliance fresh','blinkit grocery'),
  rule('taxes','India tax payment','income tax challan','gst payment','tds tax payment'),
  rule('utilities','India utility bill','bijli bill','electricity recharge'),
  rule('education','India tuition payment','school fees india','college tuition fees')
 ],
 AE:[
  rule('groceries','UAE supermarket merchant','lulu hypermarket','spinneys','carrefour uae','union coop supermarket'),
  rule('utilities','UAE utility account','dewa electricity','sewa electricity','etisalat home internet','du telecom bill'),
  rule('transport','UAE road toll narration','salik toll','dar b toll'),
  rule('housing','UAE property service','ejari renewal fee','rent cheque')
 ],
 JP:[
  rule('groceries','Japan supermarket merchant','seiyu supermarket','aeon supermarket','life supermarket','スーパー 食料品'),
  rule('housing','Japanese rent description','家賃','賃貸 家賃'),
  rule('utilities','Japanese utility payment','電気料金','水道料金','ガス料金'),
  rule('transport','Japanese railway fare','電車 運賃','鉄道 運賃'),
  rule('taxes','Japanese tax payment','所得税 納付','住民税 納付')
 ],
 SG:[
  rule('groceries','Singapore supermarket merchant','ntuc fairprice','fairprice','sheng siong','cold storage supermarket'),
  rule('utilities','Singapore utilities','sp utilities','singapore power bill'),
  rule('taxes','Singapore tax authority','iras tax payment','income tax iras'),
  rule('housing','Singapore housing payment','hdb housing rental','hdb rental')
 ]
};

const salaryByRegion:Partial<Record<RegionCode,readonly string[]>>={
 DE:['gehalt','lohn zahlung'],FR:['salaire'],ES:['nomina','sueldo'],
 IT:['stipendio'],NL:['salaris'],BR:['salario','pagamento salario'],
 JP:['給与','給料'],IN:['salary credit']
};
const OTHER_SALARY=['salary','payroll','wages','net pay','pay cheque','paycheck','salary credit','payroll credit','wage deposit'];
export function regionalSalaryNarration(text:string,region:string):boolean{
 const normalized=normalizeFinancialNarration(text);
 return matches(normalized,OTHER_SALARY)||matches(normalized,salaryByRegion[region as RegionCode]||[]);
}

/** Match only an owner-chosen supported region. Unsupported region is global-only. */
export function matchRegionalCategory(text:string,region:string):RegionalCategoryMatch|null{
 const safe=normalizeFinancialNarration(text);
 if(!safe)return null;
 for(const item of UNIVERSAL)if(matches(safe,item.terms))
   return {category:item.category,reason:item.explanation,origin:'global'};
 if(REGIONS.some(item=>item.code===region)){
   for(const item of COUNTRIES[region as RegionCode]||[]){
     if(matches(safe,item.terms))return {category:item.category,reason:item.explanation,origin:'region'};
   }
 }
 return null;
}

export function regionalPackInfo(region:string){
 const match=REGIONS.find(item=>item.code===region);
 return {country:match?.country||'Global terminology only',
   countryRules:match?(COUNTRIES[match.code]?.length||0):0,
   globalRules:UNIVERSAL.length,
   scope:'keyword suggestions only; not a comprehensive banking taxonomy or transaction verification'};
}
