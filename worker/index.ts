import type { Env } from './types';
import { getSources, normalizeText } from './sources';
import { score } from './scoring';

const json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json;charset=UTF-8','access-control-allow-origin':'*','access-control-allow-headers':'content-type,authorization'}});
const id=()=>crypto.randomUUID();

async function auth(req:Request,env:Env){
  if(!env.ADMIN_TOKEN)return true;
  return req.headers.get('authorization')===`Bearer ${env.ADMIN_TOKEN}`;
}
async function getPool(env:Env,poolId:string){
  return env.DB.prepare('SELECT * FROM pools WHERE id=?').bind(poolId).first();
}
async function discover(env:Env,region:string,carrier:string,ipv4=true,ipv6=false){
  const sources=getSources(env).filter(s=>s.enabled!==false&&(!s.region||s.region===region)&&(!s.carrier||carrier==='auto'||s.carrier===carrier));
  const all:any[]=[];
  for(const s of sources){
    try{
      const r=await fetch(s.url,{signal:AbortSignal.timeout(8000)});
      if(!r.ok)continue;
      all.push(...normalizeText(await r.text(),s));
    }catch{}
  }
  const unique=new Map<string,any>();
  for(const x of all){
    if((x.version===4&&ipv4)||(x.version===6&&ipv6))unique.set(x.ip,x);
  }
  return [...unique.values()];
}

async function rebalance(env:Env,pool:any){
  const candidates=await discover(env,pool.region,pool.carrier,!!pool.ipv4,!!pool.ipv6);
  const now=Date.now();
  const existing:any=await env.DB.prepare('SELECT * FROM pool_items WHERE pool_id=?').bind(pool.id).all();
  const locked=new Set((existing.results??[]).filter((x:any)=>x.locked).map((x:any)=>x.ip));
  for(const c of candidates){
    const existingItem=(existing.results??[]).find((x:any)=>x.ip===c.ip) as any;
    const s=existingItem?.score??score({regionMatch:c.region===pool.region?100:0,carrierMatch:pool.carrier==='auto'||c.carrier===pool.carrier?100:0});
    await env.DB.prepare(`INSERT INTO pool_items
      (id,pool_id,ip,version,region,carrier,source,status,locked,score,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(pool_id,ip) DO UPDATE SET source=excluded.source,region=excluded.region,carrier=excluded.carrier,updated_at=excluded.updated_at`)
      .bind(existingItem?.id??id(),pool.id,c.ip,c.version,c.region,c.carrier,c.source,'active',locked.has(c.ip)?1:0,s,now,now).run();
  }
  const rows:any=await env.DB.prepare('SELECT * FROM pool_items WHERE pool_id=? ORDER BY locked DESC,score DESC,updated_at DESC').bind(pool.id).all();
  const keep=(rows.results??[]).filter((x:any)=>x.locked).map((x:any)=>x.id);
  for(const x of (rows.results??[])) if(!x.locked && keep.length<pool.size) keep.push(x.id);
  const placeholders=keep.map(()=>'?').join(',');
  if(placeholders) await env.DB.prepare(`DELETE FROM pool_items WHERE pool_id=? AND id NOT IN (${placeholders}) AND locked=0`).bind(pool.id,...keep).run();
  else await env.DB.prepare('DELETE FROM pool_items WHERE pool_id=? AND locked=0').bind(pool.id).run();
  await env.DB.prepare('UPDATE pools SET updated_at=? WHERE id=?').bind(now,pool.id).run();
  return {added:candidates.length,removed:Math.max(0,(rows.results??[]).length-keep.length)};
}

