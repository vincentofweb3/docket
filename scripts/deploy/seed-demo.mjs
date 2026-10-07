/**
 * Create demo dockets on the active network so the register shows a real, populated flow.
 *
 *   node scripts/deploy/seed-demo.mjs
 *
 * Amounts are whole GEN rather than wei, so the register reads like real work. Escrow here is
 * deliberately small and recoverable: on Studionet an emitted payout does not credit an EOA
 * (see evidence/integration-studionet-2026-10-07.txt), so seeding real GEN would strand it.
 * This seeds contract state for demonstration, not spendable funds.
 */
import { installRetryingFetch } from "./net.mjs";
installRetryingFetch();

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { accountFromKeystore } from "./docket-lib.mjs";
import { CONTRACT_ADDRESS } from "./genlayer-constants.mjs";

const { createClient, createAccount } = await import("genlayer-js");
const { studionet } = await import("genlayer-js/chains");

const GEN = 10n ** 18n;

const DEMO_DOCKETS = [
  {
    sow: "Ship a Farcaster frame that renders live docket status",
    criteria:
      "- Reads status, deadline and escrow for any docket id\n- Reads only the view methods get_docket / list_open_dockets\n- Deployed at a public https URL\n- Include a short README with the deployment instructions",
    gen: 420,
    days: 6,
  },
  {
    sow: "Write an implementation guide for the HTTP/1.1 specification",
    criteria:
      "- Must cite the published RFC as an https URL\n- Must be guidance, not a copy of the specification\n- Must cover connection management and message framing",
    gen: 1150,
    days: 12,
  },
  {
    sow: "Produce 6 explainer diagrams for Optimistic Democracy onboarding",
    criteria:
      "- SVG only, no raster export\n- Each diagram must have alt text describing the decision flow it shows\n- Must match the palette and spacing of design/design-system.md",
    gen: 300,
    days: 2,
  },
];

const account = createAccount(
  (await accountFromKeystore(process.env.DOCKET_KEYSTORE ?? "docket-deployer")).privateKey,
);
const client = createClient({ chain: studionet, account });
console.log("seeder:", account.address);

const existing = await client.readContract({
  address: CONTRACT_ADDRESS,
  functionName: "list_open_dockets",
});
if ((existing?.length ?? 0) > 0) {
  console.log(`register already has ${existing.length} open docket(s); nothing seeded`);
  process.exit(0);
}

const created = [];
for (const spec of DEMO_DOCKETS) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + spec.days * 86400);
  const hash = await client.writeContract({
    account,
    address: CONTRACT_ADDRESS,
    functionName: "create_docket",
    args: [spec.sow, spec.criteria, 5000, deadline],
    value: BigInt(spec.gen) * GEN,
  });
  console.log(`[create] ${spec.sow.slice(0, 44)}… -> ${hash}`);
  const receipt = await client.waitForTransactionReceipt({ hash, interval: 3000, retries: 150 });
  const leader = receipt?.consensus_data?.leader_receipt?.[0];
  if (leader?.execution_result !== "SUCCESS") {
    console.error("create failed:", leader?.genvm_result?.stderr);
    process.exit(1);
  }
  const votes = receipt?.consensus_data?.votes ?? {};
  const tally = Object.values(votes).reduce((a, v) => ((a[v] = (a[v] ?? 0) + 1), a), {});
  console.log(`[create] finalized, votes ${JSON.stringify(tally)}`);
  created.push({ hash, sow: spec.sow, gen: spec.gen });
  await new Promise((r) => setTimeout(r, 2000));
}

const open = await client.readContract({
  address: CONTRACT_ADDRESS,
  functionName: "list_open_dockets",
});
console.log("open dockets now:", JSON.stringify(open));
writeFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "seeded-demo.json"),
  JSON.stringify({ seeded_at: new Date().toISOString(), created, open }, null, 2) + "\n",
);