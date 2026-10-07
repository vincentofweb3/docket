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
 * `{ bytes: Uint8Array }` is NOT sufficient — the real class is required.
 *
 * It is imported from the `genlayer-js/types` subpath, which re-exports the class properly. An
 * earlier version located it by scanning the package's dist chunks at runtime; that worked
 * locally but broke on Vercel, because a computed file:// specifier is invisible to the bundler's
 * dependency tracing, so the chunk was not shipped to the serverless function. A declared
 * subpath import is traced and always resolves.
 *
 * This module must only ever be imported from server code.
 */
import { CalldataAddress } from "genlayer-js/types";

/**
 * The SDK's Address calldata wrapper, structurally `class { bytes: Uint8Array }`. Exported as
 * that shape so it satisfies the SDK's `CalldataEncodable` union, which unions over the
 * (unexported-from-root) CalldataAddress class.
 */
export type CalldataAddressValue = { bytes: Uint8Array };

/** Wrap a 0x-prefixed 20-byte address for GenLayer calldata encoding. */
export async function asAddress(addr: string): Promise<CalldataAddressValue> {
  const bytes = new Uint8Array(Buffer.from(addr.replace(/^0x/, ""), "hex"));
  if (bytes.length !== 20) throw new Error(`not a 20-byte address: ${addr}`);
  return new CalldataAddress(bytes) as CalldataAddressValue;
}