export default {
 async fetch(req:Request,env:Env):Promise<Response>{
  if(req.method==='OPTIONS')return new Response(null,{headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,PATCH,DELETE','access-control-allow-headers':'content-type,authorization'}});
  if(!(await auth(req,env)))return json({error:'Unauthorized'},401);
  const u=new URL(req.url),p=u.pathname;
  try{
   if(p==='/api/health')return json({ok:true,time:Date.now()});
   if(p==='/api/pools'&&req.method==='GET'){
    const r=await env.DB.prepare('SELECT * FROM pools ORDER BY updated_at DESC').all(); return json(r.results);
   }
   if(p==='/api/pools'&&req.method==='POST'){
    const b:any=await req.json(); const now=Date.now(),pid=id();
    await env.DB.prepare(`INSERT INTO pools(id,name,region,carrier,size,update_interval_minutes,mode,ipv4,ipv6,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(pid,b.name??'默认 IP 池',b.region??'HK',b.carrier??'auto',Math.max(1,Math.min(200,Number(b.size??20))),Number(b.updateIntervalMinutes??30),b.mode??'auto',b.ipv4!==false?1:0,b.ipv6?1:0,now,now).run();
    return json(await getPool(env,pid),201);
   }
   const m=p.match(/^\/api\/pools\/([^/]+)(?:\/(.*))?$/);
   if(m){
    const pid=m[1],sub=m[2]??'',pool=await getPool(env,pid); if(!pool)return json({error:'Pool not found'},404);
    if(!sub&&req.method==='GET')return json(pool);
    if(!sub&&req.method==='PATCH'){
      const b:any=await req.json();
      const allowed=['name','region','carrier','size','updateIntervalMinutes','mode','ipv4','ipv6'];
      for(const k of allowed)if(b[k]!==undefined){
        const col=k==='updateIntervalMinutes'?'update_interval_minutes':k;
        await env.DB.prepare(`UPDATE pools SET ${col}=?,updated_at=? WHERE id=?`).bind(b[k],Date.now(),pid).run();
      }
      return json(await getPool(env,pid));
    }
    if(sub==='items'&&req.method==='GET'){
      const r=await env.DB.prepare('SELECT * FROM pool_items WHERE pool_id=? ORDER BY locked DESC,score DESC').bind(pid).all();return json(r.results);
    }
    if(sub==='items'&&req.method==='POST'){
      const b:any=await req.json();const ips:Array<string>=Array.isArray(b.ips)?b.ips:[];
      for(const ip of ips){
        await env.DB.prepare(`INSERT OR IGNORE INTO pool_items(id,pool_id,ip,version,status,locked,score,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`)
          .bind(id(),pid,ip,ip.includes(':')?6:4,'active',0,0,Date.now(),Date.now()).run();
      }
      return json({ok:true});
    }
    const im=sub.match(/^items\/([^/]+)$/);
    if(im&&req.method==='DELETE'){await env.DB.prepare('DELETE FROM pool_items WHERE id=? AND pool_id=?').bind(im[1],pid).run();return json({ok:true});}
    if(im&&req.method==='PATCH'){const b:any=await req.json();await env.DB.prepare('UPDATE pool_items SET locked=?,status=?,updated_at=? WHERE id=? AND pool_id=?').bind(b.locked?1:0,b.locked?'locked':'active',Date.now(),im[1],pid).run();return json({ok:true});}
    if(sub==='refresh'&&req.method==='POST')return json({ok:true,...await rebalance(env,pool)});
   }
   if(p==='/api/candidates'&&req.method==='GET'){
    const r=u.searchParams.get('region')??'HK',c=u.searchParams.get('carrier')??'auto';
    const data=await discover(env,r,c,u.searchParams.get('ipv4')!=='false',u.searchParams.get('ipv6')==='true');
    return json(data);
   }
   return json({error:'Not found'},404);
  }catch(e){return json({error:e instanceof Error?e.message:'Internal error'},500)}
 },
 async scheduled(_event:ScheduledEvent,env:Env){const r=await env.DB.prepare('SELECT * FROM pools').all();for(const p of r.results as any[])await rebalance(env,p);}
} satisfies ExportedHandler<Env>;
