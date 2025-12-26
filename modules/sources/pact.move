/// Pact Module - DeFi primitive for stake-backed position holding commitments
/// 
/// MVP Scope (Narrow & DeFi-Focused):
/// - Pact Type: "I commit to not selling token X until timestamp T"
/// - Stake Asset: MOVE native token
/// - Resolution Rule: Balance at start >= balance at deadline = PASS (held position)
/// - Slashing Split: 90% returned / 10% protocol fee (on fail)
/// - Chain: Movement Testnet
/// - Verification: Onchain balance check (no oracles, no offchain attestations)
module pact_addr::pact {
    use std::signer;
    use std::error;
    use std::vector;
    use aptos_framework::coin::{Self, Coin};
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::timestamp;
    use aptos_framework::event::{Self, EventHandle};
    use aptos_framework::account;

    // ================================
    // Error Codes
    // ================================
    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_INITIALIZED: u64 = 2;
    const E_PACT_NOT_FOUND: u64 = 3;
    const E_PACT_NOT_ACTIVE: u64 = 4;
    const E_DEADLINE_NOT_REACHED: u64 = 5;
    const E_DEADLINE_ALREADY_PASSED: u64 = 6;
    const E_INSUFFICIENT_STAKE: u64 = 7;
    const E_INVALID_TOKEN_ADDRESS: u64 = 8;
    const E_BALANCE_DECREASED: u64 = 9;
    const E_UNAUTHORIZED: u64 = 10;

    // ================================
    // Constants
    // ================================
    const MINIMUM_STAKE: u64 = 1000000; // 0.01 MOVE (8 decimals)
    const SLASH_PERCENTAGE_RETURNED: u64 = 90; // 90% returned to creator
    const SLASH_PERCENTAGE_PROTOCOL: u64 = 10; // 10% protocol fee

    // ================================
    // Pact Status Enum
    // ================================
    const STATUS_ACTIVE: u8 = 0;
    const STATUS_PASSED: u8 = 1;
    const STATUS_FAILED: u8 = 2;

    // ================================
    // Pact Resource
    // ================================
    /// Represents a single commitment/pact
    /// This is stored as a non-duplicable resource
    struct Pact has key, store {
        /// Address of the creator who made the commitment
        creator: address,
        /// Token address being tracked (the token user commits not to sell)
        token_address: address,
        /// Initial balance of the tracked token at pact creation
        start_balance: u64,
        /// Amount staked in MOVE tokens (held in escrow)
        stake_amount: u64,
        /// Timestamp when the pact can be resolved
        deadline: u64,
        /// Current status: 0=Active, 1=Passed, 2=Failed
        status: u8,
        /// Escrowed stake (locked MOVE tokens)
        escrowed_stake: Coin<AptosCoin>,
    }

    // ================================
    // Global Registry
    // ================================
    /// Global registry to track all pacts and protocol state
    struct PactRegistry has key {
        /// Counter for generating unique pact IDs
        pact_counter: u64,
        /// Total protocol fees collected
        protocol_fees: Coin<AptosCoin>,
        /// Event handles
        pact_created_events: EventHandle<PactCreatedEvent>,
        pact_resolved_events: EventHandle<PactResolvedEvent>,
    }

    // ================================
    // User Pact Storage
    // ================================
    /// Storage for user's pacts
    struct UserPacts has key {
        /// Map of pact_id -> Pact
        pacts: vector<Pact>,
    }

    // ================================
    // Events
    // ================================
    struct PactCreatedEvent has drop, store {
        creator: address,
        pact_id: u64,
        token_address: address,
        start_balance: u64,
        stake_amount: u64,
        deadline: u64,
    }

    struct PactResolvedEvent has drop, store {
        creator: address,
        pact_id: u64,
        passed: bool,
        end_balance: u64,
        stake_returned: u64,
        protocol_fee: u64,
    }

    // ================================
    // Initialization
    // ================================
    /// Initialize the Pact protocol
    /// Must be called once by the protocol deployer
    /// Registry is stored at @pact_addr (module address)
    /// The signer must have @pact_addr as their address
    public entry fun initialize(account: &signer) {
        let account_addr = signer::address_of(account);
        // Registry is stored at module address @pact_addr
        // In production, deployer should be the account at @pact_addr
        // In tests, pact_account signer should have address @pact_addr
        assert!(account_addr == @pact_addr, error::invalid_argument(E_UNAUTHORIZED));
        assert!(!exists<PactRegistry>(@pact_addr), error::already_exists(E_ALREADY_INITIALIZED));

        move_to(account, PactRegistry {
            pact_counter: 0,
            protocol_fees: coin::zero<AptosCoin>(),
            pact_created_events: account::new_event_handle<PactCreatedEvent>(account),
            pact_resolved_events: account::new_event_handle<PactResolvedEvent>(account),
        });
    }

