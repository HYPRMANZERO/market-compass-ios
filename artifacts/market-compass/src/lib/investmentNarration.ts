/**
 * Investment / dividend / interest / savings evidence, evaluated only after
 * the owner's explicit scan. Platform names, exchanges and payment rails alone
 * never establish ownership, an investment purchase, or a realized cashflow.
 * No network access, orders, tax computation, or bank balance inference.
 */
import type {ExpenseKind,ExpenseCategory} from './monthlyExpenses.ts';
import {normalizeFinancialNarration} from './regionalSpendRules.ts';

export type InvestmentCategoryProposal={
  kind:ExpenseKind;category:ExpenseCategory;reason:string;
};

const match=(s:string,p:RegExp)=>p.test(s);
const result=(kind:ExpenseKind,category:ExpenseCategory,reason:string):InvestmentCategoryProposal=>
  ({kind,category,reason});

const platformGlobal=/\b(?:interactive brokers|ibkr|saxo bank|saxo markets|etoro|trading 212|trading212)\b/;
const platformRegion:Partial<Record<string,RegExp>>={
  ZA:/\b(?:easyequities|easy equities|satrixnow|satrix now|sygnia alchemy|sygnia investment|sygnia direct investment|allan gray investment|fnb share investor|absa stockbrokers|standard bank stockbroking|standard bank share trading|shyft investments|shyft shares|shyft stock trading|shyft etf|10x investments)\b/,
  US:/\b(?:fidelity investments|charles schwab|robinhood investing|robinhood brokerage|vanguard brokerage|e trade brokerage|etrade brokerage|webull investing|m1 finance|acorns investing)\b/,
  GB:/\b(?:hargreaves lansdown|aj bell|freetrade investing|nutmeg investments|vanguard uk investing|investengine|interactive investor)\b/,
  CA:/\b(?:wealthsimple invest|wealthsimple trade|questrade|qtrade investing|rbc direct investing)\b/,
  AU:/\b(?:commsec investing|commsec share trading|stake australia|selfwealth|pearler|nabtrade)\b/,
  NZ:/\b(?:sharesies|hatch invest|investnow nz|kernel wealth)\b/,
  IN:/\b(?:zerodha|groww investing|upstox|angel one brokerage|icici direct|hdfc securities)\b/,
  DE:/\b(?:trade republic|scalable capital|flatex|comdirect brokerage)\b/,
  FR:/\b(?:boursorama bourse|boursobank bourse|trade republic|fortuneo bourse)\b/,
  NL:/\b(?:degiro|de giro|bux investing|brand new day beleggen)\b/,
  ES:/\b(?:myinvestor inversiones|renta 4 broker|degiro|trade republic)\b/,
  IT:/\b(?:fineco trading|directa sim|trade republic|degiro)\b/,
  IE:/\b(?:davy select|degiro|trading 212)\b/,
  CH:/\b(?:swissquote|yuh investments|postfinance e trading)\b/,
  BR:/\b(?:nu invest|nublack investimentos|xp investimentos|rico investimentos|clear corretora|btg pactual investimentos)\b/,
  JP:/\b(?:rakuten securities|sbi securities|monex securities)\b/,
  SG:/\b(?:tiger brokers|moomoo singapore|endowus|syfe invest|poems trading)\b/,
  AE:/\b(?:baraka investments|sarwa invest|wio invest|trading 212)\b/,
  KE:/\b(?:ndovu investments|hisa investing)\b/,
  NG:/\b(?:bamboo investing|trove finance|risevest)\b/
};
const actionFunding=/\b(?:deposit|deposited|funding|funded|top up|topup|recharge|contribution|contributed|transfer to|eft|bank payment to|payment to|investment payment|cash deposit|wallet fund)\b/;
const investmentProduct=/\b(?:brokerage account|trading account|investment account|investment portfolio|investment fund|unit trust|exchange traded fund|etf|mutual fund|index fund|stockbroker|share dealing)\b/;
const purchaseVerb=/\b(?:buy|bought|purchase|purchased|subscription|subscribe|investment|invested|contribution|deposit|transfer to|funding)\b/;
const securities=/\b(?:shares?|stocks?|etfs?|units?|bonds?|securities|equities|funds?)\b/;
const investmentFunding=/\b(?:deposit (?:to|into) (?:my |own )?(?:investment|brokerage|trading) account|transfer to (?:my |own )?(?:investment|brokerage|trading) account|investment account (?:top up|deposit|funding|transfer)|brokerage (?:top up|deposit|funding|transfer)|buy (?:shares?|stocks?|etfs?|bonds?|securities)|purchase (?:shares?|stocks?|etfs?|bonds?|securities)|share purchase|shares buy|stock buy|etf purchase|unit trust contribution|investment contribution|monthly investment contribution)\b/;
const tfsaWithShares=/\b(?:tax free savings|tax free investment|tfsa)\b.*\b(?:etf|shares?|equities|investment|funds?)\b/;
const savingsMovement=/\b(?:transfer (?:to|from) (?:my |own )?(?:savings|saving) (?:account|pocket)|savings account (?:deposit|withdrawal|transfer|top up|contribution)|deposit (?:into|to) (?:my |own )?savings|monthly savings contribution|move (?:to|from) (?:my |own )?savings|emergency fund (?:transfer|deposit|top up)|savings pocket (?:transfer|deposit|withdrawal)|withdrawal from (?:my |own )?savings account|transfer (?:to|from) savings|automatic transfer to savings|roundup to savings)\b/;
const retirementInvestment=/\b(?:retirement annuity|pension fund contribution|provident fund contribution)\b.*\b(?:contribution|deposit|payment|investment|top up)\b/;
const platformFee=/\b(?:brokerage fee|broker fee|trading commission|stockbroking fee|platform fee|custody fee|management fee|portfolio management fee|investment administration fee|exchange settlement fee|jse settlement fee|clearing fee|etf management fee|fund management fee|advisory fee|investment fee)\b/;
const dividendWithholding=/\b(?:dividend(?:s)? withholding tax|dividend(?:s)? tax withheld|withholding tax on dividend(?:s)?|dwt deduction|dividend tax deduction)\b/;
const paidDividend=/\b(?:dividend(?:s)? (?:paid|received|credited|credit|payout|payment|distribution|income|cash)|cash dividend(?:s)?|div(?:idend)? (?:distribution|credit|received|paid)|div pay|div credit|distribution from (?:etf|unit trust|fund|shares)|etf distribution (?:paid|credited|received)|fund distribution (?:paid|credited|received))\b/;
const dividendOnly=/\bdividend(?:s)?\b/;
const paidInterest=/\b(?:interest (?:earned|received|credited|credit|paid to|payout|income)|interest cr|savings interest|deposit interest (?:paid|credited|earned|received)|interest on savings (?:account )?(?:earned|received|credited)|bond coupon (?:received|paid|credited)|coupon interest (?:received|credited))\b/;
const interestCharge=/\b(?:interest charged|interest debit|loan interest charge|overdraft interest|credit card interest|interest on loan|interest payable|finance interest charge|interest charges)\b/;
const ambiguousAccrual=/\b(?:dividend (?:accrual|accrued|declared|forecast|pending|expected|reinvest(?:ment|ed)|drip)|drip (?:dividend|reinvestment)|reinvestment (?:of )?dividend|interest (?:accrual|accrued|projected|pending|estimated)|distribution (?:announced|forecast|pending)|estimated dividend|maturity (?:proceeds|payment)|fixed deposit maturity|fund switch|switch between funds|interest capitalized)\b/;
const moneyOutOfBroker=/\b(?:withdrawal from (?:my |own )?(?:brokerage|investment|trading) account|transfer from (?:my |own )?(?:brokerage|investment|trading) account|investment account withdrawal|brokerage account withdrawal|sale proceeds transferred (?:from|to) (?:my |own )?(?:brokerage|bank) account)\b/;
const knownIncomeReversal=/\b(?:reversal|chargeback|refund|pending|declined|cancelled|unpaid|failed|reversed|correction)\b/;

