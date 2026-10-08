import type { CandidateIP, PoolConfig, PoolItem } from './types';

const API_BASE = import.meta.env.VITE_API_BASE ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) }
  });
  if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
  return r.json();
}

export const api = {
  pools: () => request<PoolConfig[]>('/api/pools'),
  poolItems: (id: string) => request<PoolItem[]>(`/api/pools/${id}/items`),
  createPool: (body: Omit<PoolConfig,'id'>) =>
    request<PoolConfig>('/api/pools', { method:'POST', body:JSON.stringify(body) }),
  updatePool: (id:string, body:Partial<PoolConfig>) =>
    request<PoolConfig>(`/api/pools/${id}`, {method:'PATCH',body:JSON.stringify(body)}),
  candidates: (params:string) => request<CandidateIP[]>(`/api/candidates?${params}`),
  addItems: (id:string, ips:string[]) =>
    request<{ok:boolean}>(`/api/pools/${id}/items`,{method:'POST',body:JSON.stringify({ips})}),
  removeItem: (poolId:string,itemId:string) =>
    request<{ok:boolean}>(`/api/pools/${poolId}/items/${itemId}`,{method:'DELETE'}),
  lockItem: (poolId:string,itemId:string,locked:boolean) =>
    request<{ok:boolean}>(`/api/pools/${poolId}/items/${itemId}`,{method:'PATCH',body:JSON.stringify({locked})}),
  refresh: (id:string) => request<{ok:boolean,added:number,removed:number}>(`/api/pools/${id}/refresh`,{method:'POST'})
};
