/**
 * Well-posed debt decision audit: inputs, constraints, controllable outputs.
 * Two independent, explicitly non-ML tests must agree to call a repayment
 * affordable: normal-month budget vs adverse cashflow.
 * Unknown actuals or conflicting results cause an abstention.
 */
export type AuditAccount = { name: string; balance: number; apr: number; minimumPayment: number };
export type AuditInput = {
  accounts: AuditAccount[];
  monthlyIncome: number;
  monthlyEssentials: number;
  liquidFunds: number;
  reserveTarget: number;
  proposedExtra: number;
};
export type DebtDecisionAudit = {
  baselineHeadroom: number;
  adverseHeadroom: number;
  liquidAboveReserve: number;
  minimums: number;
  totalDebt: number;
  proposedExtra: number;
  budgetPass: boolean;
  stressPass: boolean;
  reservePass: boolean;
  verdict: 'within_constraints' | 'review_required' | 'unaffordable';
  reasons: string[];
  stressCases: { scenario: string; headroom: number; canCoverExtra: boolean }[];
  assumption: string;
};
function finitePositive(n: number, name: string): number {
  if (!Number.isFinite(n) || n < 0 || n > 1e11) throw Error(`Invalid or missing ${name}.`);
  return n;
}
export function auditDebtDecision(input: AuditInput): DebtDecisionAudit {
  if (!input.accounts.length || input.accounts.length > 50) throw Error('Provide between 1 and 50 current debt accounts.');
  const income=finitePositive(input.monthlyIncome,'income');
  const essentials=finitePositive(input.monthlyEssentials,'essential spending');
  const liquid=finitePositive(input.liquidFunds,'liquid funds');
  const reserve=finitePositive(input.reserveTarget,'reserve target');
  const extra=finitePositive(input.proposedExtra,'extra repayment');
  let minimums=0,totalDebt=0;
  for (const a of input.accounts) {
    if (!a.name.trim() || a.name.length>100) throw Error('Each debt must have a valid name.');
    totalDebt+=finitePositive(a.balance,'balance');
    finitePositive(a.apr,'APR');
    if (a.apr>200) throw Error('APR exceeds 200%.');
    minimums+=finitePositive(a.minimumPayment,'minimum monthly payment');
  }
  const headroom=income-essentials-minimums;
  const stressCases=[
    {scenario:'Base month',headroom},
    {scenario:'Income falls 15%',headroom:income*0.85-essentials-minimums},
    {scenario:'Essentials rise 15%',headroom:income-essentials*1.15-minimums},
    {scenario:'Combined income −15% / essentials +15%',headroom:income*0.85-essentials*1.15-minimums},
  ].map(s=>({...s,headroom:Math.round(s.headroom*100)/100,canCoverExtra:s.headroom>=extra && s.headroom>=0}));
  const adverse=stressCases.at(-1)!.headroom;
  const budgetPass=headroom>=extra && headroom>=0;
  const stressPass=adverse>=extra && adverse>=0;
  const reservePass=liquid>=reserve;
  const reasons:string[]=[];
  if (!reservePass) reasons.push('Emergency cash is below the entered reserve target; do not assume existing liquidity is free to spend.');
  if (!budgetPass) reasons.push('The proposed recurring extra exceeds income after essentials and contractual minimum debt payments.');
  if (budgetPass && !stressPass) reasons.push('The normal-month plan passes but fails the stated adverse cashflow check; neither method should silently override the other.');
  if (totalDebt===0) reasons.push('No positive debt balances remain. Verify before scheduling a repayment.');
  if (extra===0) reasons.push('Extra repayment is zero. This is a feasibility check, not a debt reduction instruction.');
  const verdict: DebtDecisionAudit['verdict'] = !budgetPass || !reservePass
    ? 'unaffordable' : !stressPass ? 'review_required' : 'within_constraints';
  return {
    baselineHeadroom: Math.round(headroom*100)/100,
    adverseHeadroom: adverse,
    liquidAboveReserve: Math.max(0,Math.round((liquid-reserve)*100)/100),
    minimums,totalDebt,proposedExtra:extra,budgetPass,stressPass,reservePass,verdict,reasons,stressCases,
    assumption: 'Illustrative fixed monthly inputs; shocks of −15% income and +15% essentials are scenario assumptions, not predictions. No bank balances, contractual minimums, fees or real-time transactions have been independently verified.',
  };
}
