---
description: "Implementation tasks for desktop trip management"
---

# Tasks: 建立與管理旅程（電腦端）

**Input**: Design documents from `/specs/001-trip-management/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `quickstart.md`

**Tests**: Required by FR-015 and the project constitution. Write story tests before their implementations and verify the tests fail for the missing behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because the task changes independent files and has no unfinished dependency.
- **[Story]**: User story label from `spec.md`; setup, foundational, and polish tasks have no story label.
- Every task names the exact file or files to create or update.

## Phase 1: Setup

**Purpose**: Establish the single frontend app and shared tooling.

- [ ] T001 建立 Vite React TypeScript 專案骨架，新增 `package.json`、`index.html`、`src/main.tsx`、`src/app/App.tsx` 與 `tsconfig.json`。
- [ ] T002 在 `package.json` 加入 Vite、React、Tailwind CSS、Dexie.js、Zod、vite-plugin-pwa、lucide-react、Vitest、React Testing Library、jsdom 與 fake-indexeddb 相依套件；在 `vite.config.ts` 設定應用程式路徑、Tailwind 與 PWA 外掛。
- [ ] T003 [P] 在 `tests/setup.ts` 與 `vitest.config.ts` 設定 Vitest/jsdom 測試環境，讓 React Testing Library 與 fake-indexeddb 可供測試使用。
- [ ] T004 [P] 在 `src/styles/tailwind.css` 建立 Tailwind 主題 tokens，逐一對應 `docs/design-guide.md` 的背景 `#F7F5F0`、白色 `#FFFFFF`、文字 `#1A1A1A`/`#6B6B6B`、分隔線 `#D9D5CC`、點綴色 `#8A7A5C`、預算狀態色 `#6F8A6B`/`#B8935A`/`#A65A4E`、深色模式色 `#141414`/`#EDEAE3`/`#3A3833`，以及 Noto Serif TC、Noto Sans TC、Cormorant Garamond、Inter 字體家族。
- [ ] T005 [P] 新增 `.github/workflows/deploy-pages.yml` 建置並部署靜態網站至 GitHub Pages，使用 `vite.config.ts` 中與 repository/site 類型相符的 base path。

---

## Phase 2: Foundational

**Purpose**: Build shared trip data, date, money, and persistence foundations required by all user stories.

**Checkpoint**: Trip schema/repository and tested date/money rules are ready before story UI work begins.

