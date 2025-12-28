import {
  AccountAddress,
  AccountAuthenticatorEd25519,
  Ed25519PublicKey,
  Ed25519Signature,
  generateSigningMessageForTransaction,
} from "@aptos-labs/ts-sdk";
import { aptos } from "./wallet";
import { MOVEMENT_CONFIGS, CURRENT_NETWORK } from "./aptos";

// Contract address - update this with your deployed module address
export const CONTRACT_ADDRESS =
  "0x0ded5b8d5d47739ce0022d24bd2d20f32eb97dcdc1dd2db583f4cc5e608c4794";

export interface CreatePactParams {
  tokenAddress: string;
  startBalance: number;
  stakeAmount: number; // in octas (1 MOVE = 100,000,000 octas)
  deadlineSeconds: number;
}

export interface SignRawHashFunction {
  (params: {
    address: string;
    chainType: "aptos";
    hash: `0x${string}`;
  }): Promise<{
    signature: string;
  }>;
}

/**
 * Get the contract function name for creating a pact
 */
export const getCreatePactFunction = (): `${string}::${string}::${string}` => {
  return `${CONTRACT_ADDRESS}::pact::create_pact` as `${string}::${string}::${string}`;
};

/**
 * Get the contract function name for initializing the protocol
 */
export const getInitializeFunction = (): `${string}::${string}::${string}` => {
  return `${CONTRACT_ADDRESS}::pact::initialize` as `${string}::${string}::${string}`;
};

/**
 * Helper to convert hex string
 */
