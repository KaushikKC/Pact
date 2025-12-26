/// Unit tests for the Pact module
/// Tests cover: pass case, fail case, double-resolve prevention
#[test_only]
module pact_addr::pact_tests {
    use std::signer;
    use aptos_framework::coin::{Self};
    use aptos_framework::aptos_coin::{Self, AptosCoin};
    use aptos_framework::timestamp;
    use aptos_framework::account;
    use pact_addr::pact;

    // Test helper to setup the testing environment
    fun setup_test(
        aptos_framework: &signer,
        pact_account: &signer,
        user: &signer,
    ) {
        // Initialize timestamp for testing
        timestamp::set_time_has_started_for_testing(aptos_framework);
        
        // Initialize AptosCoin
        let (burn_cap, mint_cap) = aptos_coin::initialize_for_test(aptos_framework);
        
        // Register user for AptosCoin
        let user_addr = signer::address_of(user);
        account::create_account_for_test(user_addr);
        coin::register<AptosCoin>(user);
        
        // Mint some coins to user for staking
        let coins = coin::mint<AptosCoin>(100_000_000, &mint_cap); // 1 MOVE
        coin::deposit(user_addr, coins);
        
        // Initialize pact protocol
        let pact_addr = signer::address_of(pact_account);
        account::create_account_for_test(pact_addr);
        pact::init_for_test(pact_account);
        
        // Cleanup capabilities
        coin::destroy_burn_cap(burn_cap);
        coin::destroy_mint_cap(mint_cap);
    }

    // ================================
    // Test 1: Pass Case - User maintains token balance
    // ================================
    #[test(aptos_framework = @0x1, pact_account = @pact_addr, user = @0x123)]
    public fun test_pact_pass(
        aptos_framework: &signer,
        pact_account: &signer,
        user: &signer,
    ) {
        setup_test(aptos_framework, pact_account, user);
        
        let user_addr = signer::address_of(user);
        let token_addr = @0xABC; // Mock token address
        let start_balance = 1000;
        let stake_amount = 10_000_000; // 0.1 MOVE
        let deadline = timestamp::now_seconds() + 3600; // 1 hour from now
        
        // Create pact
        pact::create_pact(user, token_addr, start_balance, stake_amount, deadline);
        
        // Verify pact was created
        assert!(pact::get_user_pact_count(user_addr) == 1, 1);
        let (token, start_bal, stake, dl, status) = pact::get_pact(user_addr, 0);
        assert!(token == token_addr, 2);
        assert!(start_bal == start_balance, 3);
        assert!(stake == stake_amount, 4);
        assert!(dl == deadline, 5);
        assert!(status == 0, 6); // STATUS_ACTIVE
        
        // Fast forward past deadline
        timestamp::fast_forward_seconds(3601);
        
        // User maintained balance (or increased it)
        let end_balance = 1500; // Balance increased
        
        // Resolve pact
        pact::resolve_pact(user, user_addr, 0, end_balance);
        
        // Verify pact passed
        let status = pact::get_pact_status(user_addr, 0);
        assert!(status == 1, 7); // STATUS_PASSED
        
        // Verify full stake was returned
        let final_balance = coin::balance<AptosCoin>(user_addr);
        assert!(final_balance == 100_000_000, 8); // Got full stake back
        
        // Verify no protocol fees collected
        assert!(pact::get_protocol_fees() == 0, 9);
    }

