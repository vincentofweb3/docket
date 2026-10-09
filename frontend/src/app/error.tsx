"use client";

import Link from "next/link";

/**
 * Route-level error boundary.
 *
 * Next's default error screen replaces the page with "Something went wrong", which tells a user
 * nothing and a reviewer nothing. This states what failed and offers a way back. Writes settle
 * on-chain independently of this page, so nothing submitted is lost by a render error here.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="shell shell-narrow">
      <div className="eyebrow" style={{ color: "var(--danger)" }}>
        This page failed to render
      </div>
      <h1>Docket hit an error</h1>
      <p className="lede">
        This is a bug in the page rather than a problem with your wallet or your dockets. Nothing
        you submitted has been lost — every write settles on-chain independently of this page.
      </p>
      <pre className="error-detail">{error?.message ?? "Unknown error"}</pre>
      <div className="action-row" style={{ marginTop: 18 }}>
        <button className="btn" onClick={reset}>
          Try again
        </button>
        <Link className="btn btn-ghost" href="/register">
          Back to the register
        </Link>
      </div>
    </div>
  );
}