const toHex = (message: Uint8Array): string => {
  return Array.from(message)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

/**
 * Build and submit a pact creation transaction with Privy wallet
 * This follows the pattern from the counter example for Privy
 */
export const submitCreatePactTransactionPrivy = async (
  params: CreatePactParams,
  walletAddress: string,
  publicKeyHex: string,
  signRawHash: SignRawHashFunction
): Promise<string> => {
  try {
    console.log(
      "[Pact Transaction] Starting create_pact transaction (Privy):",
      {
        tokenAddress: params.tokenAddress,
        startBalance: params.startBalance,
        stakeAmount: params.stakeAmount,
        deadlineSeconds: params.deadlineSeconds,
        walletAddress,
        publicKeyLength: publicKeyHex?.length,
      }
    );

    // Build the transaction
    const rawTxn = await aptos.transaction.build.simple({
      sender: walletAddress,
      data: {
        function: getCreatePactFunction(),
        typeArguments: [],
        functionArguments: [
          AccountAddress.fromString(params.tokenAddress),
          params.startBalance,
          params.stakeAmount,
          params.deadlineSeconds,
        ],
      },
    });

    console.log("[Pact Transaction] Transaction built successfully");

    // Generate signing message
    const message = generateSigningMessageForTransaction(rawTxn);
    console.log("[Pact Transaction] Signing message generated");

    // Sign with Privy wallet
    const { signature: rawSignature } = await signRawHash({
      address: walletAddress,
      chainType: "aptos",
      hash: `0x${toHex(message)}`,
    });

    console.log("[Pact Transaction] Transaction signed successfully");

    // Create authenticator
    // Ensure publicKeyHex is properly formatted (remove 0x prefix and any leading bytes)
    let cleanPublicKey = publicKeyHex.startsWith("0x")
      ? publicKeyHex.slice(2)
      : publicKeyHex;

    // If public key is 66 characters (33 bytes), remove the first byte (00 prefix)
    if (cleanPublicKey.length === 66) {
      cleanPublicKey = cleanPublicKey.slice(2);
    }

    const senderAuthenticator = new AccountAuthenticatorEd25519(
      new Ed25519PublicKey(cleanPublicKey),
      new Ed25519Signature(
        rawSignature.startsWith("0x") ? rawSignature.slice(2) : rawSignature
      )
    );

    console.log("[Pact Transaction] Submitting transaction to blockchain");

    // Submit the signed transaction directly to the blockchain
    const committedTransaction = await aptos.transaction.submit.simple({
      transaction: rawTxn,
      senderAuthenticator,
    });

    console.log(
      "[Pact Transaction] Transaction submitted:",
      committedTransaction.hash
    );

    // Wait for confirmation
    const executed = await aptos.waitForTransaction({
      transactionHash: committedTransaction.hash,
    });

    if (!executed.success) {
      throw new Error("Transaction failed");
    }

    console.log("[Pact Transaction] Transaction confirmed successfully");

    return committedTransaction.hash;
  } catch (error) {
    console.error("Error submitting create_pact transaction (Privy):", error);
    throw error;
  }
};

/**
 * Initialize the Pact protocol (must be called once by deployer)
 */
export const initializeProtocol = async (
  walletAddress: string,
  signAndSubmitTransaction: any
): Promise<string> => {
  try {
    console.log("[Pact Transaction] Initializing protocol...");
    console.log("[Pact Transaction] Wallet address:", walletAddress);
    console.log("[Pact Transaction] Contract address:", CONTRACT_ADDRESS);

    const response = await signAndSubmitTransaction({
      sender: walletAddress,
      data: {
        function: getInitializeFunction(),
        typeArguments: [],
        functionArguments: [],
      },
    });

    console.log(
      "[Pact Transaction] Initialize transaction submitted:",
      response.hash
    );

    // Wait for transaction confirmation
    const executed = await aptos.waitForTransaction({
      transactionHash: response.hash,
    });

    if (!executed.success) {
      const errorDetails = executed as any;
      throw new Error(
        `Transaction failed: ${errorDetails.vm_status || "Unknown error"}`
      );
    }

    console.log("[Pact Transaction] Protocol initialized successfully");

    return response.hash;
  } catch (error: any) {
    console.error("Error initializing protocol:", error);
    // Re-throw with more context
    const errorMsg = error?.message || error?.toString() || "Unknown error";
    throw new Error(`Failed to initialize protocol: ${errorMsg}`);
  }
};

/**
 * Check if the protocol is initialized
 * Note: get_protocol_fees() returns 0 if not initialized, so we use get_total_pacts()
 * which also returns 0, but we can try to access the registry resource
 */
export const isProtocolInitialized = async (): Promise<boolean> => {
  try {
    // Try to get total pacts - this will work if initialized
    // If not initialized, it returns 0, but the function should still execute
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::pact::get_total_pacts`,
        typeArguments: [],
        functionArguments: [],
      },
    });
    // If we get a result (even 0), the protocol is initialized
    console.log(
      "[Pact Transaction] Protocol is initialized, total pacts:",
      result
    );
    return true;
  } catch (error: any) {
    // If we get an error accessing the registry, it's not initialized
    const errorMessage = error?.message || error?.toString() || "";
    console.log("[Pact Transaction] Protocol check error:", errorMessage);

    // Check for initialization errors
    if (
      errorMessage.includes("E_NOT_INITIALIZED") ||
      errorMessage.includes("0x60001") ||
      errorMessage.includes("60001") ||
      (errorMessage.includes("Move abort") && errorMessage.includes("60001")) ||
      errorMessage.includes("Resource does not exist")
    ) {
      console.log("[Pact Transaction] Protocol is NOT initialized");
      return false;
    }
    // If we get here, there might be a different error, but assume not initialized for safety
    console.log("[Pact Transaction] Unknown error, assuming not initialized");
    return false;
  }
};

/**
 * Build and submit a pact creation transaction with native wallet adapter
 * This follows the pattern from the counter example
 */
export const submitCreatePactTransaction = async (
  params: CreatePactParams,
  walletAddress: string,
  signAndSubmitTransaction: any
): Promise<string> => {
  try {
    console.log("[Pact Transaction] Starting create_pact transaction:", {
      tokenAddress: params.tokenAddress,
      startBalance: params.startBalance,
      stakeAmount: params.stakeAmount,
      deadlineSeconds: params.deadlineSeconds,
      walletAddress,
    });

    // Build the transaction
    const response = await signAndSubmitTransaction({
      sender: walletAddress,
      data: {
        function: getCreatePactFunction(),
        typeArguments: [],
        functionArguments: [
          AccountAddress.fromString(params.tokenAddress),
          params.startBalance,
          params.stakeAmount,
          params.deadlineSeconds,
        ],
      },
    });

    console.log("[Pact Transaction] Transaction submitted:", response.hash);

    // Wait for transaction confirmation
    const executed = await aptos.waitForTransaction({
      transactionHash: response.hash,
    });

    if (!executed.success) {
      throw new Error("Transaction failed");
    }

    console.log("[Pact Transaction] Transaction confirmed successfully");

    return response.hash;
  } catch (error) {
    console.error("Error submitting create_pact transaction:", error);
    throw error;
  }
};

/**
 * Fetch a single pact by creator address and index
 */
export const fetchPact = async (
  creatorAddress: string,
  pactIndex: number
): Promise<any | null> => {
  try {
    const result = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::pact::get_pact`,
        typeArguments: [],
        functionArguments: [creatorAddress, pactIndex],
      },
    });

    const [tokenAddress, startBalance, stakeAmount, deadline, status] = result;

    return {
      tokenAddress: tokenAddress?.toString() || "",
      startBalance: Number(startBalance),
      stakeAmount: Number(stakeAmount),
      deadline: Number(deadline),
      status: Number(status), // 0=ACTIVE, 1=PASSED, 2=FAILED
      creator: creatorAddress,
      index: pactIndex,
    };
  } catch (error) {
    console.error("Error fetching pact:", error);
    return null;
  }
};

