export type IPVersion = 4 | 6;
export type PoolMode = 'auto' | 'semi' | 'manual';
export type PoolStatus = 'active' | 'backup' | 'locked' | 'degraded' | 'offline';

export interface CandidateIP {
  ip: string;
  version: IPVersion;
  region?: string;
  carrier?: string;
  source: string;
  lastSeenAt: number;
}

export interface TestResult {
  ip: string;
  available: boolean;
  latencyMs?: number;
  tlsMs?: number;
  successRate?: number;
  speedMbps?: number;
  testedAt: number;
}

export interface ScoredCandidate extends CandidateIP {
  score: number;
  latencyMs?: number;
  successRate?: number;
  speedMbps?: number;
  regionScore: number;
  carrierScore: number;
}

export interface PoolConfig {
  id: string;
  name: string;
  region: string;
  carrier: string;
  size: number;
  updateIntervalMinutes: number;
  mode: PoolMode;
  ipv4: boolean;
  ipv6: boolean;
  locked: string[];
}

export interface PoolItem extends ScoredCandidate {
  id: string;
  status: PoolStatus;
  locked: boolean;
}
