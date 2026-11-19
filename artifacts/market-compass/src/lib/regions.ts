export type RegionCode = 'ZA' | 'NA' | 'BW' | 'NG' | 'KE' | 'GH' | 'ZM' | 'TZ' | 'UG' | 'MU' | 'GB' | 'DE' | 'FR' | 'ES' | 'IT' | 'NL' | 'IE' | 'US' | 'CA' | 'AU' | 'NZ' | 'IN' | 'AE' | 'JP' | 'SG' | 'BR' | 'CH';
export type RegionItem = { code: RegionCode; country: string; currency: string; group: string };

export const REGIONS: RegionItem[] = [
  { code:'ZA', country:'South Africa', currency:'ZAR', group:'Africa' },
  { code:'NA', country:'Namibia', currency:'NAD', group:'Africa' },
  { code:'BW', country:'Botswana', currency:'BWP', group:'Africa' },
  { code:'NG', country:'Nigeria', currency:'NGN', group:'Africa' },
  { code:'KE', country:'Kenya', currency:'KES', group:'Africa' },
  { code:'GH', country:'Ghana', currency:'GHS', group:'Africa' },
  { code:'ZM', country:'Zambia', currency:'ZMW', group:'Africa' },
  { code:'TZ', country:'Tanzania', currency:'TZS', group:'Africa' },
  { code:'UG', country:'Uganda', currency:'UGX', group:'Africa' },
  { code:'MU', country:'Mauritius', currency:'MUR', group:'Africa' },
  { code:'GB', country:'United Kingdom', currency:'GBP', group:'Europe' },
  { code:'DE', country:'Germany', currency:'EUR', group:'Europe' },
  { code:'FR', country:'France', currency:'EUR', group:'Europe' },
  { code:'ES', country:'Spain', currency:'EUR', group:'Europe' },
  { code:'IT', country:'Italy', currency:'EUR', group:'Europe' },
  { code:'NL', country:'Netherlands', currency:'EUR', group:'Europe' },
  { code:'IE', country:'Ireland', currency:'EUR', group:'Europe' },
  { code:'CH', country:'Switzerland', currency:'CHF', group:'Europe' },
  { code:'US', country:'United States', currency:'USD', group:'Americas' },
  { code:'CA', country:'Canada', currency:'CAD', group:'Americas' },
  { code:'BR', country:'Brazil', currency:'BRL', group:'Americas' },
  { code:'AU', country:'Australia', currency:'AUD', group:'Asia & Pacific' },
  { code:'NZ', country:'New Zealand', currency:'NZD', group:'Asia & Pacific' },
  { code:'IN', country:'India', currency:'INR', group:'Asia & Pacific' },
  { code:'AE', country:'United Arab Emirates', currency:'AED', group:'Asia & Pacific' },
  { code:'JP', country:'Japan', currency:'JPY', group:'Asia & Pacific' },
  { code:'SG', country:'Singapore', currency:'SGD', group:'Asia & Pacific' },
];

export const CURRENCIES: { code: string; name: string }[] = [
  ['ZAR','South African rand'], ['NAD','Namibian dollar'], ['BWP','Botswana pula'],
  ['NGN','Nigerian naira'], ['KES','Kenyan shilling'], ['GHS','Ghanaian cedi'],
  ['ZMW','Zambian kwacha'], ['TZS','Tanzanian shilling'], ['UGX','Ugandan shilling'],
  ['MUR','Mauritian rupee'], ['USD','US dollar'], ['EUR','Euro'], ['GBP','British pound'],
  ['CAD','Canadian dollar'], ['AUD','Australian dollar'], ['NZD','New Zealand dollar'],
  ['INR','Indian rupee'], ['AED','UAE dirham'], ['JPY','Japanese yen'],
  ['SGD','Singapore dollar'], ['BRL','Brazilian real'], ['CHF','Swiss franc']
].map(([code, name]) => ({ code, name }));

export function regionDefaultCurrency(region: string) {
  return REGIONS.find(option => option.code === region)?.currency ?? 'ZAR';
}
export function detectRegion(): RegionCode {
  if (typeof navigator === 'undefined') return 'ZA';
  const locales = [...(navigator.languages || []), navigator.language].filter(Boolean);
  for (const locale of locales) {
    const match = locale.match(/[-_]([A-Za-z]{2})(?:-|$)/);
    const code = match?.[1]?.toUpperCase();
    if (code && REGIONS.some(r => r.code === code)) return code as RegionCode;
  }
  return 'ZA';
}
export function selectedRegion(region: string): RegionCode {
  return REGIONS.some(r => r.code === region) ? region as RegionCode : 'ZA';
}