/**
 * Fetch all pacts for a user
 */
export const fetchUserPacts = async (userAddress: string): Promise<any[]> => {
  try {
    // Get pact count
    const countResponse = await aptos.view({
      payload: {
        function: `${CONTRACT_ADDRESS}::pact::get_user_pact_count`,
        typeArguments: [],
        functionArguments: [userAddress],
      },
    });

    const count = Number(countResponse[0]);
    if (count === 0) return [];

    const pacts = [];

    // Fetch each pact
    for (let i = 0; i < count; i++) {
      try {
        const pact = await fetchPact(userAddress, i);
        if (pact) {
          pacts.push(pact);
        }
      } catch (error) {
        console.error(`Failed to fetch pact ${i}:`, error);
      }
    }

    return pacts;
  } catch (error) {
    console.error("Error fetching user pacts:", error);
    return [];
  }
};

/**
 * Get the resolve_pact function name
 */
export const getResolvePactFunction = (): `${string}::${string}::${string}` => {
  return `${CONTRACT_ADDRESS}::pact::resolve_pact` as `${string}::${string}::${string}`;
};

/**
 * Resolve a pact after the deadline
 * @param creatorAddress - Address of the pact creator
 * @param pactIndex - Index of the pact
 * @param currentBalance - Current balance of the tracked token
 * @param walletAddress - Address of the resolver (anyone can resolve)
 * @param signAndSubmitTransaction - Function to sign and submit transaction
 */
export const submitResolvePactTransaction = async (
  creatorAddress: string,
  pactIndex: number,
  currentBalance: number,
  walletAddress: string,
  signAndSubmitTransaction: any
): Promise<string> => {
  try {
    console.log("[Pact Transaction] Starting resolve_pact transaction:", {
      creatorAddress,
      pactIndex,
      currentBalance,
      walletAddress,
    });

    const response = await signAndSubmitTransaction({
      sender: walletAddress,
      data: {
        function: getResolvePactFunction(),
        typeArguments: [],
        functionArguments: [creatorAddress, pactIndex, currentBalance],
      },
    });

    console.log(
      "[Pact Transaction] Resolve transaction submitted:",
      response.hash
    );

    const executed = await aptos.waitForTransaction({
      transactionHash: response.hash,
    });

    if (!executed.success) {
      throw new Error("Transaction failed");
    }

    console.log("[Pact Transaction] Pact resolved successfully");

    return response.hash;
  } catch (error) {
    console.error("Error resolving pact:", error);
    throw error;
  }
};

/**
 * Get current balance of AptosCoin (MOVE) for an address
 * For MVP, we're tracking MOVE balance
 */
