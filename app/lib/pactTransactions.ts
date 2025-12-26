import {
  AccountAddress,
  AccountAuthenticatorEd25519,
  Ed25519PublicKey,
  Ed25519Signature,
  generateSigningMessageForTransaction,
} from "@aptos-labs/ts-sdk";
import { aptos } from "./wallet";

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