- [ ] T006 [P] 先在 `tests/unit/tripDates.test.ts` 撰寫純日期測試，涵蓋日期順序、首尾皆計入的天數、閏年/跨年、三種旅程狀態邊界及時區不改變日期的行為。
- [ ] T007 [P] 先在 `tests/unit/budget.test.ts` 撰寫金額測試，涵蓋正整數最小單位、TWD 兩位與 JPY 零位精度、零/負數拒絕及安全整數限制。
- [ ] T008 [P] 先在 `tests/unit/tripSchema.test.ts` 撰寫原始表單輸入與完整旅程的 Zod runtime schema 測試，再於 `src/features/trips/tripSchema.ts` 定義正規化欄位 `tripFieldsSchema`、接受原始表單值的 `tripFormSchema`，以及以欄位 schema 擴充 `id`、`createdAt`、`updatedAt` 的完整 `tripSchema`。`tripFormSchema` MUST 驗證原始輸入（含十進位預算字串），將預算轉成整數最小單位後交由 `tripFieldsSchema` 驗證；完整 `tripSchema` 使用相同正規化欄位規則。以 `z.infer` 推導 TypeScript 型別，TypeScript 型別只負責編譯期檢查。共用欄位規則遵循 `data-model.md`：`name` 去除首尾空白且不可為空；`destinations` 至少一個非空、已修剪項目並保留順序；`startDate` 不晚於 `endDate`；`endDate` 不早於 `startDate`；`budgetAmountMinor` 若有值必須大於零且為安全整數；有預算金額時 `budgetCurrency` 必填並使用 TWD 或 JPY；`companions` 修剪名稱、略過空值並保留順序；`notes` 可為空。完整旅程的 `id` 必須符合 UUID，`createdAt` 與 `updatedAt` 必須是 ISO 8601 UTC timestamp。表單使用 `tripFormSchema`、未來 JSON 匯入使用完整 `tripSchema`，兩者 MUST 共用 `tripFieldsSchema` 且不得重複定義欄位規則；本 feature 不實作 JSON 匯入。
- [ ] T009 在 `src/data/database.ts` 建立 Dexie database version 1 與 `trips` store，以 `id` 為主鍵並為 `startDate`、`endDate` 建索引；本功能不建立未使用的未來資料表。
- [ ] T010 [P] 在 `src/shared/dates/tripDates.ts` 實作純日期解析/比較、首尾皆計入天數與狀態分類；以當地日曆日期取得 today，不將 `YYYY-MM-DD` 直接交給 `new Date(string)` 解析。
- [ ] T011 [P] 在 `src/shared/money/budget.ts` 實作預算輸入解析與格式化，將 TWD/JPY 金額轉成安全整數最小單位，並拒絕非正值、超出安全整數或不符合幣別小數位的輸入。
- [ ] T012 [P] 先在 `tests/integration/trips/tripRepository.test.ts` 撰寫 Dexie repository 測試，使用 fake-indexeddb 的同一個 `IDBFactory` 寫入旅程、關閉資料庫、以相同資料庫名稱重新開啟，再讀回並斷言原資料仍存在；另涵蓋新增、更新、刪除及按 trip ID/日期讀取。
- [ ] T013 在 `src/data/tripRepository.ts` 實作 Trip repository CRUD 與日期排序查詢，並確保所有寫入遵守 `src/features/trips/tripSchema.ts` 完整旅程 schema 的欄位限制。

---

## Phase 3: User Story 1 - 建立並保存旅程 (Priority: P1) 🎯 MVP

**Goal**: 使用者填寫旅程基本資料並保存到本機，建立後能查看旅程摘要。

**Independent Test**: 建立含多個目的地、選填預算/同行者/備註的旅程；確認成功儲存與列表摘要，驗證必填欄位、日期、預算錯誤和繁體中文提示。

### Tests for User Story 1

- [ ] T014 [P] [US1] 先在 `tests/integration/trips/createTripValidation.test.tsx` 撰寫建立表單驗收測試，驗證名稱/目的地/日期必填、回程早於出發日、預算非正值時阻止儲存、不得呼叫 repository 寫入，並以繁體中文指出錯誤。
- [ ] T015 [P] [US1] 先在 `tests/integration/trips/createTrip.test.tsx` 撰寫保存流程測試：成功建立需以 `crypto.randomUUID()` 產生 `id` 並設定 `createdAt`/`updatedAt`；成功更新需保留 `id`/`createdAt` 並更新 `updatedAt`；模擬 ID/時間產生、完整旅程 schema 驗證及 IndexedDB 寫入失敗時，驗證不新增或部分更新資料且介面顯示錯誤訊息。

### Implementation for User Story 1

- [ ] T016 [US1] 在 `src/features/trips/saveTrip.ts` 實作建立/更新共用保存流程：先以 `tripFormSchema.safeParse` runtime 驗證使用者輸入；通過後建立時以 `crypto.randomUUID()` 產生 `id` 並設定 `createdAt`/`updatedAt`，更新時保留既有 `id`/`createdAt` 並更新 `updatedAt`；接著以完整 `tripSchema.safeParse` 驗證；只有兩次驗證與 metadata 產生皆成功後，才透過 `src/data/tripRepository.ts` 寫入 IndexedDB。任一步驟失敗都不得寫入；更新寫入失敗不得改變原資料，並回傳可供介面顯示的錯誤。
- [ ] T017 [US1] 在 `src/features/trips/TripForm.tsx` 建立繁體中文旅程表單，輸入名稱、多個目的地、出發/回程日期、選填預算與幣別、多人同行者及備註；提交時呼叫 `src/features/trips/saveTrip.ts`，將 runtime validation 欄位錯誤連結至相應欄位，並將其他保存失敗顯示為清楚錯誤訊息。
- [ ] T018 [US1] 在 `src/features/trips/TripHomePage.tsx` 與 `src/features/trips/TripList.tsx` 串接建立、repository 保存及建立後摘要列表，顯示名稱、目的地、日期與依純日期 helper 計算的天數。