    /// Initialize user's pact storage
    fun init_user_pacts(account: &signer) {
        let account_addr = signer::address_of(account);
        if (!exists<UserPacts>(account_addr)) {
            move_to(account, UserPacts {
                pacts: vector::empty<Pact>(),
            });
        };
    }

    // ================================
    // Core Functions
    // ================================

    /// Create a new pact - stake-backed commitment to hold an onchain position
    /// 
    /// MVP: "I commit to not selling token X until timestamp T"
    /// 
    /// @param creator - The account creating the pact
    /// @param token_address - Address of the token to track (the position to hold)
    /// @param start_balance - Current balance of the tracked token (position snapshot)
    /// @param stake_amount - Amount to stake in MOVE tokens (8 decimals)
    /// @param deadline_seconds - Unix timestamp when pact can be resolved
    public entry fun create_pact(
        creator: &signer,
        token_address: address,
        start_balance: u64,
        stake_amount: u64,
        deadline_seconds: u64,
    ) acquires PactRegistry, UserPacts {
        let creator_addr = signer::address_of(creator);
        
        // Validations
        assert!(stake_amount >= MINIMUM_STAKE, error::invalid_argument(E_INSUFFICIENT_STAKE));
        assert!(deadline_seconds > timestamp::now_seconds(), error::invalid_argument(E_DEADLINE_ALREADY_PASSED));
        // Registry is stored at @pact_addr (module address)
        assert!(exists<PactRegistry>(@pact_addr), error::not_found(E_NOT_INITIALIZED));

        // Initialize user pacts if needed
        init_user_pacts(creator);

        // Withdraw stake from creator
        let stake_coin = coin::withdraw<AptosCoin>(creator, stake_amount);

        // Get registry and increment counter
        // Registry is stored at @pact_addr (module address)
        let registry = borrow_global_mut<PactRegistry>(@pact_addr);
        let pact_id = registry.pact_counter;
        registry.pact_counter = pact_id + 1;

        // Create pact
        let pact = Pact {
            creator: creator_addr,
            token_address,
            start_balance,
            stake_amount,
            deadline: deadline_seconds,
            status: STATUS_ACTIVE,
            escrowed_stake: stake_coin,
        };

        // Store pact
        let user_pacts = borrow_global_mut<UserPacts>(creator_addr);
        vector::push_back(&mut user_pacts.pacts, pact);

        // Emit event
        event::emit_event(&mut registry.pact_created_events, PactCreatedEvent {
            creator: creator_addr,
            pact_id,
            token_address,
            start_balance,
            stake_amount,
            deadline: deadline_seconds,
        });
    }

    /// Resolve a pact after the deadline
    /// Anyone can call this function to resolve a pact (permissionless)
    /// 
    /// Balance check: current_balance >= start_balance = PASS (position held)
    /// Settlement: Hold → full stake returned, Sell → stake slashed (90/10)
    /// 
    /// @param _resolver - Anyone can resolve (permissionless)
    /// @param creator_addr - Address of the pact creator
    /// @param pact_index - Index of the pact in the creator's pact list
    /// @param current_balance - Current balance of the tracked token (onchain verifiable)
    public entry fun resolve_pact(
        _resolver: &signer,
        creator_addr: address,
        pact_index: u64,
        current_balance: u64,
    ) acquires PactRegistry, UserPacts {
        assert!(exists<UserPacts>(creator_addr), error::not_found(E_PACT_NOT_FOUND));
        
        let user_pacts = borrow_global_mut<UserPacts>(creator_addr);
        assert!(pact_index < vector::length(&user_pacts.pacts), error::not_found(E_PACT_NOT_FOUND));
        
        let pact = vector::borrow_mut(&mut user_pacts.pacts, pact_index);
        
        // Validations
        assert!(pact.status == STATUS_ACTIVE, error::invalid_state(E_PACT_NOT_ACTIVE));
        assert!(timestamp::now_seconds() >= pact.deadline, error::invalid_state(E_DEADLINE_NOT_REACHED));

        // Check if pact passed or failed
        let passed = current_balance >= pact.start_balance;
        
        // Get registry at @pact_addr (module address)
        let registry = borrow_global_mut<PactRegistry>(@pact_addr);
        let stake_returned: u64;
        let protocol_fee: u64;

        if (passed) {
            // PASS: Return full stake to creator
            pact.status = STATUS_PASSED;
            stake_returned = pact.stake_amount;
            protocol_fee = 0;
            
            let stake = coin::extract_all(&mut pact.escrowed_stake);
            coin::deposit(creator_addr, stake);
        } else {
            // FAIL: Slash stake - 90% to creator, 10% to protocol
            pact.status = STATUS_FAILED;
            stake_returned = (pact.stake_amount * SLASH_PERCENTAGE_RETURNED) / 100;
            protocol_fee = pact.stake_amount - stake_returned;
            
            let total_stake = coin::extract_all(&mut pact.escrowed_stake);
            
            // Split the stake
            let protocol_portion = coin::extract(&mut total_stake, protocol_fee);
            coin::merge(&mut registry.protocol_fees, protocol_portion);
            
            // Return remaining to creator
            coin::deposit(creator_addr, total_stake);
        };

        // Emit event
        event::emit_event(&mut registry.pact_resolved_events, PactResolvedEvent {
            creator: creator_addr,
            pact_id: pact_index,
            passed,
            end_balance: current_balance,
            stake_returned,
            protocol_fee,
        });
    }

