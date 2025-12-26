# Leaderboard Data Fetching Issue

## Problem
The leaderboard needs to show:
- **Total Volume**: Sum of all stakes from ALL users
- **All Community Pacts**: All pacts created by ALL users
- **Success Rate**: Calculated from all resolved pacts

## Current Approach
We're trying to query `PactCreatedEvent` events to discover all creators, then fetch their pacts.

## Issue
The event query might be failing because:
1. Event API endpoint format might be incorrect
2. Movement network might have different event query format than Aptos
3. Events might not be queryable without proper authentication

## Solutions

### Option 1: Fix Event Query (No Contract Change)
- Verify the correct REST API format for Movement network
- Test event query endpoint directly
- Add better error handling and logging

### Option 2: Add Contract Function (Requires Contract Change)
Add a view function to track all creators:
```move
struct PactRegistry has key {
    // ... existing fields ...
    creators: vector<address>, // Track all creators
}

#[view]
public fun get_all_creators(): vector<address> acquires PactRegistry {
    // Return list of all creators
}
```

### Option 3: Use Indexer/Backend (Future Enhancement)
- Use a blockchain indexer to track events
- Build a backend service that indexes all pact creations
- Frontend queries the backend instead of events directly

## Current Status
- ✅ `get_total_pacts()` - Working (shows 2)
- ❌ Event query - May be failing (needs verification)
- ❌ Total volume calculation - Depends on event query
- ❌ All pacts display - Depends on event query

## Next Steps
1. Check browser console for event query errors
2. Test event API endpoint directly
3. If events don't work, consider Option 2 (contract change)
