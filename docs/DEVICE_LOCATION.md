# Device Location + Map (Part 8)

RecoverAI does **not** independently track phones. This module does two things: it points the user
at the *official* Apple Find My / Google Find Hub workflow for their device, and it gives them a
safe way to record what they saw there (or heard from a carrier, or remember) as a
`LocationObservation` - a historical log entry, never a live feed.

## RecoverAI never computes a location

Every coordinate ever shown by this app came from one of two places: an authorized integration (not
built yet - no such integration exists, see below) or a human typing it in. `services/maps/` only
ever hands the frontend map-rendering configuration (a provider name and a publishable token); it
has no geolocation logic of its own and never touches `LocationObservation` rows. The actual
`LocationObservation` write path (`services/location/recordLocationObservation.ts`) takes exactly
what the client sends - it never estimates, interpolates, or backfills a coordinate.

## The official device-finding link comes from Part 6

Rather than re-deriving Apple/Google links here, the Recovery Location page reads the
`officialExternalAction` already attached to the case's `LOCATE_DEVICE` action (built in Part 6 -
`findingProvider()` in `evaluateRecoveryDecision.ts`) and renders it as the primary call to action:
"Open Find My" / "Open Find Hub". RecoverAI never requests, stores, or handles the Apple/Google
password that flow needs - the user signs in on Apple's or Google's own site/app, in their own
browser tab, and comes back to RecoverAI to report what they saw.

## Four sources, one derived verification status

`LOCATION_SOURCES` (`AUTHORIZED_INTEGRATION`, `USER_CONFIRMED`, `USER_ENTERED`,
`OTHER_VERIFIED_SOURCE`) is what the user (or, in the future, an integration) claims about where
the data came from. `VerificationStatus` is what RecoverAI is willing to assert about it - and the
API derives one from the other server-side
(`services/location/deriveLocationVerificationStatus.ts`); a client can never submit its own
`verificationStatus`, so it's impossible for an `USER_ENTERED` guess to be mislabeled as verified:

| source | verificationStatus | meaning |
| --- | --- | --- |
| `AUTHORIZED_INTEGRATION` | `SYSTEM_VERIFIED` | Fetched directly by a configured, authorized API (none exists yet - reserved for a future real integration). |
| `USER_CONFIRMED` | `EXTERNAL_VERIFIED` | The user is looking at Find My/Find Hub right now and relaying exactly what it shows. Apple/Google verified it; RecoverAI is just the messenger. |
| `OTHER_VERIFIED_SOURCE` | `EXTERNAL_VERIFIED` | A carrier, police, or other verified party told the user. |
| `USER_ENTERED` | `UNVERIFIED` | Typed from memory or a screenshot. Master spec: "Never label USER_ENTERED coordinates as live GPS." |

## Recalculation

`locationStatus` (`AVAILABLE`/`UNAVAILABLE`, derived from whether *any* observation exists for the
case) is one of the Recovery Decision Engine's 17 inputs and factors into risk for a stolen device
with no known location. `recordLocationObservation()` calls `recalculateRecoveryCase()` after every
write, the same function every other write path in this app uses (Part 6's action-status PATCH,
Part 7's agent tools) - so recording a location is indistinguishable, from the engine's point of
view, from any other case-state change.

## The map itself

`components/recoveryLocation/DeviceMap.tsx` renders with plain Leaflet (no `react-leaflet`
dependency - an imperative `useEffect` keeps the map instance stable across re-renders while still
letting React own the surrounding page). Two things it deliberately does *not* do:

- **No connecting line between observations.** A polyline between two points would visually imply
  continuous movement between them, when in reality they could be minutes or days apart - master
  spec: "without presenting historical observations as continuous tracking." Every observation gets
  its own independent marker instead (larger and highlighted for the most recent one, with an
  accuracy-radius circle when `accuracyMeters` is known).
- **No fake map when unconfigured.** `MAP_PROVIDER=none` (the default) means `MapClientConfig.
  isConfigured` is `false`; `DeviceMap` renders an explicit "map unavailable" panel rather than a
  blank or broken map. Every other piece of location data (coordinates as text, timestamp, source,
  verification status, history) still renders normally - only the visual map graphic depends on a
  configured provider.

Two real tile providers are wired up (`MAP_PROVIDER=maptiler` or `mapbox`, both needing
`MAP_API_KEY`) via plain XYZ tile URL templates - no provider SDK, since Leaflet already handles
tile rendering generically. `google` is declared in the env schema (kept for forward-compatibility)
but has no renderer here: Google's terms don't allow raw tile-URL access the way MapTiler/Mapbox do,
so supporting it would mean a second, incompatible rendering path (the Google Maps JS API loader)
rather than a one-line addition - deferred rather than half-built.

## Safety warning

The Recovery Location page shows a fixed warning - "do not go there or confront a suspected thief;
share the information with the police instead" - whenever the case is `STOLEN` and at least one
observation exists. The Recovery Decision Engine (Part 6) already surfaces the same warning text
generically for any `STOLEN` case in `RecoveryPlan.warnings`; this page's own copy is independent
and always fires alongside a real location, matching the master spec's specific "if a stolen device
appears at an unfamiliar location" framing for this page.

## API

- `GET /api/map/config` - the public map provider config for the frontend to initialize Leaflet.
- `GET /api/recovery-cases/:caseId/locations` - full observation history, newest first.
- `POST /api/recovery-cases/:caseId/locations` - record one observation; returns the observation
  plus the freshly recalculated case and recovery plan in one response, so the frontend never needs
  a second round trip.
