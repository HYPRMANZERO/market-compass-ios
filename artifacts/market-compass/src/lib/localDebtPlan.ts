import type { DebtPlan, DebtPlanInput, PayoffScenario } from '@workspace/api-client-react';

type Ledger = { name: string; balance: number; apr: number; minimumPayment: number; original: number };

function simulate(accounts: Ledger[], extra: number, strategy: 'avalanche' | 'snowball'): PayoffScenario {
  const debts = accounts.map(a => ({ ...a }));
  const monthlyBudget = debts.reduce((sum, item) => sum + item.minimumPayment, 0) + extra;
  const epsilon = 0.005;
  let months = 0, totalPaid = 0, totalInterest = 0;
  let amortized = debts.every(item => item.balance <= epsilon);
  // Cap pathological schedules; a plan that cannot repay is explicitly marked as non-amortizing.
  const monthLimit = 600;
  while (!amortized && months < monthLimit) {
    if (monthlyBudget <= epsilon) break;
    months++;
    for (const debt of debts) {
      if (debt.balance <= epsilon) continue;
      const interest = debt.balance * debt.apr / 1200;
      debt.balance += interest;
      totalInterest += interest;
    }
    let available = monthlyBudget;
    for (const debt of debts) {
      const payment = Math.min(Math.max(debt.balance, 0), debt.minimumPayment, available);
      debt.balance = Math.max(0, debt.balance - payment);
      available -= payment;
      totalPaid += payment;
    }
    const rank = [...debts].sort((a,b) => strategy === 'avalanche'
      ? (b.apr - a.apr || a.balance - b.balance)
      : (a.balance - b.balance || b.apr - a.apr));
    for (const debt of rank) {
      if (available <= epsilon) break;
      const payment = Math.min(debt.balance, available);
      debt.balance = Math.max(0, debt.balance - payment);
      available -= payment;
      totalPaid += payment;
    }
    amortized = debts.every(debt => debt.balance <= epsilon);
    // Guard against unbounded numerical growth from high interest and tiny repayments.
    if (!debts.every(debt => Number.isFinite(debt.balance) && debt.balance < 1e15)) break;
  }
  return { strategy, months, totalInterest, totalPaid, amortized };
}

/**
 * Local-only, illustrative payoff schedule; no bank or personal account access.
 * Fixed APR, monthly compound interest, and a fixed total monthly payment
 * equal to the entered minimums plus monthlyExtra. Extra/released minimums
 * are redirected by strategy after current minimums are paid.
 */
export function calculateLocalDebtPlan(input: DebtPlanInput): DebtPlan {
  if (!input.accounts.length) throw new Error('Add at least one debt account before comparing payoff plans.');
  if (input.accounts.length > 50) throw new Error('A maximum of 50 debt accounts is supported.');
  if (![input.monthlyExtra, input.emergencyReserve ?? 0].every(v => Number.isFinite(v) && v >= 0)) {
    throw new Error('Extra payment and emergency reserve must be non-negative amounts.');
  }
  const accounts = input.accounts.map(a => {
    if (!a.name.trim() || ![a.balance,a.apr,a.minimumPayment].every(Number.isFinite) || a.balance < 0 || a.apr < 0 || a.apr > 200 || a.minimumPayment < 0) {
      throw new Error('Enter valid account names, balances, annual interest rates and monthly minimum payments.');
    }
    return { ...a, original: a.balance };
  });
  const totalPrincipal = accounts.reduce((sum, a) => sum + a.balance, 0);
  const scenarios = [
    simulate(accounts, input.monthlyExtra, 'avalanche'),
    simulate(accounts, input.monthlyExtra, 'snowball')
  ];
  return {
    currency: input.currency, totalPrincipal, monthlyExtra: input.monthlyExtra, scenarios,
    notes: [
      'Illustration only: assumes fixed annual rates, monthly compounding and monthly payments; it is not a lender quote.',
      'The total monthly repayment budget equals your entered minimum payments plus the extra monthly amount. Minimums freed as debts close are redirected to remaining balances.',
      'The emergency reserve is displayed for planning but is not withdrawn or used for debt repayments.',
      'Payments are never initiated; bank balances, fees, early settlement penalties, due dates and variable interest are not verified.',
      ...(scenarios.some(s => !s.amortized) ? ['At least one strategy did not pay off within the 600-month calculation limit; increase repayments or review terms.'] : [])
    ]
  };
}
