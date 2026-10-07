/**
 * Address calldata encoding. Server-only by design.
 *
 * Why this exists (verified 2026-10-07 against Studionet): genlayer-js 1.1.8 does not
 * re-export `CalldataAddress` from the package root. A plain hex address passed to
 * readContract/writeContract is therefore encoded as TYPE_BYTES, and GenVM's TreeMap key
 * comparison raises `assert isinstance(r, Address)` — so every external call taking an
 * Address-typed parameter reverts. Internal in-contract calls are unaffected, which is why the
 * contract-level test suite never catches it.
 *
 * The SDK encoder branches on `data instanceof CalldataAddress`, so a structural
 * `{ bytes: Uint8Array }` is NOT sufficient — the real class is required. It is loaded from
 * the package's dist chunks because the `exports` map does not expose it, and the loader
 * throws rather than silently degrading to TYPE_BYTES.
 *
 * This module reads the filesystem, so it must only ever be imported from server code.
 */

type CalldataAddressCtor = new (bytes: Uint8Array) => unknown;

let cached: Promise<CalldataAddressCtor> | null = null;

async function findCtor(): Promise<CalldataAddressCtor> {
  const mod = (await import("genlayer-js")) as unknown as {
    CalldataAddress?: CalldataAddressCtor;
  };
  if (typeof mod.CalldataAddress === "function") return mod.CalldataAddress;

  const { readdir, access } = await import("node:fs/promises");
  const path = await import("node:path");
  const url = await import("node:url");

  // Walk up from both the module and the server cwd looking for the install. Avoids
  // createRequire, whose typing differs across @types/node versions.
  const roots = [path.dirname(url.fileURLToPath(import.meta.url)), process.cwd()];
  let dist: string | null = null;
  for (const root of roots) {
    let dir = root;
    for (let i = 0; i < 8 && !dist; i++) {
      const candidate = path.join(dir, "node_modules", "genlayer-js", "dist");
      try {
        await access(candidate);
        dist = candidate;
      } catch {
        dir = path.dirname(dir);
      }
    }
    if (dist) break;
  }
  if (!dist) throw new Error("genlayer-js is not installed. Run `npm install` in frontend/.");

  for (const file of await readdir(dist)) {
    if (!file.endsWith(".js") || file.startsWith("index")) continue;
    try {
      // webpackIgnore keeps webpack from rewriting this: the specifier is a runtime file:// URL
      // it cannot analyse, and rewriting it makes the import fail inside the server bundle.
      const specifier = url.pathToFileURL(path.join(dist, file)).href;
      const chunk = (await import(/* webpackIgnore: true */ specifier)) as {
        CalldataAddress?: CalldataAddressCtor;
      };
      if (typeof chunk.CalldataAddress === "function") return chunk.CalldataAddress;
    } catch {
      /* not this chunk */
    }
  }
  throw new Error(
    "CalldataAddress not found in genlayer-js. The SDK layout likely changed — re-check how " +
      "it encodes Address before trusting asAddress().",
  );
}

/**
 * The SDK's Address calldata wrapper, structurally `class { bytes: Uint8Array }`.
 * Returned as that shape so it satisfies the SDK's `CalldataEncodable` union, which unions
 * over the (unexported) CalldataAddress class.
 */
export type CalldataAddressValue = { bytes: Uint8Array };

/** Wrap a 0x-prefixed 20-byte address for GenLayer calldata encoding. */
export async function asAddress(addr: string): Promise<CalldataAddressValue> {
  cached ??= findCtor();
  const Ctor = await cached;
  const bytes = new Uint8Array(Buffer.from(addr.replace(/^0x/, ""), "hex"));
  if (bytes.length !== 20) throw new Error(`not a 20-byte address: ${addr}`);
  return new Ctor(bytes) as CalldataAddressValue;
}