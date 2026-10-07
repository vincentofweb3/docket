/**
 * Deploy contracts/docket.py to Studionet and verify the resulting address.
 *
 *   node scripts/deploy/deploy.mjs
 *
 * The genlayer CLI cannot be driven non-interactively (it prompts for the keystore password),
 * so this uses genlayer-js directly. The signer is derived in-process from the encrypted
 * keystore; no private key is written to disk.
 *
 * Env:
 *   DOCKET_KEYSTORE   keystore name under ~/.genlayer/keystores (default docket-deployer)
 *   DOCKET_PASSWORD_FILE  path to the keystore password (default ~/.genlayer/docket-deployer.pass)
 */
import { installRetryingFetch } from "./net.mjs";
installRetryingFetch();

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { accountFromKeystore } from "./docket-lib.mjs";

const { createClient, createAccount } = await import("genlayer-js");
const { studionet } = await import("genlayer-js/chains");

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONTRACT = join(REPO, "contracts", "docket.py");

const account = createAccount(
  (await accountFromKeystore(process.env.DOCKET_KEYSTORE ?? "docket-deployer",
    process.env.DOCKET_PASSWORD_FILE)).privateKey,
);
console.log("deployer:", account.address);

const client = createClient({ chain: studionet, account });

const code = readFileSync(CONTRACT, "utf8");
const schema = await client.getContractSchemaForCode(code);
console.log("code schema methods:", Object.keys(schema.methods).length);

const hash = await client.deployContract({ account, code });
console.log("DEPLOY_TX_HASH:", hash);
writeFileSync(join(REPO, "artifacts", "deploy-hash.txt"), hash + "\n");

const receipt = await client.waitForTransactionReceipt({ hash, interval: 3000, retries: 120 });
const leader = receipt?.consensus_data?.leader_receipt?.[0];
const votes = receipt?.consensus_data?.votes ?? {};
const tally = Object.values(votes).reduce((a, v) => ((a[v] = (a[v] ?? 0) + 1), a), {});

console.log("status:", receipt?.status, "result:", receipt?.result);
console.log("leader execution_result:", leader?.execution_result, "votes:", JSON.stringify(tally));
console.log("contract_address:", receipt?.data?.contract_address ?? receipt?.contract_address);

const addr = receipt?.data?.contract_address ?? receipt?.contract_address;
if (leader?.execution_result !== "SUCCESS") {
  console.error("deploy did not succeed; stderr:\n", leader?.genvm_result?.stderr);
  process.exit(1);
}

const onChain = await client.getContractCode(addr);
console.log("deployed code matches repo source:", onChain === code);
const liveSchema = await client.getContractSchema(addr);
console.log("address schema methods:", Object.keys(liveSchema.methods).length);
console.log("open dockets:", JSON.stringify(await client.readContract({
  address: addr, functionName: "list_open_dockets",
})));