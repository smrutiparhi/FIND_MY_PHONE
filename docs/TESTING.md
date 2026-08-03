# RecoverAI — Testing Strategy (Part 21)

What's tested, at which layer, and why — plus what Part 21 actually added versus what already
existed from how every prior part was built.

## Most of this checklist was already covered before Part 21 started

The master spec's Part 21 checklist (authentication, authorization, device CRUD, incident creation,
risk assessment, the Recovery Decision Engine, location observations, SIM workflows, account
recovery state, financial protection state, police complaint generation, CEIR state management,
evidence access control, timeline generation, case recovery, case closure) maps almost one-to-one
onto the 44 existing test files under `apps/api/tests/` — this project's established pattern has
been to write tests alongside every part, not defer them to a dedicated testing phase. Part 21's own
job was auditing that coverage for real gaps and filling exactly those in, not rebuilding what
already existed:

- **The ten named end-to-end scenarios** didn't exist as their own tests - individual pieces were
  proven in isolation (e.g. `recoveryEngine.test.ts` covers the scoring rules directly), but nothing
  walked a full, named incident story end-to-end through the real stack.
- **Mobile responsiveness and accessibility** had no automated coverage at all.
- **HTTP-level authorization** (as opposed to repository-level) was Part 20's addition, reused here.

## Test layers

```
tests/repositories/   Direct repository-method tests against a real Postgres test database.
tests/services/       Service-layer logic (Recovery Decision Engine, guidance generators, guards).
tests/http/           Full Express stack (real routing, real Supabase-issued tokens, supertest
                       against createApp()) - added in Part 20 for authorization/security proof.
tests/scenarios/      Part 21: the ten named end-to-end incident scenarios, same HTTP-level
                       infrastructure as tests/http/.
apps/web/e2e/         Part 21: Playwright against a real running dev server - mobile
                       responsiveness and accessibility, which no other layer can exercise.
```

Every layer under `apps/api/tests/` runs against a **real** Postgres database (see `tests/setup.ts`)
and, where a layer needs a session, **real** disposable Supabase Auth accounts (`tests/http/
httpTestHelpers.ts`) - never a mocked database or a mocked auth layer. This project has never used
an in-memory substitute for either; a passing test means the actual integration works.

## The ten end-to-end scenarios (`tests/scenarios/endToEndScenarios.test.ts`)

Each scenario POSTs a realistic wizard payload through the real `/api/recovery-cases` route and
asserts a real, distinguishing property of the Recovery Decision Engine's output for that exact
incident shape - not just "a risk level got set somehow":

| # | Scenario | What it proves |
| - | -------- | --------------- |
| 1 | Lost Android at home | LOW risk; plan is exactly Locate → Ring → Nearby Search (the master spec's own worked example) |
| 2 | Stolen Android with account access | HIGH risk; locate is recommended before securing |
| 3 | Stolen Android without Google account access | CRITICAL; SIM protection unblocks account recovery |
| 4 | Stolen iPhone with Find My access | MEDIUM risk; the recommended action names "Find My" explicitly (platform-aware copy) |
| 5 | Stolen iPhone without Apple account access | CRITICAL; account recovery names "Apple" and is gated behind the SIM |
| 6 | Phone stolen while unlocked with UPI apps | CRITICAL; the tier-0 financial-emergency candidate outranks even a confident device-locate |
| 7 | SIM and phone both unavailable | CRITICAL; account recovery, secure-device, and locate are all `BLOCKED` behind SIM protection |
| 8 | Device offline | LOW risk; with nothing else wrong, the entire plan reduces to a single `MONITOR` action |
| 9 | Device recovered after CEIR submission | The full lifecycle - SIM block → account recovery → police report → CEIR submission → CEIR blocked → confirm possession (case → `RECOVERED`) → close (case → `CLOSED`), verified end-to-end including the resulting timeline |
| 10 | Attempted unauthorized access to another user's case | A second real account gets `404` on both read and write - the exhaustive version of this lives in `tests/http/authorization.test.ts` |

Scenario 9 is the only one that mutates a case through its full lifecycle rather than just checking
the initial risk assessment - it's the concrete proof that "case recovery" and "case closure" from
the checklist actually work chained together, not just each in isolation.

## Mobile responsiveness and accessibility (`apps/web/e2e/`)

A separate Playwright suite (`@playwright/test` + `@axe-core/playwright`), run with `npm run test:e2e
-w apps/web`. Separate from the fast `npm test` deliberately: it needs a real running dev server
(started automatically via Playwright's `webServer` config) and a real backend/database behind it,
so it's a live-stack check, not a component-isolated one.

- **Responsiveness**: every page checked at both a desktop and a real mobile viewport (`iPhone 13`
  emulation via Playwright's device presets), asserting zero horizontal overflow
  (`document.documentElement.scrollWidth` never exceeds `clientWidth`) - the actual, mechanical
  definition of "content doesn't require sideways scrolling on a phone." A dedicated test confirms
  the nav genuinely collapses to a hamburger menu at mobile width and that the hamburger actually
  opens it (`aria-expanded` toggles, the mobile nav becomes visible and contains real links) - proving
  the responsive behavior *works*, not just that the CSS classes claiming to do it exist.
- **Accessibility**: an axe-core scan on every page covered, failing the suite only on `serious` or
  `critical` impact violations. `minor`/`moderate` findings are logged, not enforced - real apps
  accumulate a long tail of those, and enforcing zero would make this suite unmaintainably brittle
  without meaningfully protecting anyone; `serious`/`critical` are the tier that actually means a
  real assistive-technology user is blocked.
- **Keyboard navigation**: the login form is confirmed Tab-reachable end to end (email → password →
  submit, no unreachable or out-of-order stop), directly exercising Part 23's `:focus-visible` styling
  and the semantic form structure it depends on.

## Mocking external providers

"Never make automated tests depend on real Apple, Google, bank, carrier, police or CEIR accounts"
(master spec) holds structurally, not by careful test discipline: RecoverAI never integrates with
any of those systems in the first place - it only ever guides the user through their own use of the
real, official flow (see [`ACCOUNT_RECOVERY.md`](ACCOUNT_RECOVERY.md),
[`SIM_PROTECTION.md`](SIM_PROTECTION.md), [`POLICE_REPORT.md`](POLICE_REPORT.md),
[`CEIR.md`](CEIR.md)) - so there is no client code path that could reach one of those services even
by accident. The two providers this app *does* call directly - the AI provider and the map provider -
default to `mock`/`none` (`packages/config/src/serverEnv.ts`), and the test environment
(`apps/api/.env`) pins both explicitly; `MockAiProvider` and `NoopMapProvider` are what every test run
actually exercises. Real provider implementations (`AnthropicAiProvider`, `OpenAiAiProvider`,
`MapboxMapProvider`, `MapTilerMapProvider`) exist in the codebase for production use but are never
instantiated in any test.

The one real external dependency every test layer *does* have is Supabase itself (Postgres + Auth) -
not named in the master spec's "never depend on" list because it's RecoverAI's own identity/database
provider, not one of the six external systems the app coordinates around. There is no in-memory or
mocked substitute for it anywhere in this codebase; see `tests/setup.ts`.
