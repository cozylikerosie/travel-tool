# Quickstart: Trip Management Validation

This guide describes the validation path after the Vite application scaffold and feature implementation exist. The current repository contains planning artifacts only; these commands are not runnable until `package.json` and app source are created.

## Prerequisites

- Node.js LTS and npm
- A modern desktop browser with IndexedDB support
- The project dependencies installed from `package.json`

## Start and Test

```sh
npm install
npm run dev
npm run test -- --run
npm run build
npm run preview
```

The Vite dev server is for local interaction. Vitest must run the unit, Dexie repository, and React Testing Library suites. The production preview validates the built app and PWA configuration before GitHub Pages deployment.

## Validation Scenarios

1. **Create and persist**: Create a trip with multiple destinations, dates, TWD budget, companions, and notes. Confirm it appears in the list. Close and reopen the browser at the same origin and confirm its data remains.
2. **Required-field validation**: Submit without each required field in turn. Confirm save is blocked and a Traditional Chinese message identifies the missing field.
3. **Date rules**: Reject a return date before departure; accept equal dates and show one day. Test a trip over a daylight-saving boundary and in different timezone settings; its stored calendar dates and inclusive day count must not shift.
4. **Budget rules**: Accept positive TWD and JPY amounts using their currency precision. Reject zero and negative values. Reject a budget amount without a currency.
5. **List and status**: Create multiple trips with different start dates. Confirm ascending order and all three statuses: upcoming, ongoing (including both endpoint dates), and completed. Confirm the empty state offers「建立第一趟旅程」.
6. **Edit, copy, and delete**: Edit a trip and verify derived list details update. Copy it, change the copy, and verify the source remains unchanged. Cancel a delete confirmation and verify the trip remains; confirm another deletion and verify it is removed.
7. **Offline app shell**: Build and open the production preview online once so the service worker can install. Reload with the browser offline and confirm the app shell opens. This checks app assets only; trip data remains in IndexedDB and must not be placed in the service-worker cache.

## Expected Results

- Automated tests pass with `npm run test -- --run`.
- The production build completes with paths compatible with the configured GitHub Pages base path.
- User-visible labels and validation messages are in Traditional Chinese.
- Trips remain local to the browser profile; no account, API, or synchronization is required.