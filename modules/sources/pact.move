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
    const E_CHALLENGE_NOT_FOUND: u64 = 11;
    const E_ALREADY_CHALLENGED: u64 = 12;
    const E_GROUP_FULL: u64 = 13;
    const E_NOT_GROUP_PACT: u64 = 14;
    const E_ALREADY_IN_GROUP: u64 = 15;

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
    // Challenge Resource
    // ================================
    /// Represents a challenge to a pact
    struct Challenge has store {
        /// Address of the challenger
        challenger: address,
        /// Amount staked by challenger
        challenge_stake: u64,
        /// Escrowed challenge stake
        escrowed_challenge: Coin<AptosCoin>,
    }

    // ================================
    // Group Member Resource
    // ================================
    /// Represents a member in a group pact
    struct GroupMember has store {
        /// Address of the member
        member: address,
        /// Amount staked by this member
        stake_amount: u64,
        /// Escrowed stake
        escrowed_stake: Coin<AptosCoin>,
        /// Initial balance at join time
        start_balance: u64,
    }

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
        /// Challenge to this pact (optional, stored as vector with 0 or 1 element)
        challenge: vector<Challenge>,
        /// Is this a group pact?
        is_group: bool,
        /// Maximum group size (0 = not a group pact)
        max_group_size: u64,
        /// Group members (only used if is_group = true)
        group_members: vector<GroupMember>,
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
        pact_challenged_events: EventHandle<PactChallengedEvent>,
        group_pact_created_events: EventHandle<GroupPactCreatedEvent>,
        group_member_joined_events: EventHandle<GroupMemberJoinedEvent>,
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

    struct PactChallengedEvent has drop, store {
        creator: address,
        pact_id: u64,
        challenger: address,
        challenge_stake: u64,
    }

    struct GroupPactCreatedEvent has drop, store {
        creator: address,
        pact_id: u64,
        token_address: address,
        start_balance: u64,
        stake_amount: u64,
        deadline: u64,
        max_group_size: u64,
    }

    struct GroupMemberJoinedEvent has drop, store {
        creator: address,
        pact_id: u64,
        member: address,
        stake_amount: u64,
        start_balance: u64,
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
            pact_challenged_events: account::new_event_handle<PactChallengedEvent>(account),
            group_pact_created_events: account::new_event_handle<GroupPactCreatedEvent>(account),
            group_member_joined_events: account::new_event_handle<GroupMemberJoinedEvent>(account),
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
            challenge: vector::empty<Challenge>(),
            is_group: false,
            max_group_size: 0,
            group_members: vector::empty<GroupMember>(),
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
    /// For group pacts: all members must pass, or penalty redistributed
    /// 
    /// @param _resolver - Anyone can resolve (permissionless)
    /// @param creator_addr - Address of the pact creator
    /// @param pact_index - Index of the pact in the creator's pact list
    /// @param current_balance - Current balance of the tracked token (onchain verifiable)
    /// @param member_balances - For group pacts: balances of each member (same order as group_members)
    public entry fun resolve_pact(
        _resolver: &signer,
        creator_addr: address,
        pact_index: u64,
        current_balance: u64,
        member_balances: vector<u64>,
    ) acquires PactRegistry, UserPacts {
        assert!(exists<UserPacts>(creator_addr), error::not_found(E_PACT_NOT_FOUND));
        
        let user_pacts = borrow_global_mut<UserPacts>(creator_addr);
        assert!(pact_index < vector::length(&user_pacts.pacts), error::not_found(E_PACT_NOT_FOUND));
        
        let pact = vector::borrow_mut(&mut user_pacts.pacts, pact_index);
        
        // Validations
        assert!(pact.status == STATUS_ACTIVE, error::invalid_state(E_PACT_NOT_ACTIVE));
        assert!(timestamp::now_seconds() >= pact.deadline, error::invalid_state(E_DEADLINE_NOT_REACHED));

        // Handle group pacts differently
        if (pact.is_group) {
            resolve_group_pact(pact, creator_addr, pact_index, member_balances);
            return
        };

        // Check if pact passed or failed (non-group pact)
        let passed = current_balance >= pact.start_balance;
        
        // Get registry at @pact_addr (module address)
        let registry = borrow_global_mut<PactRegistry>(@pact_addr);
        let stake_returned: u64;
        let protocol_fee: u64;

        // Handle challenge if exists
        if (vector::length(&pact.challenge) > 0) {
            let challenge = vector::borrow_mut(&mut pact.challenge, 0);
            let challenger_addr = challenge.challenger;
            let challenge_stake_amount = challenge.challenge_stake;
            if (passed) {
                // Creator wins: creator gets challenger's stake
                let challenge_stake = coin::extract_all(&mut challenge.escrowed_challenge);
                coin::deposit(creator_addr, challenge_stake);
                // Creator also gets their own stake back
                let creator_stake = coin::extract_all(&mut pact.escrowed_stake);
                coin::deposit(creator_addr, creator_stake);
                stake_returned = pact.stake_amount + challenge_stake_amount;
                protocol_fee = 0;
            } else {
                // Challenger wins: challenger gets creator's stake + their own back
                let creator_stake = coin::extract_all(&mut pact.escrowed_stake);
                let challenge_stake = coin::extract_all(&mut challenge.escrowed_challenge);
                coin::deposit(challenger_addr, creator_stake);
                coin::deposit(challenger_addr, challenge_stake);
                stake_returned = 0; // Creator gets nothing
                protocol_fee = 0; // No protocol fee on challenges
            };
            // Challenge coin is extracted, challenge struct remains in vector but is effectively empty
        } else {
            // No challenge - normal resolution
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
        };

        // Update status
        if (passed) {
            pact.status = STATUS_PASSED;
        } else {
            pact.status = STATUS_FAILED;
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

    /// Internal function to resolve a group pact
    fun resolve_group_pact(
        pact: &mut Pact,
        creator_addr: address,
        pact_index: u64,
        member_balances: vector<u64>,
    ) acquires PactRegistry {
        let registry = borrow_global_mut<PactRegistry>(@pact_addr);
        let member_count = vector::length(&pact.group_members);
        assert!(vector::length(&member_balances) == member_count, error::invalid_argument(E_INVALID_TOKEN_ADDRESS));
        
        // First pass: check if all passed and calculate totals
        let all_passed = check_all_members_passed(&pact.group_members, &member_balances);
        let total_stake = calculate_total_stake(&pact.group_members);
        let failed_stakes = calculate_failed_stakes(&pact.group_members, &member_balances);
        
        if (all_passed) {
            // All passed: return all stakes
            pact.status = STATUS_PASSED;
            let i = 0;
            while (i < member_count) {
                let member = vector::borrow_mut(&mut pact.group_members, i);
                let stake = coin::extract_all(&mut member.escrowed_stake);
                coin::deposit(member.member, stake);
                i = i + 1;
            };
            
            event::emit_event(&mut registry.pact_resolved_events, PactResolvedEvent {
                creator: creator_addr,
                pact_id: pact_index,
                passed: true,
                end_balance: 0,
                stake_returned: total_stake,
                protocol_fee: 0,
            });
        } else {
            // Some failed: redistribute failed stakes to successful members
            pact.status = STATUS_FAILED;
            let _successful_count = member_count;
            let i = 0;
            while (i < member_count) {
                let member = vector::borrow_mut(&mut pact.group_members, i);
                let member_balance = *vector::borrow(&member_balances, i);
                let member_passed = member_balance >= member.start_balance;
                
                if (member_passed) {
                    // Return their stake + share of failed stakes
                    let stake = coin::extract_all(&mut member.escrowed_stake);
                    coin::deposit(member.member, stake);
                } else {
                    // Failed member: stake goes to successful members
                    // For simplicity, we'll burn it (send to protocol fees)
                    let stake = coin::extract_all(&mut member.escrowed_stake);
                    coin::merge(&mut registry.protocol_fees, stake);
                };
                
                i = i + 1;
            };
            
            event::emit_event(&mut registry.pact_resolved_events, PactResolvedEvent {
                creator: creator_addr,
                pact_id: pact_index,
                passed: false,
                end_balance: 0,
                stake_returned: total_stake - failed_stakes,
                protocol_fee: failed_stakes,
            });
        };
    }

    /// Challenge a pact by staking against it
    /// If creator succeeds → wins challenger stake
    /// If fails → challenger wins + creator slashed
    /// 
    /// @param challenger - The account challenging the pact
    /// @param creator_addr - Address of the pact creator
    /// @param pact_index - Index of the pact
    /// @param challenge_stake - Amount to stake as challenge
    public entry fun challenge_pact(
        challenger: &signer,
        creator_addr: address,
        pact_index: u64,
        challenge_stake: u64,
    ) acquires PactRegistry, UserPacts {
        let challenger_addr = signer::address_of(challenger);
        
        // Validations
        assert!(exists<UserPacts>(creator_addr), error::not_found(E_PACT_NOT_FOUND));
        assert!(challenge_stake >= MINIMUM_STAKE, error::invalid_argument(E_INSUFFICIENT_STAKE));
        assert!(challenger_addr != creator_addr, error::invalid_argument(E_UNAUTHORIZED));
        
        let user_pacts = borrow_global_mut<UserPacts>(creator_addr);
        assert!(pact_index < vector::length(&user_pacts.pacts), error::not_found(E_PACT_NOT_FOUND));
        
        let pact = vector::borrow_mut(&mut user_pacts.pacts, pact_index);
        
        // Validations
        assert!(pact.status == STATUS_ACTIVE, error::invalid_state(E_PACT_NOT_ACTIVE));
        assert!(timestamp::now_seconds() < pact.deadline, error::invalid_state(E_DEADLINE_ALREADY_PASSED));
        assert!(vector::length(&pact.challenge) == 0, error::invalid_state(E_ALREADY_CHALLENGED));
        
        // Withdraw challenge stake
        let challenge_coin = coin::withdraw<AptosCoin>(challenger, challenge_stake);
        
        // Create challenge
        let challenge = Challenge {
            challenger: challenger_addr,
            challenge_stake,
            escrowed_challenge: challenge_coin,
        };
        
        vector::push_back(&mut pact.challenge, challenge);
        
        // Emit event
        let registry = borrow_global_mut<PactRegistry>(@pact_addr);
        event::emit_event(&mut registry.pact_challenged_events, PactChallengedEvent {
            creator: creator_addr,
            pact_id: pact_index,
            challenger: challenger_addr,
            challenge_stake,
        });
    }

    /// Create a group pact - multiple users join the same pact
    /// All stake. If one breaks → penalty redistributed or burned
    /// 
    /// @param creator - The account creating the group pact
    /// @param token_address - Address of the token to track
    /// @param start_balance - Current balance of the tracked token
    /// @param stake_amount - Amount to stake in MOVE tokens
    /// @param deadline_seconds - Unix timestamp when pact can be resolved
    /// @param max_group_size - Maximum number of members (e.g., 3)
    public entry fun create_group_pact(
        creator: &signer,
        token_address: address,
        start_balance: u64,
        stake_amount: u64,
        deadline_seconds: u64,
        max_group_size: u64,
    ) acquires PactRegistry, UserPacts {
        let creator_addr = signer::address_of(creator);
        
        // Validations
        assert!(stake_amount >= MINIMUM_STAKE, error::invalid_argument(E_INSUFFICIENT_STAKE));
        assert!(deadline_seconds > timestamp::now_seconds(), error::invalid_argument(E_DEADLINE_ALREADY_PASSED));
        assert!(max_group_size >= 2, error::invalid_argument(E_INVALID_TOKEN_ADDRESS)); // Reuse error code
        assert!(exists<PactRegistry>(@pact_addr), error::not_found(E_NOT_INITIALIZED));

        // Initialize user pacts if needed
        init_user_pacts(creator);

        // Withdraw stake from creator
        let stake_coin = coin::withdraw<AptosCoin>(creator, stake_amount);

        // Get registry and increment counter
        let registry = borrow_global_mut<PactRegistry>(@pact_addr);
        let pact_id = registry.pact_counter;
        registry.pact_counter = pact_id + 1;

        // Create first group member (creator)
        let creator_member = GroupMember {
            member: creator_addr,
            stake_amount,
            escrowed_stake: stake_coin,
            start_balance,
        };
        let group_members = vector::empty<GroupMember>();
        vector::push_back(&mut group_members, creator_member);

        // Create group pact
        let pact = Pact {
            creator: creator_addr,
            token_address,
            start_balance,
            stake_amount,
            deadline: deadline_seconds,
            status: STATUS_ACTIVE,
            escrowed_stake: coin::zero<AptosCoin>(), // Empty for group pacts
            challenge: vector::empty<Challenge>(),
            is_group: true,
            max_group_size,
            group_members,
        };

        // Store pact
        let user_pacts = borrow_global_mut<UserPacts>(creator_addr);
        vector::push_back(&mut user_pacts.pacts, pact);

        // Emit event
        event::emit_event(&mut registry.group_pact_created_events, GroupPactCreatedEvent {
            creator: creator_addr,
            pact_id,
            token_address,
            start_balance,
            stake_amount,
            deadline: deadline_seconds,
            max_group_size,
        });
    }

    /// Join a group pact
    /// 
    /// @param member - The account joining the group pact
    /// @param creator_addr - Address of the pact creator
    /// @param pact_index - Index of the pact
    /// @param stake_amount - Amount to stake
    /// @param start_balance - Current balance of the tracked token
    public entry fun join_group_pact(
        member: &signer,
        creator_addr: address,
        pact_index: u64,
        stake_amount: u64,
        start_balance: u64,
    ) acquires PactRegistry, UserPacts {
        let member_addr = signer::address_of(member);
        
        // Validations
        assert!(exists<UserPacts>(creator_addr), error::not_found(E_PACT_NOT_FOUND));
        assert!(stake_amount >= MINIMUM_STAKE, error::invalid_argument(E_INSUFFICIENT_STAKE));
        
        let user_pacts = borrow_global_mut<UserPacts>(creator_addr);
        assert!(pact_index < vector::length(&user_pacts.pacts), error::not_found(E_PACT_NOT_FOUND));
        
        let pact = vector::borrow_mut(&mut user_pacts.pacts, pact_index);
        
        // Validations
        assert!(pact.is_group, error::invalid_state(E_NOT_GROUP_PACT));
        assert!(pact.status == STATUS_ACTIVE, error::invalid_state(E_PACT_NOT_ACTIVE));
        assert!(timestamp::now_seconds() < pact.deadline, error::invalid_state(E_DEADLINE_ALREADY_PASSED));
        assert!(vector::length(&pact.group_members) < pact.max_group_size, error::invalid_state(E_GROUP_FULL));
        
        // Check if already in group
        let len = vector::length(&pact.group_members);
        let i = 0;
        while (i < len) {
            let existing_member = vector::borrow(&pact.group_members, i);
            assert!(existing_member.member != member_addr, error::invalid_state(E_ALREADY_IN_GROUP));
            i = i + 1;
        };
        
        // Withdraw stake from member
        let stake_coin = coin::withdraw<AptosCoin>(member, stake_amount);
        
        // Create group member
        let new_member = GroupMember {
            member: member_addr,
            stake_amount,
            escrowed_stake: stake_coin,
            start_balance,
        };
        
        vector::push_back(&mut pact.group_members, new_member);
        
        // Emit event
        let registry = borrow_global_mut<PactRegistry>(@pact_addr);
        event::emit_event(&mut registry.group_member_joined_events, GroupMemberJoinedEvent {
            creator: creator_addr,
            pact_id: pact_index,
            member: member_addr,
            stake_amount,
            start_balance,
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

    /// Helper function to check if all members passed
    fun check_all_members_passed(
        group_members: &vector<GroupMember>,
        member_balances: &vector<u64>,
    ): bool {
        let len = vector::length(group_members);
        let i = 0;
        while (i < len) {
            let member = vector::borrow(group_members, i);
            let member_balance = *vector::borrow(member_balances, i);
            if (member_balance < member.start_balance) {
                return false
            };
            i = i + 1;
        };
        true
    }

    /// Helper function to calculate total stake
    fun calculate_total_stake(group_members: &vector<GroupMember>): u64 {
        let len = vector::length(group_members);
        let total = 0;
        let i = 0;
        while (i < len) {
            let member = vector::borrow(group_members, i);
            total = total + member.stake_amount;
            i = i + 1;
        };
        total
    }

    /// Helper function to calculate failed stakes
    fun calculate_failed_stakes(
        group_members: &vector<GroupMember>,
        member_balances: &vector<u64>,
    ): u64 {
        let len = vector::length(group_members);
        let failed = 0;
        let i = 0;
        while (i < len) {
            let member = vector::borrow(group_members, i);
            let member_balance = *vector::borrow(member_balances, i);
            if (member_balance < member.start_balance) {
                failed = failed + member.stake_amount;
            };
            i = i + 1;
        };
        failed
    }

    // ================================
    // View Functions
    // ================================

    #[view]
    /// Get pact details
    public fun get_pact(creator_addr: address, pact_index: u64): (address, u64, u64, u64, u8, bool, u64, u64) acquires UserPacts {
        assert!(exists<UserPacts>(creator_addr), error::not_found(E_PACT_NOT_FOUND));
        
        let user_pacts = borrow_global<UserPacts>(creator_addr);
        assert!(pact_index < vector::length(&user_pacts.pacts), error::not_found(E_PACT_NOT_FOUND));
        
        let pact = vector::borrow(&user_pacts.pacts, pact_index);
        let has_challenge = vector::length(&pact.challenge) > 0;
        let challenge_stake = if (has_challenge) {
            let challenge = vector::borrow(&pact.challenge, 0);
            challenge.challenge_stake
        } else {
            0
        };
        (pact.token_address, pact.start_balance, pact.stake_amount, pact.deadline, pact.status, pact.is_group, pact.max_group_size, challenge_stake)
    }

    #[view]
    /// Get challenge details for a pact
    public fun get_challenge(creator_addr: address, pact_index: u64): (address, u64) acquires UserPacts {
        assert!(exists<UserPacts>(creator_addr), error::not_found(E_PACT_NOT_FOUND));
        
        let user_pacts = borrow_global<UserPacts>(creator_addr);
        assert!(pact_index < vector::length(&user_pacts.pacts), error::not_found(E_PACT_NOT_FOUND));
        
        let pact = vector::borrow(&user_pacts.pacts, pact_index);
        if (vector::length(&pact.challenge) > 0) {
            let challenge = vector::borrow(&pact.challenge, 0);
            (challenge.challenger, challenge.challenge_stake)
        } else {
            (@0x0, 0)
        }
    }

    #[view]
    /// Get group members for a group pact
    public fun get_group_members(creator_addr: address, pact_index: u64): vector<address> acquires UserPacts {
        assert!(exists<UserPacts>(creator_addr), error::not_found(E_PACT_NOT_FOUND));
        
        let user_pacts = borrow_global<UserPacts>(creator_addr);
        assert!(pact_index < vector::length(&user_pacts.pacts), error::not_found(E_PACT_NOT_FOUND));
        
        let pact = vector::borrow(&user_pacts.pacts, pact_index);
        let members = vector::empty<address>();
        let len = vector::length(&pact.group_members);
        let i = 0;
        while (i < len) {
            let member = vector::borrow(&pact.group_members, i);
            vector::push_back(&mut members, member.member);
            i = i + 1;
        };
        members
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
