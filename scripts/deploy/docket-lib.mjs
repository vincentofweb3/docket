/**
 * Typed Docket helpers over genlayer-js.
 *
 * ADDRESS ENCODING (verified 2026-10-07 against Studionet):
 * genlayer-js 1.1.8 does not re-export `CalldataAddress` from the package root, so a plain
 * hex address passed to readContract/writeContract is encoded as TYPE_BYTES. GenVM's TreeMap
 * key comparison then raises `assert isinstance(r, Address)` and every external call taking an
 * `Address`-typed parameter reverts. Internal (in-contract) calls are unaffected, which is why
 * the 29 direct tests never catch it. Always pass addresses through `asAddress()`.
 *
 * The SDK's encoder branches on `data instanceof CalldataAddress`, so a plain
 * `{ bytes: Uint8Array }` object is NOT sufficient — the real class is required. It is loaded
 * from its dist chunk because the package `exports` map blocks deep specifiers. This breaks on
 * a genlayer-js upgrade; the loader verifies the shape and fails loudly rather than silently
 * encoding addresses as bytes.
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

/** Resolve an ethers v6 install; the genlayer CLI bundles one. */
function loadEthers() {
  const candidates = [
    process.env.GENLAYER_ETHERS_PATH,
    process.env.HOME && join(process.env.HOME, ".genlayer/node_modules/ethers"),
    "/mnt/c/Users/hp/AppData/Roaming/npm/node_modules/genlayer/node_modules/ethers",
  ].filter(Boolean);
  for (const p of candidates) {
    try {
      return require(p);
    } catch {
      /* next */
    }
  }
  throw new Error(
    "ethers v6 not found. Set GENLAYER_ETHERS_PATH, or `npm i ethers` next to genlayer-js.",
  );
}

const { ethers } = loadEthers();

/** Locate genlayer-js's dist directory and pull CalldataAddress out of its chunks. */
async function loadCalldataAddress() {
  const { existsSync, readdirSync } = await import("node:fs");
  // `require.resolve("genlayer-js/package.json")` fails: the package `exports` map does not
  // expose package.json. Walk up from this module looking for the install instead.
  let dir = dirname(fileURLToPath(import.meta.url));
  let dist = null;
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, "node_modules", "genlayer-js", "dist");
    if (existsSync(candidate)) {
      dist = candidate;
      break;
    }
    dir = dirname(dir);
  }
  if (!dist) {
    throw new Error(
      "genlayer-js is not installed next to this script. Run `npm install` in the repo root.",
    );
  }

  for (const file of readdirSync(dist)) {
    if (!file.endsWith(".js") || file.startsWith("index")) continue;
    try {
      const mod = await import(pathToFileURL(join(dist, file)).href);
      if (typeof mod.CalldataAddress === "function") return mod.CalldataAddress;
    } catch {
      /* not this chunk */
    }
  }
  throw new Error(
    "CalldataAddress not found in any genlayer-js dist chunk. The SDK layout probably " +
      "changed; re-check how it encodes Address before trusting asAddress().",
  );
}

const CalldataAddress = await loadCalldataAddress();

/** Wrap a 0x-prefixed 20-byte address for GenLayer calldata encoding. */
export const asAddress = (addr) => {
  const bytes = new Uint8Array(Buffer.from(String(addr).replace(/^0x/, ""), "hex"));
  if (bytes.length !== 20) throw new Error(`not a 20-byte address: ${addr}`);
  return new CalldataAddress(bytes);
};

/**
 * Derive an account from an encrypted genlayer CLI keystore. The decrypted key is returned in
 * memory only and is never written to disk.
 */
export async function accountFromKeystore(name, passwordFile) {
  const home = process.env.HOME;
  const ks = JSON.parse(readFileSync(join(home, ".genlayer/keystores", `${name}.json`), "utf8"));
  const pw = readFileSync(passwordFile ?? join(home, ".genlayer/docket-deployer.pass"), "utf8");
  // ethers v6: Wallet.fromEncryptedJson is async.
  const wallet = await ethers.Wallet.fromEncryptedJson(JSON.stringify(ks), pw);
  return { privateKey: wallet.privateKey, address: wallet.address };
}

export { CalldataAddress };