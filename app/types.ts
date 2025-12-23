
export type PactType = 'HOLD' | 'SHIP' | 'ATTEND';
export type PactStatus = 'ACTIVE' | 'PASSED' | 'FAILED' | 'PENDING';

export interface Pact {
  id: string;
  statement: string;
  type: PactType;
  stake: number;
  token: string;
  deadline: string;
  status: PactStatus;
  createdAt: string;
  creator: string;
  resolvedAt?: string;
}

export interface UserStats {
  address: string;
  pactsCreated: number;
  pactsPassed: number;
  pactsFailed: number;
  totalStaked: number;
}
