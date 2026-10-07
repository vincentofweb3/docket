# Docket — Design System

## Brief, pinned down

Subject: a **docket** — the literal case-file/ledger register a court or claims office
keeps, one numbered entry per matter, each entry moving through defined stages until it's
closed and stamped. Audience: people posting or fulfilling agentic/freelance work who need
to trust a settlement without trusting each other. The page's job, every time: make the
state of a specific case (or the whole register) legible at a glance, and make the moment
of "verdict reached" feel weighty and final — the one moment worth spending visual boldness
on.

## Why not the defaults

- Not cream-paper-plus-serif-plus-terracotta: our accent isn't warm clay, and the paper tone
  here is intentionally cooler and greyer, closer to ledger stock than a latte.
- Not near-black-plus-neon: this product is about a formal, legible record, not a
  dashboard-at-night tool.
- The ruled, numbered, tabular layout below **does** resemble the "broadsheet" cluster on
  its surface, but it's earned here rather than defaulted into: docket IDs are literally
  sequential case numbers, and a ledger register is the actual real-world artifact this
  product is modeled on. The self-critique check: if the brief were "a recipe app" or "a
  portfolio site," would I reach for ruled numbered rows? No — so this is a choice tied to
  this specific subject, not a reflex.

## Token system

**Color**
| Token | Hex | Use |
|---|---|---|
| `--paper` | `#EEEDE7` | Page background — cool ledger stock, not warm cream |
| `--ink` | `#181B22` | Primary text, dark surfaces |
| `--ledger` | `#1F3A5F` | Primary structural accent — rules, headers, primary buttons |
| `--verdict-gold` | `#B8862E` | Reserved *exclusively* for the verdict seal and resolved-state accents — never used decoratively elsewhere |
| `--evidence-teal` | `#2B6E62` | Evidence links, chips, secondary actions |
| `--line` | `#D6D2C7` | Hairline rules |
| `--danger` | `#9C3B2E` | Reject/refund states only |

**Type** — the IBM Plex superfamily, used deliberately across three roles so the whole
system reads as one coherent "official register" typeface family rather than a random pair:
- Display: **IBM Plex Serif**, semibold — headlines, docket titles. Documentary, form-like
  weight without being decorative.
- Body: **IBM Plex Sans** — everything conversational: descriptions, buttons, labels.
- Data/utility: **IBM Plex Mono** — docket IDs (`DKT-0042`), amounts, timestamps, addresses,
  status codes. Monospace makes numbers and IDs scannable and signals "this is a record,"
  not prose.

**Layout** — ruled horizontal registers (rows separated by `--line` hairlines, not cards
with shadows), a fixed-width docket-number column on the left of every list, generous
vertical rhythm so a dense register doesn't feel cramped. No border-radius above 6px
anywhere except the seal itself.

**Signature element** — the **verdict seal**: a circular stamp, rotated -6°, that appears
only once a docket resolves, rendered in `--verdict-gold` (full/partial) or `--danger`
(reject), with the verdict word and score inside a double ring, like a notarization stamp.
This is the one bold, illustrative element in the whole system — everything else stays flat,
ruled, and quiet so the seal actually lands when it appears.

## Motion

One deliberate moment: the seal stamps down (scale + slight rotate-settle) when a resolution
is simulated on `adjudication-result.html`. No other animation — hover states are simple
color/underline shifts, respecting `prefers-reduced-motion`.

## Files in this folder

**Marketing**
- `index.html` — the full marketing landing page: hero with the ledger-card + floating
  verdict seal, the "missing layer" comparison against x402/ERC-8004/A2A/ACP, how-it-works,
  use cases, stats, the framing note, and a closing CTA. This is the extravagant, fully
  dressed entry point — everything else in this folder is the working application.

**Core application flow**
- `landing.html` — the open-docket register (browse), a quieter in-app hero plus the
  ruled register table.
- `docket-detail.html` — a single open docket's full record (scope, criteria, escrow,
  poster reputation, timeline) with the claim action — the page a worker lands on before
  claiming.
- `create-docket.html` — the docket-creation form (client side).
- `submit-deliverable.html` — the worker's evidence-submission form.
- `adjudicating.html` — the waiting state during a dispute, mapped directly onto
  GenLayer's real transaction stages (pending → proposing → committing/revealing →
  accepted → finalized) so a live adjudication never reads as "stuck."
- `adjudication-result.html` — the resolved-docket view with the verdict seal, reachable
  from either the fast-accept or the dispute path.
- `appeal.html` — appealing an accepted-but-not-yet-final verdict through GenLayer's
  native appeal/bond mechanism.

**Account & identity**
- `connect-wallet.html` — onboarding / wallet connection, including the network and
  faucet notes a first-time user needs.
- `my-dockets.html` — a personal dashboard split into "as client" / "as worker" tabs with
  status filtering, since the two roles have entirely different available actions.
- `reputation.html` — a read-only profile view of `get_reputation()` for any address, no
  wallet required to view.

**Reference / component states**
- `states.html` — empty states, wallet-gating, on-chain error banners (mapped to the
  contract's actual `EXPECTED_*`/`EXTERNAL_*` error codes), and the rare `Undetermined`
  consensus outcome.
- `components.html` — the reusable transaction-status toast and lifecycle-detail modal
  used by every write action across the app.

Each file is a static, self-contained HTML mockup (no build step) meant to hand directly to
the frontend implementation phase in `docs/06-integration-plan.md` — none of them are wired
to `genlayer-js` and none contain real chain calls, only small amounts of demo JS to show
state transitions (tab switching, the verdict-seal stamp animation, etc).
