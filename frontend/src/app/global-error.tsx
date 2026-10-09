"use client";

/**
 * Global error boundary.
 *
 * Next's default replaces the whole page with "This page couldn't load", which tells a user
 * nothing and a reviewer nothing. This keeps the shell and states what failed, with the message
 * and a way to get back to a working page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#eeede7", color: "#181b22",
                    fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}>
        <div style={{ maxWidth: 640, margin: "0 auto", padding: "64px 24px" }}>
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12,
                        letterSpacing: "0.08em", textTransform: "uppercase", color: "#9c3b2e" }}>
            Something broke on this page
          </div>
          <h1 style={{ fontFamily: "'IBM Plex Serif', Georgia, serif", fontSize: 30,
                       margin: "12px 0 16px" }}>
            Docket hit an error
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.65, color: "#3a3d45" }}>
            This is a bug in the page, not a problem with your wallet or your dockets. Nothing you
            submitted has been lost — every write settles on-chain independently of this page.
          </p>
          <pre
            style={{
              background: "#fff",
              border: "1px solid #d6d2c7",
              borderRadius: 6,
              padding: "14px 16px",
              fontSize: 12.5,
              overflowWrap: "anywhere",
              whiteSpace: "pre-wrap",
              color: "#6b3128",
            }}
          >
            {error?.message ?? "Unknown error"}
            {error?.digest ? `\n\nReference: ${error.digest}` : ""}
          </pre>
          <div style={{ display: "flex", gap: 12, marginTop: 22, flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                background: "#1f3a5f", color: "#eeede7", border: "none",
                borderRadius: 4, padding: "10px 18px", fontSize: 14, cursor: "pointer",
              }}
            >
              Try again
            </button>
            <a
              href="/register"
              style={{
                border: "1px solid #181b22", color: "#181b22", borderRadius: 4,
                padding: "10px 18px", fontSize: 14, textDecoration: "none",
              }}
            >
              Back to the register
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
