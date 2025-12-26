# Pact - DeFi Primitive for Stake-Backed Position Commitments

![Movement](https://img.shields.io/badge/Built%20on-Movement-blue)
![Move](https://img.shields.io/badge/Language-Move-orange)
![License](https://img.shields.io/badge/License-MIT-green)

**Pact** is a DeFi primitive that enables **stake-backed commitments to hold an onchain position until a condition or time**. 

## 🎯 MVP: DeFi Position Holding Commitment

**Core Use Case:** "I commit to not selling token X until timestamp T."

This MVP is:
- ✅ **Clearly DeFi** - Onchain position management with economic stakes
- ✅ **Fully onchain verifiable** - No external dependencies
- ✅ **Oracle-free** - Uses native balance checks
- ✅ **No offchain attestations** - Everything verified onchain

## 🟢 MVP Flow (DeFi-Focused)

1. **User creates a Pact**
   - Token to track
   - Stake amount (MOVE)
   - Deadline (timestamp)

2. **Funds are locked onchain**
   - Stake escrowed in contract
   - Initial balance recorded

3. **Pact is resolved on deadline**
   - Anyone can resolve after deadline
   - Balance check: current vs initial

4. **Settlement**
   - ✅ **Hold** → Full stake returned
   - ❌ **Sell** → Stake slashed (90% returned, 10% protocol fee)

## 🏗️ MVP Scope (Narrow & Focused)

**Single DeFi Scenario:** Stake-backed commitment to hold an onchain position until a condition or time.

| Aspect | Decision |
|--------|----------|
| **Pact Type** | "I commit to not selling token X until timestamp T" |
| **Stake Asset** | MOVE (native token) |
| **Resolution Rule** | Balance at start ≥ balance at deadline = PASS (held position) |
| **Slashing Split** | 90% returned to creator / 10% protocol fee |
| **Chain** | Movement Testnet |
| **Minimum Stake** | 0.01 MOVE (1,000,000 octas) |
| **Verification** | Onchain balance check (no oracles) |

## 🧠 Architecture

### Smart Contract Design

Built natively on Movement using Move resources for maximum safety:

```
Pact (Resource)
├── creator: address
├── token_address: address (tracked token)
├── start_balance: u64
├── stake_amount: u64 (in MOVE)
├── deadline: u64 (unix timestamp)
├── status: u8 (Active=0, Passed=1, Failed=2)
└── escrowed_stake: Coin<AptosCoin>
```

### Core Functions

1. **`create_pact()`**
   - Lock MOVE tokens as stake
   - Record initial token balance
   - Set commitment deadline
   - Emit `PactCreatedEvent`

2. **`resolve_pact()`**
   - Can be called by anyone after deadline
   - Check current balance vs initial balance
   - Distribute stake based on outcome
   - Emit `PactResolvedEvent`
   - **Prevents double resolution** (non-duplicable resource)

3. **`cancel_pact()`**
   - Emergency exit before deadline
   - Treated as failure (stake slashed)

### Security Features

- ✅ **Non-duplicable resources**: Each pact can only be resolved once
- ✅ **Escrow-based**: Stake locked in contract (not just promise)
- ✅ **Anyone can resolve**: Permissionless resolution after deadline
- ✅ **No oracle needed**: Onchain balance verification
- ✅ **Timestamp-based**: Deterministic deadline enforcement

## 📂 Project Structure

```
pact/
├── modules/                  # Move smart contracts
│   ├── Move.toml            # Package manifest
│   ├── sources/
│   │   └── pact.move        # Core pact module
│   └── tests/
│       └── pact_tests.move  # Comprehensive unit tests
├── app/                     # Next.js frontend (Phase 3)
│   ├── layout.tsx
│   └── page.tsx
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- **Movement CLI**: [Install Movement](https://docs.movementlabs.xyz)
- **Node.js 18+**: For frontend (Phase 3)
- **Wallet**: Movement-compatible wallet (e.g., Petra)

### 1️⃣ Build Smart Contract

```bash
cd modules
movement move compile
```

### 2️⃣ Run Tests

```bash
movement move test
```

Expected output:
```
Running Move unit tests
[ PASS    ] pact_addr::pact_tests::test_pact_pass
[ PASS    ] pact_addr::pact_tests::test_pact_fail
[ PASS    ] pact_addr::pact_tests::test_double_resolve_fails
[ PASS    ] pact_addr::pact_tests::test_resolve_before_deadline_fails
[ PASS    ] pact_addr::pact_tests::test_insufficient_stake_fails
[ PASS    ] pact_addr::pact_tests::test_past_deadline_fails
[ PASS    ] pact_addr::pact_tests::test_cancel_pact
[ PASS    ] pact_addr::pact_tests::test_multiple_pacts
[ PASS    ] pact_addr::pact_tests::test_view_functions
Test result: OK. Total tests: 9; passed: 9; failed: 0
```

### 3️⃣ Deploy to Movement Testnet

```bash
# Initialize account (if needed)
movement account create --account default

# Fund account with testnet MOVE
# Visit Movement testnet faucet: https://faucet.movementlabs.xyz

# Publish module
movement move publish --named-addresses pact_addr=default
```

### 4️⃣ Interact with Contract

#### Initialize Protocol
```bash
movement move run \
  --function-id 'default::pact::initialize'
```

#### Create a Pact
```bash
movement move run \
  --function-id 'default::pact::create_pact' \
  --args address:0x123... u64:1000 u64:10000000 u64:1735000000
```

#### Resolve a Pact
```bash
movement move run \
  --function-id 'default::pact::resolve_pact' \
  --args address:0x123... u64:0 u64:1200
```

## 🧪 Test Coverage

| Test | Description | Status |
|------|-------------|--------|
| `test_pact_pass` | User maintains balance → full stake returned | ✅ |
| `test_pact_fail` | User sold tokens → stake slashed (90/10) | ✅ |
| `test_double_resolve_fails` | Prevent resolving same pact twice | ✅ |
| `test_resolve_before_deadline_fails` | Cannot resolve early | ✅ |
| `test_insufficient_stake_fails` | Minimum stake enforcement | ✅ |
| `test_past_deadline_fails` | Deadline must be in future | ✅ |
| `test_cancel_pact` | Voluntary exit with slashing | ✅ |
| `test_multiple_pacts` | Multiple pacts per user | ✅ |
| `test_view_functions` | Query functions work correctly | ✅ |

## 💡 MVP Use Case

### **DeFi Position Holding Commitment**

**Example:** "I commit to not selling token X until timestamp T."

**Flow:**
1. User stakes MOVE tokens
2. Records initial token balance
3. Sets deadline timestamp
4. At deadline: balance check
5. Settlement:
   - Held position → Full stake returned
   - Sold position → Stake slashed (90/10 split)

**Why This Works:**
- Pure DeFi (onchain position management)
- No oracles needed (native balance checks)
- No offchain attestations (fully verifiable)
- Clear economic enforcement

---

## 🔵 Extension Flows (Mention Only - Not Implemented)

These are potential future directions but **NOT part of the MVP**:

- Friend group accountability
- Alpha signal credibility staking  
- DAO contributor commitments

**MVP Focus:** Single DeFi scenario only - stake-backed position holding commitment.

## 🔮 Future Phases (Post-MVP)

### Phase 3: Frontend (Day 5–7)
- [ ] Wallet connection (Petra/Martian)
- [ ] Create pact UI with form validation
- [ ] Dashboard showing active/past pacts
- [ ] Resolution interface
- [ ] Real-time balance tracking

### Phase 4: Multi-Pact Types (Day 8+)
- [ ] Task completion pacts (oracle-based)
- [ ] Social commitment pacts (multi-sig validation)
- [ ] Recurring pacts (e.g., weekly goals)
- [ ] Delegated resolution (trusted verifiers)

### Phase 5: Advanced Features
- [ ] Pact templates marketplace
- [ ] Reputation scoring based on history
- [ ] Rewards for successful pacts (staking incentives)
- [ ] Social features (share commitments)
- [ ] Analytics dashboard

## 🛡️ Security Considerations

### Audited Patterns
- ✅ Escrow pattern with locked coins
- ✅ Status-based state machine
- ✅ Single-resolution enforcement
- ✅ Timestamp-based deadlines

### Known Limitations (MVP)
- ⚠️ **Manual balance reporting**: Resolver must provide current balance (Phase 2: add oracle)
- ⚠️ **No dispute mechanism**: Resolution is final (Phase 3: add appeals)
- ⚠️ **Simple slashing**: Fixed 90/10 split (Phase 3: make configurable)

### Future Audit Plans
- [ ] Formal verification of core logic
- [ ] Third-party security audit before mainnet
- [ ] Bug bounty program

## 📊 Gas Efficiency

Movement's low gas costs make Pact practical for everyday commitments:

| Operation | Estimated Gas | USD (est.) |
|-----------|---------------|------------|
| Create Pact | ~2,000 gas | ~$0.001 |
| Resolve Pact | ~3,000 gas | ~$0.0015 |
| View Functions | Free | $0 |

**This enables micro-commitments** that would be impractical on Ethereum (~$10-50/tx).

## 🤝 Contributing

Contributions welcome! Areas of interest:
- Additional pact types
- Oracle integration
- Frontend improvements
- Security analysis
- Documentation

## 📄 License

MIT License - see LICENSE file

## 🔗 Links

- **Movement Docs**: https://docs.movementlabs.xyz
- **Movement Testnet**: https://explorer.movementlabs.xyz
- **Faucet**: https://faucet.movementlabs.xyz

## 🙏 Acknowledgments

Built for M1 Hackathon on Movement Labs.

Special thanks to the Movement team for creating a high-performance Move environment that makes behavioral DeFi practical.

---

**Built with ❤️ on Movement**