export const getCurrentBalance = async (address: string): Promise<number> => {
  try {
    const account = await aptos.getAccountAPTAmount({
      accountAddress: address,
    });
    // account is in octas (8 decimals), convert to number
    return Number(account);
  } catch (error) {
    console.error("Error fetching balance:", error);
    throw error;
  }
};

/**
 * Fetch all pacts from all users by querying events
 * Note: This uses the REST API directly since the SDK doesn't have a direct method
 */
export const fetchAllPacts = async (): Promise<any[]> => {
  try {
    console.log("[Pact Transaction] Fetching all pacts from events...");

    // Get the fullnode URL from config
    const fullnodeUrl = MOVEMENT_CONFIGS[CURRENT_NETWORK].fullnode;

    // Query events using REST API directly
    // Format: /accounts/{address}/events/{event_handle_struct}/{field_name}
    const eventHandleStruct = `${CONTRACT_ADDRESS}::pact::PactRegistry`;
    const fieldName = "pact_created_events";

    // Try multiple event URL formats in case one doesn't work
    const eventUrl1 = `${fullnodeUrl}/accounts/${CONTRACT_ADDRESS}/events/${encodeURIComponent(
      eventHandleStruct
    )}/${encodeURIComponent(fieldName)}?limit=1000`;
    const eventUrl2 = `${fullnodeUrl}/accounts/${CONTRACT_ADDRESS}/events/${encodeURIComponent(
      `${eventHandleStruct}::${fieldName}`
    )}?limit=1000`;

    console.log("[Pact Transaction] Trying event URL format 1:", eventUrl1);
    console.log("[Pact Transaction] Trying event URL format 2:", eventUrl2);

    // Try first format
    let response = await fetch(eventUrl1);

    if (!response.ok) {
      console.warn(
        "[Pact Transaction] Event URL format 1 failed, trying format 2..."
      );
      // Try second format
      response = await fetch(eventUrl2);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("[Pact Transaction] Both event query formats failed:", {
          format1: { status: response.status, statusText: response.statusText },
          format2: { status: response.status, statusText: response.statusText },
          error: errorText,
        });
        throw new Error(
          `Failed to fetch events: ${response.status} ${response.statusText}. Event query may not be supported on this network.`
        );
      }
    }

    const events = await response.json();
    console.log(
      `[Pact Transaction] Found ${events.length} pact creation events`,
      events.length > 0 ? events[0] : "No events"
    );

    // Extract unique creator addresses
    const creatorSet = new Set<string>();

    events.forEach((event: any) => {
      // Event data structure: { data: { creator, pact_id, ... }, ... }
      const data = event.data || event;
      if (data && data.creator) {
        const creator = String(data.creator);
        creatorSet.add(creator);
        console.log(`[Pact Transaction] Found creator: ${creator}`);
      }
    });

    console.log(`[Pact Transaction] Found ${creatorSet.size} unique creators`);

    if (creatorSet.size === 0) {
      console.warn(
        "[Pact Transaction] No creators found in events, returning empty array"
      );
      return [];
    }

    // Fetch all pacts from all creators
    const allPacts: any[] = [];

    for (const creator of creatorSet) {
      try {
        console.log(
          `[Pact Transaction] Fetching pacts for creator: ${creator}`
        );
        const countResponse = await aptos.view({
          payload: {
            function: `${CONTRACT_ADDRESS}::pact::get_user_pact_count`,
            typeArguments: [],
            functionArguments: [creator],
          },
        });

        const count = Number(countResponse[0]);
        console.log(`[Pact Transaction] Creator ${creator} has ${count} pacts`);

        // Fetch each pact for this creator
        for (let i = 0; i < count; i++) {
          try {
            const pact = await fetchPact(creator, i);
            if (pact) {
              allPacts.push(pact);
            }
          } catch (error) {
            console.error(
              `Failed to fetch pact ${i} for creator ${creator}:`,
              error
            );
          }
        }
      } catch (error) {
        console.error(
          `Failed to get pact count for creator ${creator}:`,
          error
        );
      }
    }

    console.log(`[Pact Transaction] Fetched ${allPacts.length} total pacts`);
    return allPacts;
  } catch (error: any) {
    console.error("Error fetching all pacts:", error);
    console.error("Error details:", {
      message: error?.message,
      stack: error?.stack,
    });
    // Fallback: return empty array
    return [];
  }
};

