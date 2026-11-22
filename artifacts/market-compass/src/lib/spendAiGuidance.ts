/**
 * Privacy-preserving automatic Spend coaching input. Only reviewed aggregates
 * are sent to the owner's authenticated HYPRBOX Ollama service when opt-in is on.
 * Raw transactions, merchant descriptions, bank IDs and browser vaults stay local.
 */
import {
  cycleAnalysis,cycleCashflowCutIdeas,type ExpenseEntry,
} from './monthlyExpenses.ts';

export function buildSpendCoachingRequest(
  entries:ExpenseEntry[],cycleStart:string,currency:string,cycleBudget:string
){
  const stats=cycleAnalysis(entries,cycleStart,currency,cycleBudget);
  if(stats.count===0)return null;
  const cuts=cycleCashflowCutIdeas(entries,cycleStart,currency);
  return {
    query:'From these owner-reviewed salary-cycle totals, give two specific, cautious ways to improve cash flow. Prioritize unused recurring costs and avoidable fees; protect essentials, debt minimums and an emergency buffer. Unsorted entries are not waste. Explain that any savings scenario is hypothetical, never verified or guaranteed.',
    financialContext:{
      currency,accounts:[],monthlyIncome:'',monthlyEssentials:'',liquidFunds:'',reserveTarget:'',
      expenseSummary:{
        cycleStart,cycleEnd:stats.cycle.lastDay,
        income:stats.income,expenses:stats.expenses,debtPayments:stats.debtPayments,
        transfers:stats.transfers,recordedDifference:stats.recordedDifference,
        entryCount:stats.count,cycleLimit:stats.budget,
        flags:[],
        categories:stats.byCategory.filter(x=>x.amount>0).slice(0,6)
          .map(x=>({category:x.label,amount:x.amount})),
        paymentMethods:[],
        unsortedCount:stats.unsortedCount,unsortedOutflow:stats.unsortedOutflow,
        illustrativeSavings:cuts.totalIllustrativeSavings,
        cutIdeas:cuts.ideas.slice(0,4).map(x=>({
          category:x.category,recorded:x.recorded,
          illustrativeSavings:x.illustrativeSavings,rate:x.rate
        }))
      }
    }
  };
}