    // ================================
    // Test 2: Fail Case - User sold tokens (balance decreased)
    // ================================
    #[test(aptos_framework = @0x1, pact_account = @pact_addr, user = @0x123)]
    public fun test_pact_fail(
        aptos_framework: &signer,
        pact_account: &signer,
        user: &signer,
    ) {
        setup_test(aptos_framework, pact_account, user);
        
        let user_addr = signer::address_of(user);
        let token_addr = @0xABC;
        let start_balance = 1000;
        let stake_amount = 10_000_000; // 0.1 MOVE
        let deadline = timestamp::now_seconds() + 3600;
        
        // Create pact
        pact::create_pact(user, token_addr, start_balance, stake_amount, deadline);
        
        // Fast forward past deadline
        timestamp::fast_forward_seconds(3601);
        
        // User sold tokens (balance decreased)
        let end_balance = 500; // Balance decreased!
        
        // Resolve pact
        pact::resolve_pact(user, user_addr, 0, end_balance);
        
        // Verify pact failed
        let status = pact::get_pact_status(user_addr, 0);
        assert!(status == 2, 1); // STATUS_FAILED
        
        // Verify slashed stake: 90% returned, 10% protocol fee
        let expected_return = (stake_amount * 90) / 100; // 9,000,000
        let expected_protocol_fee = stake_amount - expected_return; // 1,000,000
        
        let final_balance = coin::balance<AptosCoin>(user_addr);
        let initial = 100_000_000;
        let after_stake = initial - stake_amount; // 90,000,000
        let after_return = after_stake + expected_return; // 99,000,000
        assert!(final_balance == after_return, 2);
        
        // Verify protocol fee collected
        assert!(pact::get_protocol_fees() == expected_protocol_fee, 3);
    }

    // ================================
    // Test 3: Double-Resolve Prevention
    // ================================
    #[test(aptos_framework = @0x1, pact_account = @pact_addr, user = @0x123)]
    #[expected_failure(abort_code = 0x30004, location = pact_addr::pact)] // E_PACT_NOT_ACTIVE (invalid_state)
    public fun test_double_resolve_fails(
        aptos_framework: &signer,
        pact_account: &signer,
        user: &signer,
    ) {
        setup_test(aptos_framework, pact_account, user);
        
        let user_addr = signer::address_of(user);
        let token_addr = @0xABC;
        let start_balance = 1000;
        let stake_amount = 10_000_000;
        let deadline = timestamp::now_seconds() + 3600;
        
        // Create pact
        pact::create_pact(user, token_addr, start_balance, stake_amount, deadline);
        
        // Fast forward past deadline
        timestamp::fast_forward_seconds(3601);
        
        // First resolve - should succeed
        pact::resolve_pact(user, user_addr, 0, 1000);
        
        // Second resolve - should fail with E_PACT_NOT_ACTIVE
        pact::resolve_pact(user, user_addr, 0, 1000);
    }

    // ================================
    // Test 4: Cannot resolve before deadline
    // ================================
    #[test(aptos_framework = @0x1, pact_account = @pact_addr, user = @0x123)]
    #[expected_failure(abort_code = 0x30005, location = pact_addr::pact)] // E_DEADLINE_NOT_REACHED (invalid_state)
    public fun test_resolve_before_deadline_fails(
        aptos_framework: &signer,
        pact_account: &signer,
        user: &signer,
    ) {
        setup_test(aptos_framework, pact_account, user);
        
        let user_addr = signer::address_of(user);
        let token_addr = @0xABC;
        let start_balance = 1000;
        let stake_amount = 10_000_000;
        let deadline = timestamp::now_seconds() + 3600;
        
        // Create pact
        pact::create_pact(user, token_addr, start_balance, stake_amount, deadline);
        
        // Try to resolve before deadline - should fail
        pact::resolve_pact(user, user_addr, 0, 1000);
    }

    // ================================
    // Test 5: Insufficient stake fails
    // ================================
    #[test(aptos_framework = @0x1, pact_account = @pact_addr, user = @0x123)]
    #[expected_failure(abort_code = 0x10007, location = pact_addr::pact)] // E_INSUFFICIENT_STAKE (invalid_argument)
    public fun test_insufficient_stake_fails(
        aptos_framework: &signer,
        pact_account: &signer,
        user: &signer,
    ) {
        setup_test(aptos_framework, pact_account, user);
        
        let token_addr = @0xABC;
        let start_balance = 1000;
        let stake_amount = 500; // Less than MINIMUM_STAKE (1_000_000)
        let deadline = timestamp::now_seconds() + 3600;
        
        // Create pact with insufficient stake - should fail
        pact::create_pact(user, token_addr, start_balance, stake_amount, deadline);
    }

