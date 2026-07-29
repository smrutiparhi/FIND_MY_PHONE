# The AI Recovery Agent (Part 7)

A conversational assistant scoped to exactly one `RecoveryCase`. It explains what the deterministic
[Recovery Decision Engine](RECOVERY_ENGINE.md) (Part 6) currently recommends, helps the user report
new information, and can update a recovery action's status or record a corrected incident detail -
but only through two narrow, server-validated tools, never by talking its way around the engine.

The engine itself never changes: nothing here can alter `riskLevel`, `orderedActions`,
`currentRecommendedAction`, or `blockedActions` directly. The agent's tools only ever change the
*inputs* the engine reads (an action's status, a corrected wizard answer) and then re-run
`evaluateRecoveryDecision()` for real - see "How a tool call actually changes the plan" below.

## Why chat isn't persisted server-side

The master spec: "Store useful case events, not unnecessary sensitive conversation data." Read
literally, that's an instruction *not* to make the raw chat transcript the durable record.

So this app doesn't: conversation history lives in the browser tab's `sessionStorage`
(`apps/web/src/components/recoveryAgent/AgentChatPanel.tsx`), resent in full on every turn, and is
gone once the tab closes. Nothing about a message's content is ever written to the database.

What *is* durable is the effect of anything meaningful the agent does: every successful tool call
writes a `TimelineEvent` with `source: 'AI_AGENT'` (added in Part 2 specifically for this - see
`TIMELINE_EVENT_SOURCES` in `packages/shared/src/types/domain.ts`) and `verificationStatus:
'USER_REPORTED'`, since the underlying fact is always the user's own attestation relayed through
the agent, never something RecoverAI independently verified. That satisfies "store useful case
events" without ever needing to retain the conversation that produced them.

## Case context: given, never fetched

Rather than a `get_recovery_plan` tool the model could forget to call (or a caseId it could be
tricked into passing for someone else's case), every turn recomputes the case's live state
server-side and hands it to the model as part of the system prompt -
`services/recoveryAgent/caseContext.ts` + `runAgentTurn.ts`. This directly satisfies "the agent has
access only to the authenticated user's current recovery-case context": there is no tool surface
for reading any other case, and the context block is always fresh (it re-runs
`recalculateRecoveryCase()`, the same function the `GET /recovery-plan` endpoint uses, before every
model call).

Free-text fields the user typed (today: the wizard's last-seen description) are fenced with
`services/recoveryAgent/promptInjectionGuard.ts`'s `wrapUntrustedContent()` before being included,
labeled `<untrusted_user_supplied_data>`, with an explicit system-prompt instruction never to treat
that content as instructions. Evidence Vault (Part 15) must reuse the same helper for any
OCR'd/uploaded text that ends up in a prompt later - see "implement prompt-injection resistance for
uploaded evidence and external content" in the master spec.

## Tools

The agent's entire write surface (`services/recoveryAgent/tools.ts` /
`services/recoveryAgent/toolHandlers.ts`):

| Tool | Effect |
| --- | --- |
| `update_action_status` | Sets one action to `IN_PROGRESS`, `COMPLETED`, or `SKIPPED`, then recalculates the plan. |
| `record_incident_details` | Corrects/adds `accountAccessStatus`, `simAccessStatus`, `screenLockEnabled`, `deviceFindingAvailable`, and/or sensitive apps (additive), then recalculates the plan. |

There is deliberately no drafting tool: "help draft documents" is satisfied by the model writing
draft text directly into its reply (e.g. a plain-language incident summary) - it never creates a
persisted `PoliceReport` row itself. That structured, versioned flow belongs to Part 13 (Police
Complaint Generator) specifically; Part 7 only ever produces throwaway conversational text.

### Confirmation is enforced twice

Both tools require `userConfirmed: true` in their arguments, and the system prompt instructs the
model to only set it after explicit confirmation. That alone is a prompt-level control a model could
still get wrong - so `toolHandlers.ts`'s `looksLikeConfirmation()` independently pattern-matches the
literal last user message in the transcript for affirmative language, and rejects the tool call
(returning an error back to the model as a tool result, not a thrown exception) if either signal is
missing. This isn't real natural-language understanding and can't catch a model that fabricates a
fake "yes" - the point is to catch the much more common failure mode of a model treating an
ambiguous or negative reply as consent.

### How a tool call actually changes the plan

Both handlers end by calling `recalculateRecoveryCase()` - the exact same Part 6 function the
`PATCH /actions/:actionId` endpoint uses - so an agent-driven change is indistinguishable from a
UI-driven one once it lands. `record_incident_details` needed one addition to support this: before
Part 7, `RecoveryEngineInput`'s sensitive-app fields were derived once at case creation and always
carried forward on recalculation, with no path to correct them (`applyEngineResult.ts`'s
`sensitiveApps: latestAssessment?.sensitiveApps ?? []`). `recalculateRecoveryCase()` now accepts an
optional `overrides` object; `accountAccessStatus`/`simAccessStatus` are written straight to
`recovery_cases` (they already had a live column), while `screenLockEnabled` /
`deviceFindingAvailable` / a new sensitive app are merged into the engine input for that evaluation
and threaded through to `applyEngineResult()`, whose "should I write a new assessment snapshot"
check was broadened from "did risk change" to "did any assessed input change" - otherwise a
correction that happened not to move the risk score would be silently lost on the next
recalculation.

## Output guard

`services/recoveryAgent/outputGuard.ts` scans the model's final reply text for the most literal,
mechanically-detectable violations of the "must never" list - a request for a password/PIN/OTP, a
claim of tracking by phone number or IMEI, or something that looks like fabricated coordinates when
no location observation exists. A match replaces the reply with a safe, generic message and logs a
warning; this is a backstop, not a substitute for the system prompt (`systemPrompt.ts`), and can't
catch every rephrasing of a banned claim.

## Provider abstraction

`services/ai/AiProvider.ts` now carries tool-calling: a request may include `tools`, and a
response's `content` can mix text and `tool_use` blocks. `AnthropicAiProvider` and `OpenAiAiProvider`
(`services/ai/providers/`) talk to their respective APIs directly over `fetch` - no SDK dependency,
since the request/response shape this app actually needs (system prompt, message list, optional
tools, one completion) is small enough that a hand-rolled adapter keeps `AiProvider` the single
translation point. `MockAiProvider` (the default, `AI_PROVIDER=mock`) never calls a tool and always
returns a response flagged `isSimulated: true`, shown in the UI as a "DEMO AI PROVIDER" badge -
master spec: never present simulated output as a real integration.

Configure a real provider in `apps/api/.env`:

```
AI_PROVIDER=anthropic   # or openai
AI_API_KEY=<your key>
AI_MODEL=               # optional override; defaults to claude-sonnet-5 / gpt-4o-mini
```

Requesting a real provider without a key falls back to the mock with a logged warning rather than
failing the request - the chat should always respond with *something* clearly marked simulated.

## UI: four kinds of state, always labeled

`components/recoveryCase/VerificationTag.tsx` implements the master spec's UI requirement
("clear distinction between verified system state, user-reported state, AI recommendation,
external-service state") at chat scale: a user's own message is tagged "You said", the model's
prose is tagged "AI suggestion", a successful tool call's summary is tagged "Verified system state"
(it reflects a real database write, not opinion), and an official Apple/Google/police/CEIR link is
tagged "External service". The same tags are reused on the recovery-plan panel next to the engine's
risk badge and each action's official link.

## Testing

`tests/services/recoveryAgentGuards.test.ts` covers the pure guard functions
(`checkAgentReply`, `looksLikeConfirmation`, `wrapUntrustedContent`, `deriveSensitiveAppFlags`) with
no database. `tests/services/recoveryAgentTools.test.ts` exercises the tool handlers against a real
case (via `createRecoveryCaseFromWizard`) and a real Postgres instance: confirmation rejection (both
missing-flag and unconvincing-text cases), ownership scoping, the AI_AGENT timeline event, and the
sensitive-app-override plumbing actually changing a persisted `IncidentAssessment` row.
