export interface ScoreInput { latency?:number; successRate?:number; speed?:number; regionMatch?:number; carrierMatch?:number; }
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
export function score(x:ScoreInput) {
  const latency=x.latency==null?0:clamp(100-x.latency);
  return Math.round(latency*.25+clamp(x.successRate??0)*.30+clamp(x.speed??0)*.15+clamp(x.regionMatch??0)*.20+clamp(x.carrierMatch??0)*.10);
}