    // ================================
    // Test 6: Deadline in past fails
    // ================================
    #[test(aptos_framework = @0x1, pact_account = @pact_addr, user = @0x123)]
    #[expected_failure(abort_code = 0x10006, location = pact_addr::pact)] // E_DEADLINE_ALREADY_PASSED (invalid_argument)
    public fun test_past_deadline_fails(
        aptos_framework: &signer,
        pact_account: &signer,
        user: &signer,
    ) {
        setup_test(aptos_framework, pact_account, user);
        
        let token_addr = @0xABC;
        let start_balance = 1000;
        let stake_amount = 10_000_000;
        // Set a base time, then use a past deadline
        let current_time = timestamp::now_seconds();
        let deadline = if (current_time > 0) { current_time - 1 } else { 0 }; // Past deadline
        
        // Create pact with past deadline - should fail
        pact::create_pact(user, token_addr, start_balance, stake_amount, deadline);
    }

    // ================================
    // Test 7: Cancel pact (voluntary failure)
    // ================================
    #[test(aptos_framework = @0x1, pact_account = @pact_addr, user = @0x123)]
    public fun test_cancel_pact(
        aptos_framework: &signer,
        pact_account: &signer,
        user: &signer,
    ) {
        setup_test(aptos_framework, pact_account, user);
        
        let user_addr = signer::address_of(user);
        let token_addr = @0xABC;
        let start_balance = 1000;
        let stake_amount = 10_000_000;
        let deadline = timestamp::now_seconds() + 3600;
        
        // Create pact
        pact::create_pact(user, token_addr, start_balance, stake_amount, deadline);
        
        // Cancel pact
        pact::cancel_pact(user, 0);
        
        // Verify pact was marked as failed
        let status = pact::get_pact_status(user_addr, 0);
        assert!(status == 2, 1); // STATUS_FAILED
        
        // Verify slashed stake
        let expected_return = (stake_amount * 90) / 100;
        let expected_protocol_fee = stake_amount - expected_return;
        
        let final_balance = coin::balance<AptosCoin>(user_addr);
        let initial = 100_000_000;
        let after_stake = initial - stake_amount;
        let after_return = after_stake + expected_return;
        assert!(final_balance == after_return, 2);
        
        // Verify protocol fee
        assert!(pact::get_protocol_fees() == expected_protocol_fee, 3);
    }

    // ================================
    // Test 8: Multiple pacts for same user
    // ================================
    #[test(aptos_framework = @0x1, pact_account = @pact_addr, user = @0x123)]
    public fun test_multiple_pacts(
        aptos_framework: &signer,
        pact_account: &signer,
        user: &signer,
    ) {
        setup_test(aptos_framework, pact_account, user);
        
        let user_addr = signer::address_of(user);
        let token_addr_1 = @0xABC;
        let token_addr_2 = @0xDEF;
        let stake_amount = 5_000_000; // 0.05 MOVE each
        let deadline = timestamp::now_seconds() + 3600;
        
        // Create first pact
        pact::create_pact(user, token_addr_1, 1000, stake_amount, deadline);
        
        // Create second pact
        pact::create_pact(user, token_addr_2, 2000, stake_amount, deadline + 3600);
        
        // Verify both pacts exist
        assert!(pact::get_user_pact_count(user_addr) == 2, 1);
        
        let (token1, _, _, _, _) = pact::get_pact(user_addr, 0);
        let (token2, _, _, _, _) = pact::get_pact(user_addr, 1);
        assert!(token1 == token_addr_1, 2);
        assert!(token2 == token_addr_2, 3);
    }

    // ================================
    // Test 9: View functions
    // ================================
    #[test(aptos_framework = @0x1, pact_account = @pact_addr, user = @0x123)]
    public fun test_view_functions(
        aptos_framework: &signer,
        pact_account: &signer,
        user: &signer,
    ) {
        setup_test(aptos_framework, pact_account, user);
        
        let user_addr = signer::address_of(user);
        
        // Initially no pacts
        assert!(pact::get_user_pact_count(user_addr) == 0, 1);
        assert!(pact::get_total_pacts() == 0, 2);
        assert!(pact::get_protocol_fees() == 0, 3);
        
        // Create a pact
        pact::create_pact(user, @0xABC, 1000, 10_000_000, timestamp::now_seconds() + 3600);
        
        // Verify counts
        assert!(pact::get_user_pact_count(user_addr) == 1, 4);
        assert!(pact::get_total_pacts() == 1, 5);
    }
}