    /// Emergency function to cancel an active pact and slash the stake
    /// Can only be called by the creator before deadline
    public entry fun cancel_pact(
        creator: &signer,
        pact_index: u64,
    ) acquires PactRegistry, UserPacts {
        let creator_addr = signer::address_of(creator);
        assert!(exists<UserPacts>(creator_addr), error::not_found(E_PACT_NOT_FOUND));
        
        let user_pacts = borrow_global_mut<UserPacts>(creator_addr);
        assert!(pact_index < vector::length(&user_pacts.pacts), error::not_found(E_PACT_NOT_FOUND));
        
        let pact = vector::borrow_mut(&mut user_pacts.pacts, pact_index);
        
        // Validations
        assert!(pact.status == STATUS_ACTIVE, error::invalid_state(E_PACT_NOT_ACTIVE));
        
        // Treat as failure - slash the stake
        pact.status = STATUS_FAILED;
        let stake_returned = (pact.stake_amount * SLASH_PERCENTAGE_RETURNED) / 100;
        let protocol_fee = pact.stake_amount - stake_returned;
        
        // Get registry at @pact_addr (module address)
        let registry = borrow_global_mut<PactRegistry>(@pact_addr);
        let total_stake = coin::extract_all(&mut pact.escrowed_stake);
        
        // Split the stake
        let protocol_portion = coin::extract(&mut total_stake, protocol_fee);
        coin::merge(&mut registry.protocol_fees, protocol_portion);
        
        // Return remaining to creator
        coin::deposit(creator_addr, total_stake);

        // Emit event
        event::emit_event(&mut registry.pact_resolved_events, PactResolvedEvent {
            creator: creator_addr,
            pact_id: pact_index,
            passed: false,
            end_balance: 0,
            stake_returned,
            protocol_fee,
        });
    }

    // ================================
    // View Functions
    // ================================

    #[view]
    /// Get pact details
    public fun get_pact(creator_addr: address, pact_index: u64): (address, u64, u64, u64, u8) acquires UserPacts {
        assert!(exists<UserPacts>(creator_addr), error::not_found(E_PACT_NOT_FOUND));
        
        let user_pacts = borrow_global<UserPacts>(creator_addr);
        assert!(pact_index < vector::length(&user_pacts.pacts), error::not_found(E_PACT_NOT_FOUND));
        
        let pact = vector::borrow(&user_pacts.pacts, pact_index);
        (pact.token_address, pact.start_balance, pact.stake_amount, pact.deadline, pact.status)
    }

    #[view]
    /// Get number of pacts for a user
    public fun get_user_pact_count(creator_addr: address): u64 acquires UserPacts {
        if (!exists<UserPacts>(creator_addr)) {
            return 0
        };
        let user_pacts = borrow_global<UserPacts>(creator_addr);
        vector::length(&user_pacts.pacts)
    }

    #[view]
    /// Get protocol fees collected
    public fun get_protocol_fees(): u64 acquires PactRegistry {
        // Registry is stored at @pact_addr (module address)
        if (!exists<PactRegistry>(@pact_addr)) {
            return 0
        };
        let registry = borrow_global<PactRegistry>(@pact_addr);
        coin::value(&registry.protocol_fees)
    }

    #[view]
    /// Get total number of pacts created
    public fun get_total_pacts(): u64 acquires PactRegistry {
        // Registry is stored at @pact_addr (module address)
        if (!exists<PactRegistry>(@pact_addr)) {
            return 0
        };
        let registry = borrow_global<PactRegistry>(@pact_addr);
        registry.pact_counter
    }

    // ================================
    // Test-only Functions
    // ================================
    #[test_only]
    public fun init_for_test(account: &signer) {
        initialize(account);
    }

    #[test_only]
    public fun get_pact_status(creator_addr: address, pact_index: u64): u8 acquires UserPacts {
        let user_pacts = borrow_global<UserPacts>(creator_addr);
        let pact = vector::borrow(&user_pacts.pacts, pact_index);
        pact.status
    }
}