**Checkpoint**: 使用者可建立並持久保存有效旅程；無效資料會阻止儲存並顯示繁體中文提示。

---

## Phase 4: User Story 2 - 瀏覽及辨識旅程 (Priority: P2)

**Goal**: 使用者在首頁查看所有旅程、依日期排序並辨認「即將出發」、「旅途中」、「已結束」；空資料時有建立入口。

**Independent Test**: 以預先建立的多趟旅程檢查空狀態、名稱/目的地/日期/天數、出發日排序及三種狀態；出發日和回程日當天均屬「旅途中」。

### Tests for User Story 2

- [ ] T019 [P] [US2] 先在 `tests/integration/trips/tripEmptyState.test.tsx` 撰寫空首頁測試，驗證引導文字及「建立第一趟旅程」按鈕，並確認按鈕進入建立流程。
- [ ] T020 [P] [US2] 先在 `tests/integration/trips/tripList.test.tsx` 撰寫旅程列表測試，驗證所有旅程欄位、出發日期升冪排序、同日往返為 1 天，以及出發日/回程日含首尾的狀態分類。

### Implementation for User Story 2

- [ ] T021 [US2] 在 `src/features/trips/EmptyTrips.tsx` 建立繁體中文空狀態與「建立第一趟旅程」入口，使用既有 Tailwind theme tokens 與 lucide-react 圖示。
- [ ] T022 [US2] 在 `src/features/trips/TripHomePage.tsx` 串接空狀態，並在 `src/features/trips/TripList.tsx` 實作依出發日期排序及「即將出發」、「旅途中」、「已結束」分組，呈現目的地、日期與天數。

**Checkpoint**: 首頁能完整呈現空狀態及所有旅程，分類邊界與排序皆可獨立驗收。

---

## Phase 5: User Story 3 - 編輯、刪除及複製旅程 (Priority: P3)

**Goal**: 使用者能檢視並編輯旅程、確認後刪除，或複製舊旅程並獨立修改。

**Independent Test**: 修改旅程基本資訊並確認列表更新；取消刪除後原資料不變、確認刪除後旅程移除；複製後修改新旅程且來源保持不變。

### Tests for User Story 3

- [ ] T023 [P] [US3] 先在 `tests/integration/trips/tripEditDelete.test.tsx` 撰寫編輯與刪除測試，驗證儲存編輯後衍生資訊更新、取消刪除不寫入、確認刪除後列表移除。
- [ ] T024 [P] [US3] 先在 `tests/integration/trips/tripCopy.test.tsx` 撰寫複製測試，驗證複製資料先可編輯、儲存後使用新 ID，且變更或刪除副本不影響來源。

### Implementation for User Story 3

- [ ] T025 [US3] 在 `src/features/trips/TripDetailsPage.tsx` 實作旅程檢視及編輯入口，重用 `src/features/trips/TripForm.tsx` 與 `src/features/trips/saveTrip.ts` 保存流程，保留既有 ID/建立時間並更新修改時間，儲存後更新列表衍生資訊。
- [ ] T026 [US3] 在 `src/features/trips/DeleteTripDialog.tsx` 實作繁體中文二次確認與取消流程；取消不得呼叫刪除，確認才呼叫 `src/data/tripRepository.ts` 並更新首頁。
- [ ] T027 [US3] 在 `src/features/trips/CopyTripButton.tsx` 實作複製旅程入口，將來源欄位及陣列複製為獨立可編輯草稿，儲存時產生新 ID，並接入 `src/features/trips/TripDetailsPage.tsx`。

