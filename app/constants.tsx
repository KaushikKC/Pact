
import { Pact } from './types';

export const MOCK_PACTS: Pact[] = [
  {
    id: 'pact-1',
    statement: "I will not sell my $MOVE tokens before the end of Q1 2025.",
    type: 'HOLD',
    stake: 1200,
    token: 'MOVE',
    deadline: '2025-03-30T23:59:59Z',
    status: 'ACTIVE',
    createdAt: '2024-12-01T10:00:00Z',
    creator: '0x742...f41',
  },
  {
    id: 'pact-2',
    statement: "I will ship the beta version of the Pact SDK by next Friday.",
    type: 'SHIP',
    stake: 500,
    token: 'USDT',
    deadline: '2025-01-10T18:00:00Z',
    status: 'PASSED',
    createdAt: '2024-12-25T14:30:00Z',
    creator: '0x123...abc',
    resolvedAt: '2025-01-10T17:45:00Z',
  },
  {
    id: 'pact-3',
    statement: "I will attend the Movement Builders meetup in Lisbon.",
    type: 'ATTEND',
    stake: 100,
    token: 'MOVE',
    deadline: '2024-11-20T20:00:00Z',
    status: 'FAILED',
    createdAt: '2024-11-10T09:00:00Z',
    creator: '0x999...def',
    resolvedAt: '2024-11-21T00:00:00Z',
  },
  {
    id: 'pact-4',
    statement: "I will hold 5 ETH until the Shanghai upgrade Anniversary.",
    type: 'HOLD',
    stake: 5000,
    token: 'USDC',
    deadline: '2025-04-12T12:00:00Z',
    status: 'ACTIVE',
    createdAt: '2024-12-15T16:20:00Z',
    creator: '0x888...xyz',
  },
];

export const INTENT_EXAMPLES = [
  "I will not sell before March 30",
  "I will ship this feature in 7 days",
  "I will stake 1000 MOVE for 1 year",
  "I will attend MoveCon 2025"
];