export function classifyInvestmentNarration(
  kind:ExpenseKind,description:string,region:string
):InvestmentCategoryProposal|null{
  const text=normalizeFinancialNarration(description);
  if(!text||match(text,knownIncomeReversal)||match(text,ambiguousAccrual))return null;
  const platform=match(text,platformGlobal)||Boolean(platformRegion[region]?.test(text));
  const isInvestFunding=match(text,investmentFunding)||
    (match(text,investmentProduct)&&match(text,actionFunding))||
    (platform&&match(text,actionFunding))||
    (match(text,purchaseVerb)&&match(text,securities)&&match(text,/\b(?:share purchase|shares purchased|stock purchase|stocks bought|etf purchase|securities purchase|units purchased|buy shares|buy stocks|buy etf|purchase etf|purchase shares)\b/))||
    match(text,tfsaWithShares)&&match(text,actionFunding)||
    match(text,retirementInvestment);

  // Dividends withheld are deductions, never distributed cash dividends.
  if(match(text,dividendWithholding))
    return kind==='expense'?result('expense','taxes',
      'Explicit dividend withholding tax deduction, not a dividend received'):null;
  if(kind==='income'){
    if(match(text,paidDividend))
      return result('income','dividends','Dividend/distribution credited as income; verify that cash actually posted');
    if(match(text,paidInterest)&&!match(text,interestCharge))
      return result('income','interest','Interest or coupon income credited; not an interest charge');
    if(match(text,moneyOutOfBroker))
      return result('transfer','investments','Investment account withdrawal or sale proceeds; not assumed profit');
    if(match(text,savingsMovement)&&/\b(?:from|withdrawal)\b/.test(text))
      return result('transfer','savings','Withdrawal from a savings account; not income earned');
    return null;
  }
  if(kind==='debt-payment')return null;
  // An interest debit is a cost, not interest earned.
  if(match(text,interestCharge)||match(text,platformFee))
    return result('expense','fees','Explicit interest charge, brokerage, trading or custody fee');
  // Never convert an outgoing debit into interest or dividend income.
  if(match(text,paidDividend)||match(text,paidInterest))return null;
  if(isInvestFunding)
    return result('transfer','investments',
      platform?'Brokerage/platform funding: confirm the destination belongs to you':
        'Investment purchase/contribution: confirm ownership and that this was not a fee');
  if(match(text,savingsMovement))
    return result('transfer','savings','Savings transfer or deposit: confirm the account belongs to you');
  return null;
}

export function supportedInvestingPlatformRegion(region:string){
  return {region,hasRegionalPlatformTerms:Boolean(platformRegion[region]),
    globalBrokerTerms:true,mode:'description-only suggestions with explicit approval'};
}
