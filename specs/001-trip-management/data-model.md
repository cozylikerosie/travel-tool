# Data Model: Trip Management

## Current Entity

### Trip

One user-created travel plan. Persist each record in the Dexie `trips` store.

| Field | Type | Required | Rules |
|---|---|---:|---|
| `id` | UUID string | Yes | Stable primary key; create with `crypto.randomUUID()`; copying a trip creates a new ID. |
| `createdAt` | ISO 8601 UTC timestamp | Yes | Set when the trip is first created; immutable on update. |
| `updatedAt` | ISO 8601 UTC timestamp | Yes | Set on creation and refreshed on each successful update. |
| `name` | String | Yes | Trim surrounding whitespace; must not be empty. |
| `destinations` | String array | Yes | At least one non-empty, trimmed destination; preserve user order. |
| `startDate` | `YYYY-MM-DD` string | Yes | Calendar date only; must not be after `endDate`. |
| `endDate` | `YYYY-MM-DD` string | Yes | Calendar date only; must be on or after `startDate`. |
| `budgetAmountMinor` | Safe integer or null | No | If present, greater than zero; stored in currency minor units. |
| `budgetCurrency` | ISO 4217 code or null | No | Required when an amount is present; feature 001 supports `TWD` and `JPY`. |
| `companions` | String array | No | Names are trimmed; empty values are omitted; preserve user order. |
| `notes` | String or null | No | Optional free text. |

The budget amount and currency are either both absent or both present. The form may accept a decimal amount in the currency's major unit, but persistence uses the integer minor-unit value. TWD uses two decimal places; JPY uses zero.

## Derived Values

- **Duration in days**: Calendar-day difference between `startDate` and `endDate`, plus one. Equal dates produce one day.
- **Trip status**: Derived at read/display time using the user's local calendar date. If today is before `startDate`, status is upcoming; if today is between both dates inclusive, status is ongoing; if today is after `endDate`, status is completed. Do not persist this value.
- **List ordering**: `startDate` ascending. A deterministic secondary sort may use normalized trip name when dates match; it must not omit trips.

## Storage and Relationships

- Dexie IndexedDB schema starts at database version 1 with a `trips` store keyed by `id`, indexed by `startDate` and `endDate` for list queries.
- Destination and companion values are arrays on Trip because they are simple labels with no independent lifecycle in this feature.
- Each future daily itinerary, transport segment, or expense record must carry `tripId` referencing its owning Trip. A daily itinerary entry may additionally reference a day identifier; do not create these stores until their feature is in scope.
- IndexedDB has no relational foreign-key enforcement. Repository operations that later create or delete related records must use a Dexie transaction and validate `tripId` ownership.
- Deleting a current Trip deletes its Trip record. Future related records require transactional cascading or an explicit archive policy in the feature that introduces them.

## Versioning and Future JSON Exchange

- Dexie database version tracks IndexedDB schema/index changes. Increase it when schema changes; provide a tested `.upgrade()` migration when existing records must change.
- Define one shared Zod schema for editable Trip fields. The runtime form-input schema and full persisted Trip schema must derive from those same field rules; infer corresponding TypeScript types from the Zod schemas rather than maintaining duplicate field definitions.
- Future JSON export/import must use a separate top-level `formatVersion` and validate each complete imported Trip with the full persisted Trip schema before writing. JSON format version is not the Dexie database version.
- Feature 001 does not implement import, export, migration UI, or future entity stores.

## Copy and Delete Behavior

- Copy creates a new unsaved/editable Trip draft from the source's user-entered fields. Saving assigns a new `id`, `createdAt`, and `updatedAt`; mutable arrays are copied independently. Editing or deleting either saved Trip must not mutate the other.
- Delete requires explicit confirmation. Cancellation performs no database write; confirmation removes the Trip.