/**
 * Market Compass independent on-device synthetic cash-flow challenger.
 *
 * Two scikit-learn models were trained only on deterministic synthetic scenarios
 * on HYPRBOX. This exports their coefficients/tree as ordinary arithmetic,
 * without Ollama, a remote model, tokens, network calls, personal-data training,
 * or any ability to change an account or execute financial transactions.
 *
 * A classifier score describes consistency with artificial stress labels, not
 * the probability of actual loan default. Deterministic budget and reserve
 * checks always remain authoritative.
 */
import { SYNTHETIC_DEBT_RISK_MODEL as MODEL } from './syntheticDebtRiskModel.ts';

export type IndependentDebtInput = {
  monthlyIncome: number;
  monthlyEssentials: number;
  liquidFunds: number;
  reserveTarget: number;
  proposedExtra: number;
  accounts: Array<{balance:number; apr:number; minimumPayment:number}>;
};
export type IndependentDebtScore = {
  available:boolean;
  abstained:boolean;
  stressRiskScore:number|null;
  challengers?:{logisticSyntheticScore:number;treeSyntheticScore:number};
  disagreement?:number;
  outOfDistribution?:boolean;
  reason:string;
  interpretation:string;
  trainedOnUserTransactions:false;
  calibratedToActualDefaultEvents:false;
  modelVersion:string;
  mode:'local-independent';
};

const round4=(value:number)=>Math.round(value*10000)/10000;
const fail=(reason:string):IndependentDebtScore=>({
  available:false, abstained:true, stressRiskScore:null, reason,
  interpretation:'No model score. Provide complete current cash-flow data and independently check debt affordability.',
  trainedOnUserTransactions:false,calibratedToActualDefaultEvents:false,
  modelVersion:MODEL.schema,mode:'local-independent',
});
const finiteMoney=(value:unknown,name:string,max=1e11):number=>{
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max)
    throw Error('Invalid or missing '+name);
  return value;
};
const SCHEMA='market-compass-synthetic-risk-v2';
const EXPECTED_FEATURES=['income_coverage','debt_service_ratio','reserve_coverage','extra_ratio','interest_pressure'];

function syntheticFeatures(ctx:IndependentDebtInput):number[]{
  const income=finiteMoney(ctx.monthlyIncome,'monthly income');
  const essentials=finiteMoney(ctx.monthlyEssentials,'monthly essentials');
  const liquid=finiteMoney(ctx.liquidFunds,'liquid funds');
  const reserve=finiteMoney(ctx.reserveTarget,'reserve target');
  const extra=finiteMoney(ctx.proposedExtra,'proposed extra');
  // Absolute ratios also fail closed: feature transforms can compress very large
  // cash-flow values into an apparently familiar range for synthetic training.
  if(income>0 && (essentials>income*3||extra>income*2||liquid>income*100||reserve>income*100))
    throw Error('Cash-flow ratios are outside the conservative synthetic model domain');
  if(!Array.isArray(ctx.accounts)||ctx.accounts.length<1||ctx.accounts.length>30)
    throw Error('Confirm 1 to 30 debt accounts for this model');
  let minimums=0;
  let interest=0;
  for(const [index,account] of ctx.accounts.entries()){
    if(!account||typeof account!=='object')throw Error('Invalid account '+index);
    const balance=finiteMoney(account.balance,'balance');
    const apr=finiteMoney(account.apr,'APR',200);
    const payment=finiteMoney(account.minimumPayment,'minimum payment');
    minimums+=payment;
    interest+=balance*apr/1200;
  }
  if(income<=0)return [0,5,liquid/Math.max(essentials+minimums,1),5,interest/Math.max(minimums,1)];
  return [
    income/Math.max(essentials+minimums,1),
    minimums/income,
    liquid/Math.max(reserve,1),
    extra/income,
    interest/Math.max(minimums,1),
  ];
}
function positiveTreeProbability(vector:number[]):number {
  const tree=MODEL.decisionTree;
  let node=0;
  for(let steps=0;steps<tree.feature.length+1;steps++){
    if(!Number.isInteger(node)||node<0||node>=tree.feature.length)throw Error('Tree index invalid');
    const feature=tree.feature[node];
    if(feature<0){
      const p=tree.probability[node];
      if(!Number.isFinite(p)||p<0||p>1)throw Error('Tree probability invalid');
      return p;
    }
    if(feature>=vector.length)throw Error('Tree feature invalid');
    node=vector[feature]<=tree.threshold[node]?tree.children_left[node]:tree.children_right[node];
  }
  throw Error('Tree cycle detected');
}
function logisticProbability(vector:number[]):number {
  const linear=MODEL.logistic;
  let z:number=linear.intercept;
  for(let i=0;i<vector.length;i++)
    z+=(vector[i]-linear.mean[i])/Math.max(linear.scale[i],1e-9)*linear.coefficients[i];
  z=Math.max(-50,Math.min(50,z));
  return 1/(1+Math.exp(-z));
}
export function scoreIndependentDebtStress(ctx:IndependentDebtInput):IndependentDebtScore {
  if(MODEL.schema!==SCHEMA||MODEL.isPersonalModel!==false||
    MODEL.calibratedToActualDefaultEvents!==false||MODEL.isInvestmentForecast!==false||
    MODEL.features.join('|')!==EXPECTED_FEATURES.join('|')||
    MODEL.adversarialAgreementThreshold!==0.2||
    MODEL.outOfDistributionStandardDeviations!==4)
    return fail('Independent model validation failed. No score has been issued.');
  let vector:number[];
  try{vector=syntheticFeatures(ctx);}
  catch(error){return fail(error instanceof Error?error.message:'Incomplete financial inputs');}
  if(vector.some(value=>!Number.isFinite(value)))return fail('Input produced a nonfinite feature');
  try{
    const logistic=logisticProbability(vector);
    const tree=positiveTreeProbability(vector);
    const disagreement=Math.abs(logistic-tree);
    const outOfDistribution=vector.some((x,i)=>
      Math.abs((x-MODEL.logistic.mean[i])/Math.max(MODEL.logistic.scale[i],1e-9))>
      MODEL.outOfDistributionStandardDeviations
    );
    const abstained=disagreement>MODEL.adversarialAgreementThreshold||outOfDistribution;
    const selection:string=MODEL.selectedByValidationBrier;
    const chosen=selection==='logistic'?logistic:tree;
    return {
      available:true,abstained,
      stressRiskScore:abstained?null:round4(chosen),
      challengers:{logisticSyntheticScore:round4(logistic),treeSyntheticScore:round4(tree)},
      disagreement:round4(disagreement),outOfDistribution,
      reason:abstained
        ? outOfDistribution?'Current figures are outside the synthetic training range; no score issued.'
          :'The independent challengers disagree by more than 20 percentage points; no score issued.'
        :'Both synthetic challengers agree within the configured threshold.',
      interpretation:'SYNTHETIC scenario fragility only; not a real-world default probability, investment prediction or repayment instruction.',
      trainedOnUserTransactions:false,calibratedToActualDefaultEvents:false,
      modelVersion:MODEL.schema,mode:'local-independent',
    };
  } catch{return fail('Independent scorer could not safely evaluate these inputs');}
}
