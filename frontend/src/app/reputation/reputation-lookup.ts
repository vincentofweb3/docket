import "server-only";
import { headers } from "next/headers";

/**
 * The connected account is only known in the browser, so this only reports what the server can
 * know — which is nothing about a wallet. It exists to keep the page a server component while
 * leaving a single place to add a cookie-based session later.
 */
export async function currentAccountHint(): Promise<{ address: string } | null> {
  void (await headers());
  return null;
}