/**
 * Calculate user statistics from their pacts
 */
export const getUserStats = async (
  userAddress: string
): Promise<{
  totalPacts: number;
  activePacts: number;
  passedPacts: number;
  failedPacts: number;
  successRate: number;
  totalStaked: number;
  totalVolume: number;
  reputationScore: number;
}> => {
  try {
    const userPacts = await fetchUserPacts(userAddress);

    const totalPacts = userPacts.length;
    const activePacts = userPacts.filter((p) => p.status === 0).length;
    const passedPacts = userPacts.filter((p) => p.status === 1).length;
    const failedPacts = userPacts.filter((p) => p.status === 2).length;

    // Calculate success rate (only from resolved pacts)
    const resolvedPacts = passedPacts + failedPacts;
    const successRate =
      resolvedPacts > 0 ? (passedPacts / resolvedPacts) * 100 : 0;

    // Calculate total staked (sum of all stake amounts)
    const totalStaked = userPacts.reduce(
      (sum, pact) => sum + pact.stakeAmount,
      0
    );

    // Calculate total volume (same as total staked for now)
    const totalVolume = totalStaked;

    // Calculate reputation score (0-100)
    // Formula: (success_rate * 0.7) + (total_pacts_normalized * 0.3)
    // This rewards both consistency and activity
    const maxPactsForNormalization = 100; // Normalize to 0-1 scale
    const pactsScore = Math.min(totalPacts / maxPactsForNormalization, 1) * 100;
    const reputationScore = successRate * 0.7 + pactsScore * 0.3;

    return {
      totalPacts,
      activePacts,
      passedPacts,
      failedPacts,
      successRate: Math.round(successRate * 10) / 10, // Round to 1 decimal
      totalStaked,
      totalVolume,
      reputationScore: Math.round(reputationScore * 10) / 10, // Round to 1 decimal
    };
  } catch (error) {
    console.error("Error calculating user stats:", error);
    return {
      totalPacts: 0,
      activePacts: 0,
      passedPacts: 0,
      failedPacts: 0,
      successRate: 0,
      totalStaked: 0,
      totalVolume: 0,
      reputationScore: 0,
    };
  }
};

/**
 * Get protocol statistics
 * Note: Total volume calculation requires fetching all pacts, which may fail if event query doesn't work
 */
export const getProtocolStats = async (): Promise<{
  totalPacts: number;
  protocolFees: number;
  totalVolume: number;
}> => {
  try {
    const [totalPactsResponse, feesResponse] = await Promise.all([
      aptos.view({
        payload: {
          function: `${CONTRACT_ADDRESS}::pact::get_total_pacts`,
          typeArguments: [],
          functionArguments: [],
        },
      }),
      aptos.view({
        payload: {
          function: `${CONTRACT_ADDRESS}::pact::get_protocol_fees`,
          typeArguments: [],
          functionArguments: [],
        },
      }),
    ]);

    // Try to fetch all pacts for volume calculation
    // If this fails, we'll return 0 for volume (event query might not work)
    let totalVolume = 0;
    try {
      const allPacts = await fetchAllPacts();
      totalVolume = allPacts.reduce((sum, pact) => sum + pact.stakeAmount, 0);
      console.log(
        `[Protocol Stats] Calculated total volume: ${totalVolume} from ${allPacts.length} pacts`
      );
    } catch (error) {
      console.warn(
        "[Protocol Stats] Could not calculate total volume (event query may have failed):",
        error
      );
      // Volume will remain 0
    }

    return {
      totalPacts: Number(totalPactsResponse[0]),
      protocolFees: Number(feesResponse[0]),
      totalVolume,
    };
  } catch (error) {
    console.error("Error fetching protocol stats:", error);
    return {
      totalPacts: 0,
      protocolFees: 0,
      totalVolume: 0,
    };
  }
};