**Checkpoint**: 編輯、刪除確認及複製均不會意外改動其他旅程，三個故事的驗收測試皆通過。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 驗證跨故事品質、設計指南一致性及部署/離線 app shell。

- [ ] T028 [P] 檢查 `src/features/trips/TripHomePage.tsx`、`src/features/trips/TripForm.tsx`、`src/features/trips/TripDetailsPage.tsx` 與 `src/styles/tailwind.css` 符合 `docs/design-guide.md` 及憲章 VI：全站一致使用主題 tokens、四種指定字體與 lucide-react，且符合對比、手機字級及點擊尺寸要求。
- [ ] T029 執行 `specs/001-trip-management/quickstart.md` 的完整驗證，修正 `package.json`、`vite.config.ts`、`src/` 或 `tests/` 中發現的問題；確認測試、production build、瀏覽器重開持久性、GitHub Pages base path 與安裝後離線 app shell。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; initialize the frontend project first.
- **Foundational (Phase 2)**: Depends on Setup; blocks all user stories.
- **User Story 1 (Phase 3)**: Depends on Foundational; delivers the P1 MVP.
- **User Story 2 (Phase 4)**: Depends on the home/list shell from User Story 1.
- **User Story 3 (Phase 5)**: Depends on the form and repository from User Story 1.
- **Polish (Phase 6)**: Depends on all three desired user stories.

### User Story Dependencies

- **US1 (P1)**: Starts after Phase 2; no dependency on another story.
- **US2 (P2)**: Starts after US1 provides a saved-trip list shell; its behavior is testable with seeded repository data.
- **US3 (P3)**: Starts after US1 provides the reusable form and repository; independent of US2 after US1 is complete.
- US2 and US3 can be implemented in parallel after US1 if work stays in their separate list and detail/action files.

### Parallel Opportunities

- **Setup**: T003, T004, and T005 can run in parallel after T002 because they change test config, theme CSS, and deployment workflow files separately.
- **Foundational**: T006, T007, and T008 can run in parallel; after T008/T009, T010, T011, and T012 can proceed in parallel in separate files. T013 follows the repository tests.
- **US1**: T014 and T015 are independent test files and can be authored in parallel; both precede T016-T018.
- **US2**: T019 and T020 can be authored in parallel before T021-T022.
- **US3**: T023 and T024 can be authored in parallel before T025-T027.
- **Across stories**: US2 and US3 can proceed concurrently after US1 is complete, subject to separate-file ownership.

## Parallel Examples

### User Story 1

```text
Task: T014 required-field and validation tests in tests/integration/trips/createTripValidation.test.tsx
Task: T015 successful creation and persistence tests in tests/integration/trips/createTrip.test.tsx
```

### User Story 2

```text
Task: T019 empty-state tests in tests/integration/trips/tripEmptyState.test.tsx
Task: T020 list ordering and status tests in tests/integration/trips/tripList.test.tsx
```

### User Story 3

```text
Task: T023 edit and delete tests in tests/integration/trips/tripEditDelete.test.tsx
Task: T024 copy independence tests in tests/integration/trips/tripCopy.test.tsx
```

## Implementation Strategy

### MVP First

1. Complete Phase 1 Setup and Phase 2 Foundational work.
2. Complete Phase 3 User Story 1 only.
3. Validate create, required fields, persisted data, and list summary independently.
4. Stop at the P1 checkpoint for an MVP; do not add maps, daily itinerary, transport, mobile export, expenses, or collaboration.

### Incremental Delivery

1. Add US2 for empty state, ordered list, and date status categories.
2. Add US3 for edit, confirmed deletion, and independent copies.
3. Run the related story tests after each story, then complete Phase 6 quickstart and deployment checks.

## Notes

- All task lines follow `- [ ] T### [P?] [Story?] Description with exact file path`.
- Test tasks are mandatory because spec FR-015 and the constitution require automated tests for user-visible behavior.
- No contracts tasks are needed: this feature has no backend API or external service contract.
- Future JSON import/export, itinerary, maps, transport, and expenses are explicitly out of scope for feature 001.