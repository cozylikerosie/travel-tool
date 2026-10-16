# Research: Trip Management

## Decisions

### Frontend and deployment

- **Decision**: Use the requested Vite + React + TypeScript single-page app, Tailwind CSS, and `vite-plugin-pwa`; deploy static assets to GitHub Pages.
- **Rationale**: This matches the selected stack and avoids a server dependency for a personal, local-first tool. The service worker provides an installable cached app shell; IndexedDB remains the source of user trip data.
- **Alternatives considered**: A backend or hosted database would add accounts, network dependence, and synchronization that this project does not need.
- **Deployment caveat**: Vite `base` must match the Pages site type. Repository project sites use the repository path (for example, `/<repository>/`); user/organization sites and custom domains use `/`. Keep service-worker scope aligned with the built app path.
- **References**: [Vite GitHub Pages deployment](https://vite.dev/guide/static-deploy.html#github-pages), [Vite `base`](https://vite.dev/config/shared-options.html#base), [vite-plugin-pwa options](https://github.com/vite-pwa/vite-plugin-pwa/blob/main/src/types.ts), [service worker scope](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register#scope).

### Local persistence and schema evolution

- **Decision**: Use Dexie.js over IndexedDB. Start with a `trips` store and index the primary key plus the date fields needed for ordered lists and status filtering. Later child stores must include `tripId`; do not create unused itinerary, transport, or expense stores in feature 001.
- **Rationale**: Dexie supports explicit schema versions and transactional upgrades. A small current schema keeps this feature simple while `tripId` provides a stable relationship for later features. IndexedDB does not enforce relational foreign keys, so repository operations must maintain relationships.
- **Alternatives considered**: Storing everything in a remote database violates the local-first constraint. Creating every planned future store now adds unused complexity.
- **Migration rule**: Increment the Dexie database version when IndexedDB stores or indexes change; add an upgrade transformation when existing records need conversion. Keep upgrade functions deterministic and tested against old-version data.
- **Format-version rule**: Future JSON files use a separate top-level `formatVersion`; it is not the Dexie database version. This feature does not implement JSON export or import.
- **References**: [Dexie database versioning](https://dexie.org/docs/Tutorial/Design#database-versioning), [Version.stores](https://dexie.org/docs/Version/Version.stores()), [Version.upgrade](https://dexie.org/docs/Version/Version.upgrade()), [Dexie best practices](https://dexie.org/docs/Tutorial/Best-Practices).

### Calendar dates

- **Decision**: Store trip dates as ISO calendar-date strings (`YYYY-MM-DD`) with no time or timezone. Compare and sort these normalized strings; derive trip length with calendar-day arithmetic that counts both endpoints. Determine “today” from local calendar components, not a UTC timestamp converted back to local time.
- **Rationale**: A travel date represents a calendar day, not a moment. Parsing a date-only string with JavaScript `Date` uses UTC semantics and can display the previous or following day in some device timezones. Local timestamp subtraction can also cross daylight-saving transitions.
- **Alternatives considered**: Persisting midnight timestamps would tie date-only values to a timezone. `Temporal.PlainDate` is semantically suitable but browser availability is not yet broad enough to require it without a polyfill.
- **Implementation note**: Use a tested pure date-only helper; do not pass persisted `YYYY-MM-DD` values through `new Date(string)` for display or day-count calculations.
- **References**: [HTML date input value](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/date), [ECMAScript Date.parse](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-date.parse), [Temporal.PlainDate](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal/PlainDate).

### Money representation

- **Decision**: Persist budget values as a positive safe integer in currency minor units plus an ISO 4217 currency code. Support TWD and JPY for this feature; use each currency's defined minor-unit precision when parsing and formatting.
- **Rationale**: Integer arithmetic avoids binary floating-point rounding in persisted amounts. JPY has zero minor decimal places; TWD has two. UI input parsing must convert decimal text directly to the integer representation rather than multiply an already-rounded floating-point number.
- **Alternatives considered**: Persisting display strings makes numeric validation and later comparisons unreliable; persisting floating-point major-unit values introduces rounding risk.
- **References**: [SIX ISO 4217 currency data](https://www.six-group.com/en/products-services/financial-information/data-standards.html), [Intl.NumberFormat currency defaults](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat), [Number.isSafeInteger](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-number.issafeinteger).

### Testing strategy

- **Decision**: Use Vitest with jsdom and React Testing Library for behavior tests, fake-indexeddb for Dexie repository tests, and a production-preview browser smoke check for actual IndexedDB persistence and service-worker behavior.
- **Rationale**: Pure domain rules can be tested quickly; repository tests cover transactions and persistence interfaces; UI tests verify user-visible outcomes. A fake IndexedDB implementation does not prove browser service-worker or browser-restart behavior, so retain a real-browser check.
- **Test coverage**: Validate required fields, date ordering, inclusive day count and statuses, money precision and positivity, empty/list states and sorting, create/edit/copy/delete-confirm flows, and persistence across closing/reopening the database.
- **Alternatives considered**: UI-only tests would not isolate date/money rules or verify repository behavior; fake-indexeddb alone cannot verify PWA caching in a real browser.
- **References**: [Vitest environments](https://vitest.dev/guide/environment.html), [Testing Library guiding principles](https://testing-library.com/docs/guiding-principles/), [user-event](https://testing-library.com/docs/user-event/intro/), [fake-indexeddb](https://github.com/dumbmatter/fakeIndexedDB).

## Resolved Unknowns

- The selected frontend, storage, PWA, deployment, and test technologies are supplied by the user.
- The feature is local-only and has no external service or API contract.
- No quantitative performance or record-count target was provided; keep the personal-device scope and do not add an invented service-level target.
- The repository Pages URL is not available in the current source tree; set Vite `base` from the eventual repository/site configuration during scaffold/deployment setup.