import type { Source } from './types';

export const DEFAULT_SOURCES: Source[] = [
  // Add only sources you are authorized to consume. Keep URLs in SOURCES_JSON in production.
];

export function getSources(env: {SOURCES_JSON?:string}): Source[] {
  if (!env.SOURCES_JSON) return DEFAULT_SOURCES;
  try {
    const parsed = JSON.parse(env.SOURCES_JSON);
    return Array.isArray(parsed) ? parsed : DEFAULT_SOURCES;
  } catch { return DEFAULT_SOURCES; }
}

export function normalizeText(text:string, source:Source) {
  const seen = new Set<string>();
  return text.split(/\\r?\\n/)
    .map(x=>x.trim().split(/[:#\\s]/)[0])
    .filter(ip=>{
      if(!ip || seen.has(ip)) return false;
      const v4=/^\\d{1,3}(?:\\.\\d{1,3}){3}$/.test(ip);
      const v6=ip.includes(':');
      if(!v4&&!v6)return false;
      seen.add(ip); return true;
    })
    .map(ip=>({ip,version:ip.includes(':')?6:4,region:source.region??null,carrier:source.carrier??null,source:source.id,last_seen_at:Date.now()}));
}
