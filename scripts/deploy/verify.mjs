/**
 * Verify the deployed Docket contract at an address: code integrity, address-derived schema,
 * docket state, reputation, and balances.
 *
 *   node scripts/deploy/verify.mjs [0xAddress]
 *
 * Defaults to the address in evidence/studionet-deployment-2026-10-07.txt. Read-only: this
 * never signs anything.
 */
import { installRetryingFetch } from "./net.mjs";
installRetryingFetch();

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { asAddress, accountFromKeystore } from "./docket-lib.mjs";

const { createClient, createAccount } = await import("genlayer-js");
const { studionet } = await import("genlayer-js/chains");

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const DEFAULT_ADDRESS = "0xb1a3778a3B11E0eD000bB24DF06108caDfd7729B";
const address = process.argv[2] ?? DEFAULT_ADDRESS;

const signer = await accountFromKeystore(
  process.env.DOCKET_KEYSTORE ?? "docket-deployer",
  process.env.DOCKET_PASSWORD_FILE,
).catch(() => null);
const client = createClient({ chain: studionet, account: createAccount(signer.privateKey) });

const J = (v) => JSON.parse(JSON.stringify(v, (k, x) => (typeof x === "bigint" ? x.toString() : x)));

const read = async (functionName, args) => {
  for (let i = 0; i < 8; i++) {
    try {
      return J(await client.readContract({ address, functionName, args }));
    } catch (e) {
      const stderr = (e.cause?.data?.receipt?.genvm_result?.stderr || "")
        .split("\n")
        .filter((l) => l.trim())
        .slice(-1)[0];
      const transport = /ETIMEDOUT|ENETUNREACH|fetch failed|ECONNRESET/.test(e.shortMessage ?? stderr);
      if (!transport) throw new Error(`${functionName}: ${stderr || e.shortMessage}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error(`${functionName}: exhausted retries`);
};

const out = {
  address,
  rpc: "https://studio.genlayer.com/api",
  network: "studionet",
  verified_at: new Date().toISOString(),
  deployer: signer.address,
};

out.code_matches_repo_source =
  (await client.getContractCode(address)) === readFileSync(join(REPO, "contracts", "docket.py"), "utf8");

out.schema = await client.getContractSchema(address);
out.schema_method_names = Object.keys(out.schema.methods).sort();
out.list_open_dockets = await read("list_open_dockets");

out.dockets = {};
for (const id of out.list_open_dockets ?? []) out.dockets[id] = await read("get_docket", [id]);

// NOTE: reputation takes an Address, so it MUST be wrapped — a plain hex string reverts.
out.reputation = {};
for (const addr of [signer.address].filter(Boolean)) {
  out.reputation[addr] = await read("get_reputation", [asAddress(addr)]);
}

const bal = async (a) => Number(BigInt(await client.request({ method: "eth_getBalance", params: [a, "latest"] })));
out.balances = { contract: await bal(address) };
if (signer.address) out.balances.deployer = await bal(signer.address);

console.log(JSON.stringify({
  address: out.address,
  code_matches_repo_source: out.code_matches_repo_source,
  schema_methods: out.schema_method_names.length,
  list_open_dockets: out.list_open_dockets,
  dockets: out.dockets,
  reputation: out.reputation,
  balances: out.balances,
}, null, 2));

const outPath = join(REPO, "evidence", `studionet-verify-${out.verified_at.slice(0, 10)}.json`);
writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log("wrote", outPath);