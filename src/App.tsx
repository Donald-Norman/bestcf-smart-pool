import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { CandidateIP, PoolConfig, PoolItem } from './types';
import './styles.css';

const initial: Omit<PoolConfig,'id'> = {
  name:'默认 IP 池', region:'HK', carrier:'auto', size:20,
  updateIntervalMinutes:30, mode:'auto', ipv4:true, ipv6:false, locked:[]
};

const regions = [['HK','香港'],['JP','日本'],['SG','新加坡'],['TW','台湾'],['KR','韩国'],['US','美国'],['GB','英国'],['DE','德国']];
const carriers = [['auto','自动'],['CMCC','中国移动'],['CUCC','中国联通'],['CTCC','中国电信'],['HKT','HKT'],['PCCW','PCCW'],['NTT','NTT'],['KDDI','KDDI']];

export default function App() {
  const [pools,setPools] = useState<PoolConfig[]>([]);
  const [pool,setPool] = useState<PoolConfig | null>(null);
  const [items,setItems] = useState<PoolItem[]>([]);
  const [candidates,setCandidates] = useState<CandidateIP[]>([]);
  const [selected,setSelected] = useState<string[]>([]);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState('');

  async function load() {
    try {
      const ps = await api.pools();
      setPools(ps);
      const p = ps[0] ?? await api.createPool(initial);
      setPool(p);
      setItems(await api.poolItems(p.id));
    } catch(e) { setError(String(e)); }
  }
  useEffect(()=>{load()},[]);

  const visible = useMemo(() => candidates.filter(x =>
    (!pool?.region || x.region === pool.region) &&
    (!pool?.carrier || pool.carrier === 'auto' || x.carrier === pool.carrier)
  ), [candidates,pool]);

  async function discover() {
    if (!pool) return;
    setBusy(true); setError('');
    try {
      const q = new URLSearchParams({region:pool.region,carrier:pool.carrier,ipv4:String(pool.ipv4),ipv6:String(pool.ipv6)});
      setCandidates(await api.candidates(q.toString()));
    } catch(e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function saveSelected() {
    if (!pool || !selected.length) return;
    setBusy(true);
    try {
      await api.addItems(pool.id,selected);
      setSelected([]);
      setItems(await api.poolItems(pool.id));
    } catch(e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function refresh() {
    if (!pool) return;
    setBusy(true);
    try { await api.refresh(pool.id); setItems(await api.poolItems(pool.id)); }
    catch(e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function change(field:keyof PoolConfig,value:any) {
    if (!pool) return;
    const next={...pool,[field]:value};
    setPool(next);
    if(field !== 'id') await api.updatePool(pool.id,{[field]:value});
  }

  return <main>
    <header className="hero">
      <div><div className="eyebrow">SMART IP POOL</div><h1>我的 IP 池</h1><p>地区 + 运营商驱动的候选与自动优选。</p></div>
      <button className="dark" onClick={refresh} disabled={busy}>{busy?'处理中…':'立即优选'}</button>
    </header>

    <section className="panel controls">
      <label>地区<select value={pool?.region??'HK'} onChange={e=>change('region',e.target.value)}>
        {regions.map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
      <label>运营商<select value={pool?.carrier??'auto'} onChange={e=>change('carrier',e.target.value)}>
        {carriers.map(([v,n])=><option key={v} value={v}>{n}</option>)}</select></label>
      <label>池容量<input type="number" min="1" max="200" value={pool?.size??20} onChange={e=>change('size',Number(e.target.value))}/></label>
      <label>更新频率<select value={pool?.updateIntervalMinutes??30} onChange={e=>change('updateIntervalMinutes',Number(e.target.value))}>
        {[15,30,60,120,360,720,1440].map(v=><option key={v} value={v}>{v<60?`${v} 分钟`:`${v/60} 小时`}</option>)}</select></label>
      <label>模式<select value={pool?.mode??'auto'} onChange={e=>change('mode',e.target.value)}>
        <option value="auto">自动优选</option><option value="semi">半自动</option><option value="manual">手动</option>
      </select></label>
      <button onClick={discover} disabled={busy}>获取候选</button>
    </section>

    {error && <div className="error">{error}</div>}

    <section className="stats">
      <div><b>{items.length}</b><span>池内 IP</span></div>
      <div><b>{items.filter(x=>x.status!=='offline').length}</b><span>可用</span></div>
      <div><b>{items.filter(x=>x.locked).length}</b><span>锁定</span></div>
      <div><b>{selected.length}</b><span>已选择</span></div>
    </section>

    <section className="panel">
      <div className="sectionHead"><div><h2>候选 IP</h2><span>{visible.length} 个候选</span></div><button onClick={()=>setSelected(selected.length?[]:visible.map(x=>x.ip))}>{selected.length?'取消全选':'全选'}</button></div>
      <div className="table">
        <div className="tr th"><span></span><span>IP</span><span>地区</span><span>运营商</span><span>来源</span></div>
        {visible.map(x=><div className="tr" key={x.ip}>
          <input type="checkbox" checked={selected.includes(x.ip)} onChange={()=>setSelected(s=>s.includes(x.ip)?s.filter(v=>v!==x.ip):[...s,x.ip])}/>
          <code>{x.ip}</code><span>{x.region??'—'}</span><span>{x.carrier??'—'}</span><span>{x.source}</span>
        </div>)}
      </div>
      <button className="primary" onClick={saveSelected} disabled={!selected.length||busy}>加入我的 IP 池 · {selected.length}</button>
    </section>

    <section className="panel">
      <div className="sectionHead"><div><h2>我的 IP 池</h2><span>自动模式会在刷新时重新评分并补齐池容量</span></div></div>
      <div className="table">
        <div className="tr th"><span>状态</span><span>IP</span><span>评分</span><span>延迟</span><span>操作</span></div>
        {items.sort((a,b)=>b.score-a.score).map(x=><div className="tr" key={x.id}>
          <span className={`status ${x.status}`}>{x.locked?'锁定':x.status}</span><code>{x.ip}</code><span>{x.score}</span><span>{x.latencyMs?`${x.latencyMs} ms`:'—'}</span>
          <span className="actions"><button onClick={()=>api.lockItem(pool!.id,x.id,!x.locked).then(()=>api.poolItems(pool!.id)).then(setItems)}>{x.locked?'解锁':'锁定'}</button><button onClick={()=>api.removeItem(pool!.id,x.id).then(()=>api.poolItems(pool!.id)).then(setItems)}>移除</button></span>
        </div>)}
      </div>
    </section>
  </main>
}
