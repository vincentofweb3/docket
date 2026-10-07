# 01 — Product Vision

## The problem

Every standard being built for agent-to-agent and agent-to-human commerce right now ships
the happy path and nothing else:

| Layer | Standard | Handles | Dispute resolution |
|---|---|---|---|
| Payments | x402 (Coinbase) | Internet-native, agent-friendly payments | Not specified |
| Identity & reputation | ERC-8004 (Ethereum) | Trustless agent identity | Delegated elsewhere |
| Agent interoperability | A2A (Linux Foundation / Google) | Task discovery & exchange | Not defined |
| Checkout | ACP (Stripe/OpenAI), AP2 (Google), Agent Pay (Mastercard) | Agent-initiated payment | Not specified |

The payment clears, the task is accepted, the reputation score updates — and the moment a
single party says "this wasn't what I asked for," every one of these stacks reaches for a
function it doesn't have. Today that function is filled by: a platform's internal support
queue (centralized, slow, siloed per-platform), a named human arbitrator (expensive, doesn't
scale to machine-speed agent transactions), or nothing at all (the paying party just eats
the loss, or the worker just doesn't get paid — both outcomes erode trust in agent commerce
before it has a chance to mature).

## The solution

**Docket** is a narrow, purpose-built settlement primitive: escrowed payment for a job,
released or refunded according to a decentralized, evidence-based verdict on whether the
delivered work met an agreed, written Scope of Work (SOW).

1. **Post a docket.** A client describes the job in natural language — the SOW — sets an
   acceptance threshold, a deadline, and escrows the payment in GEN.
2. **Claim and deliver.** A worker (a freelancer, a DAO contributor, or an autonomous AI
   agent with its own wallet) claims the docket and submits a deliverable: a set of public
   evidence URLs — a repo, a deployed endpoint, an API response, a document, a rendered
   page — plus an optional note.
3. **Accept or dispute.** The client can accept immediately (fast path, no adjudication
   needed, funds release instantly) or dispute within the review window.
4. **Adjudicate.** On dispute, GenLayer's validators independently fetch the same public
   evidence, evaluate it against the SOW's stated acceptance criteria, and reach consensus
   through a custom equivalence function on a **structured** verdict: `full`, `partial`, or
   `reject`, a `0–100` compliance score, and a short rationale.
5. **Settle.** The contract splits escrow deterministically from the agreed verdict — full
   release, a proportional partial release above a client-configured floor, or full refund.
   GenLayer's native appeal window and Optimistic Democracy escalation apply exactly as they
   do for any other Intelligent Contract transaction — Docket does not reimplement or
   shortcut that mechanism.
6. **Remember.** A lightweight on-chain reputation ledger tracks each address's verdict
   history, feeding future ERC-8004-style reputation claims without Docket needing to
   implement identity itself.

## What Docket explicitly is not

- **Not a prediction market.** Nothing is wagered on a future event; the underlying fact
  (was the work delivered?) already exists at dispute time. This was an explicit constraint
  from the outset.
- **Not a court.** GenLayer's own docs are direct about this: Intelligent Contracts can
  support an *agreed dispute-resolution workflow*, but they don't make a result legally
  binding on their own. Docket is framed throughout as a **contractual adjudication
  primitive** that two parties opt into when they open a docket — never as a legal judge.
  Parties who need enforceability beyond the escrowed funds still need their own agreements
  and jurisdiction.
- **Not a generic AI assistant.** Docket does not summarize, chat, recommend, or route.
  Every LLM call it makes produces one thing: a structured verdict that changes on-chain
  escrow state. If a feature doesn't move money or update the reputation ledger, it doesn't
  belong in the contract — see `docs/02-genlayer-fit-checklist.md`.
- **Not a centralized escrow with an "AI moderator" bolted on.** The evaluation only counts
  because independent validators, not Docket's own frontend or backend, run it and reach
  consensus on it. If the frontend pre-computed the verdict and just wrote it to chain,
  GenLayer would add no trust — this is explicitly called out as an anti-pattern in
  GenLayer's own developer docs, and Docket is designed to avoid it: the frontend/backend
  never produce a verdict, only inputs (the docket, the evidence links).

## Who this is for

- **Freelance & bounty platforms** wanting neutral dispute resolution without building or
  staffing an arbitration team.
- **DAOs and grant programs** releasing milestone-based funding against natural-language
  deliverable criteria.
- **Autonomous agent operators** who need their agents to transact work with other agents
  or humans without a shared trusted intermediary — the direct "adjudication inside the
  agentic-commerce stack" use case GenLayer's own docs call out as the gap in x402 /
  ERC-8004 / A2A.
- **Anyone shipping an agent-to-agent SLA** where "did the counterparty's agent actually do
  what it said it would" needs a verifiable, on-chain answer.

## One-sentence pitch

*Docket is the missing settlement step for agent and freelance work: escrow the payment,
write down the scope, and let decentralized AI-validator consensus — not a platform, not a
single model, not either party — decide whether the job was done.*
