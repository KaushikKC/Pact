import { aptos } from "./wallet";
import { AccountAddress } from "@aptos-labs/ts-sdk";
import { useWallet as useAptosWallet } from "@aptos-labs/wallet-adapter-react";

// TODO: Update this with your deployed module address
const MODULE_ADDRESS =
  "0x0ded5b8d5d47739ce0022d24bd2d20f32eb97dcdc1dd2db583f4cc5e608c4794";

export interface CreatePactParams {
  tokenAddress: string;
  startBalance: number;
  stakeAmount: number; // in octas (1 MOVE = 100,000,000)
  deadlineSeconds: number;
}

export interface PactData {
  id: string;
  index: number;
  tokenAddress: string;
  startBalance: number;
  stakeAmount: number;
  deadline: number;
  status: "ACTIVE" | "PASSED" | "FAILED";
  creator: string;
}

/**
 * Create a new pact onchain
 *
 * @param signAndSubmitTransaction - Function from wallet adapter to sign and submit
 * @param creatorAddress - Address of the pact creator
 * @param params - Pact creation parameters
 */
export async function createPact(
  signAndSubmitTransaction: (transaction: any) => Promise<{ hash: string }>,
  creatorAddress: string,
  params: CreatePactParams
): Promise<string> {
  try {
    const transaction = await aptos.transaction.build.simple({
      sender: creatorAddress,
      data: {
        function: `${MODULE_ADDRESS}::pact::create_pact`,
        typeArguments: [],
        functionArguments: [
          AccountAddress.fromString(params.tokenAddress),
          params.startBalance,
          params.stakeAmount,
          params.deadlineSeconds,
        ],
      },
    });

    const response = await signAndSubmitTransaction(transaction);
    return response.hash;
  } catch (error) {
    console.error("Failed to create pact:", error);
    throw error;
  }
}

/**
 * Get all pacts for a user
 */
export async function getUserPacts(userAddress: string): Promise<PactData[]> {
  try {
    // Get pact count
    const countResponse = await aptos.view({
      payload: {
        function: `${MODULE_ADDRESS}::pact::get_user_pact_count`,
        typeArguments: [],
        functionArguments: [userAddress],
      },
    });

    const count = Number(countResponse[0]);
    if (count === 0) return [];

    const pacts: PactData[] = [];

    // Fetch each pact
    for (let i = 0; i < count; i++) {
      try {
        const pactResponse = await aptos.view({
          payload: {
            function: `${MODULE_ADDRESS}::pact::get_pact`,
            typeArguments: [],
            functionArguments: [userAddress, i],
          },
        });

        const [tokenAddress, startBalance, stakeAmount, deadline, status] =
          pactResponse;

        pacts.push({
          id: `${userAddress}-${i}`,
          index: i,
          tokenAddress: tokenAddress?.toString() || "",
          startBalance: Number(startBalance),
          stakeAmount: Number(stakeAmount),
          deadline: Number(deadline),
          status: getStatusFromCode(Number(status)),
          creator: userAddress,
        });
      } catch (error) {
        console.error(`Failed to fetch pact ${i}:`, error);
      }
    }

    return pacts;
  } catch (error) {
    console.error("Failed to fetch user pacts:", error);
    return [];
  }
}

/**
 * Resolve a pact after deadline
 *
 * @param signAndSubmitTransaction - Function from wallet adapter to sign and submit
 * @param resolverAddress - Address resolving the pact
 * @param creatorAddress - Address of the pact creator
 * @param pactIndex - Index of the pact
 * @param currentBalance - Current token balance
 */
export async function resolvePact(
  signAndSubmitTransaction: (transaction: any) => Promise<{ hash: string }>,
  resolverAddress: string,
  creatorAddress: string,
  pactIndex: number,
  currentBalance: number
): Promise<string> {
  try {
    const transaction = await aptos.transaction.build.simple({
      sender: resolverAddress,
      data: {
        function: `${MODULE_ADDRESS}::pact::resolve_pact`,
        typeArguments: [],
        functionArguments: [creatorAddress, pactIndex, currentBalance],
      },
    });

    const response = await signAndSubmitTransaction(transaction);
    return response.hash;
  } catch (error) {
    console.error("Failed to resolve pact:", error);
    throw error;
  }
}

/**
 * Get protocol fees collected
 */
export async function getProtocolFees(): Promise<number> {
  try {
    const response = await aptos.view({
      payload: {
        function: `${MODULE_ADDRESS}::pact::get_protocol_fees`,
        typeArguments: [],
        functionArguments: [],
      },
    });

    return Number(response[0]);
  } catch (error) {
    console.error("Failed to get protocol fees:", error);
    return 0;
  }
}

/**
 * Get total number of pacts created
 */
export async function getTotalPacts(): Promise<number> {
  try {
    const response = await aptos.view({
      payload: {
        function: `${MODULE_ADDRESS}::pact::get_total_pacts`,
        typeArguments: [],
        functionArguments: [],
      },
    });

    return Number(response[0]);
  } catch (error) {
    console.error("Failed to get total pacts:", error);
    return 0;
  }
}

/**
 * Convert status code to status string
 */
function getStatusFromCode(code: number): "ACTIVE" | "PASSED" | "FAILED" {
  if (code === 0) return "ACTIVE";
  if (code === 1) return "PASSED";
  if (code === 2) return "FAILED";
  return "ACTIVE";
}
