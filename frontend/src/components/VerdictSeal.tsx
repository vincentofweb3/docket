"use client";

import { useEffect, useState } from "react";
import { VERDICT, VERDICT_LABEL, docketRef } from "@/lib/docket";

/**
 * The verdict seal — the signature element from design/design-system.md. The one bold,
 * illustrative element in the system; everything else stays flat and ruled so it lands.
 *
 * Gold for full/partial, danger for reject. Stamps down once on mount, respecting
 * prefers-reduced-motion (handled globally in globals.css).
 */
export function VerdictSeal({
  verdict,
  score,
  docketId,
  resolved = true,
}: {
  verdict: number;
  score: number;
  docketId: number;
  resolved?: boolean;
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    // One frame later so the transition actually runs from the initial scale.
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (!resolved || verdict === VERDICT.NONE) {
    return (
      <div className="seal-wrap">
        <div className="seal seal-undecided shown">
          <div className="verdict-word">Undecided</div>
          <div className="score">no verdict</div>
          <div className="docket-ref">{docketRef(docketId)}</div>
        </div>
      </div>
    );
  }

  const rejected = verdict === VERDICT.REJECT;

  return (
    <div className="seal-wrap">
      <div className={`seal${shown ? " shown" : ""}${rejected ? " reject" : ""}`}>
        <div className="verdict-word">{VERDICT_LABEL[verdict]}</div>
        <div className="score">{score} / 100</div>
        <div className="docket-ref">
          {docketRef(docketId)} · finalized
        </div>
      </div>
    </div>
  );
}