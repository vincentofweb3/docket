/**
 * Network resilience for GenLayer RPC calls from WSL.
 *
 * WSL hands node/undici Cloudflare anycast addresses for studio.genlayer.com that time out,
 * while curl and python succeed against the same host. Forcing IPv4-only resolution and a
 * single address family makes undici pick the address that actually works, and the retry
 * wrapper covers the residual flakiness.
 */
import net from "node:net";
import dns from "node:dns";

net.setDefaultAutoSelectFamily(false);
dns.setDefaultResultOrder("ipv4first");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const RETRYABLE = new Set([
  "ETIMEDOUT",
  "ENETUNREACH",
  "ECONNRESET",
  "EAI_AGAIN",
  "EPIPE",
  "ECONNREFUSED",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT_TIMEOUT",
]);

/** Wrap globalThis.fetch so transient transport failures are retried. */
export function installRetryingFetch(attempts = 25) {
  const inner = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : (input?.url ?? "");
    let last;
    for (let i = 0; i < attempts; i++) {
      try {
        return await inner(input, init);
      } catch (e) {
        last = e;
        const errs = e?.cause?.errors ?? [];
        const codes = errs.length ? errs.map((x) => x.code) : [e?.cause?.code ?? e?.code ?? ""];
        if (!codes.some((c) => RETRYABLE.has(String(c)))) throw e;
        console.error(`[net] ${codes.join("/")} retry ${i + 1}/${attempts} :: ${url.slice(0, 50)}`);
        await sleep(1200 + i * 600);
      }
    }
    throw last;
  };
  return globalThis.fetch;
}