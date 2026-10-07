/**
 * Address-taking reads. Server-only, because address encoding needs the filesystem to locate
 * the SDK's internal CalldataAddress class.
 */
import { asAddress } from "./address.server";
import { CONTRACT_ADDRESS } from "./config";
import type { Reputation } from "./docket";
import { getClient } from "./genlayer";

/** get_reputation(addr: Address) -> ReputationRecord */
export async function getReputation(addr: string): Promise<Reputation> {
  const raw = (await getClient().readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_reputation",
    args: [await asAddress(addr)],
  })) as Record<string, unknown>;
  const sum = raw.score_sum as string | number | bigint | boolean | undefined;
  return {
    completed: Number(raw.completed ?? 0),
    disputed: Number(raw.disputed ?? 0),
    upheld: Number(raw.upheld ?? 0),
    score_sum: BigInt(sum ?? 0),
  };
}

/** Average compliance score across resolved dockets, or null if none are resolved. */
export function averageScore(rep: Reputation): number | null {
  const resolved = rep.completed - 0;
  if (resolved === 0 || rep.score_sum === 0n) return resolved === 0 ? null : 0;
  return Number(rep.score_sum) / resolved;
}