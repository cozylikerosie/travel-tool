---
description: "Implementation tasks for desktop daily itinerary, transport modes and map"
---

# Tasks: 每日行程、交通方式與地圖（電腦端）

**Input**: Design documents from `/specs/002-daily-itinerary-map/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/google-maps-urls.md`, `contracts/location-input.md`, `quickstart.md`

**Tests**: Required by FR-021 and constitution principle IV. Write story tests before their implementations and verify the tests fail for the missing behavior.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because the task changes independent files and has no unfinished dependency.
- **[Story]**: User story label from `spec.md`; setup, foundational, and polish tasks have no story label.
- Every task names the exact file or files to create or update.

## Phase 1: Setup

**Purpose**: Add the map dependencies and the test doubles every story relies on.

- [X] T001 在 `package.json` 新增相依套件 `leaflet@^1.9.4`、`react-leaflet@^5.0.0`，以及 devDependency `@types/leaflet`，執行 `npm install` 更新 `package-lock.json`。
- [X] T002 [P] 在 `tests/setup.ts` 補上 jsdom 缺少的瀏覽器 API 替身：`Element.prototype.scrollIntoView`（`vi.fn()`）與 `window.matchMedia`（預設回傳 `matches: false`、可在個別測試覆寫），讓清單捲動與深色模式偵測可在測試中執行。
- [X] T003 [P] 新增 `tests/mocks/reactLeaflet.tsx`，作為 `vi.mock("react-leaflet", ...)` 使用的輕量替身：`MapContainer` 渲染 `<div data-testid="map">`；`TileLayer` 渲染 `<div data-testid="tile-layer" data-url=... data-attribution=...>` 並透過 `eventHandlers.tileerror` 讓測試可觸發圖磚錯誤；`Marker` 渲染 `<button data-testid="map-marker" data-place-id data-order data-selected>` 並在點擊時呼叫 `eventHandlers.click`；`Polyline` 渲染 `<div data-testid="map-line" data-from data-to data-mode>`（未設定時 `data-mode="unset"`）；`useMap` 回傳含 `fitBounds`、`setView`、`panTo`、`getBounds().contains` 的 `vi.fn()` 物件，供測試斷言視窗移動。
- [X] T004 [P] 確認 `vite.config.ts` 的 `workbox` 設定沒有為 `basemaps.cartocdn.com` 加入 `runtimeCaching`，且 `globPatterns` 不會預快取任何圖磚或 `leaflet/dist/images/*`；地圖離線不在範圍內（research「PWA 注意事項」），只需確認、不新增設定。

---

## Phase 2: Foundational

**Purpose**: Trip-day dates, itinerary schemas, transport-mode constants, ordering rules, and the version 2 database that all stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Tests for Foundational

- [X] T005 [P] 先在 `tests/unit/tripDays.test.ts` 撰寫測試：`addDaysToDateOnly("2026-12-31", 1)` 為 `2027-01-01`、閏年 `2028-02-28` 加 1 天為 `2028-02-29`；`getWeekdayShort` 對 `2026-12-10` 回傳 `THU`、`2026-12-18` 回傳 `FRI`；`listTripDays("2026-12-10", "2026-12-18")` 回傳 9 筆，第一筆 `{ dayNumber: 1, date: "2026-12-10", label: "Day 1・12.10 THU" }`、最後一筆 `label` 為 `Day 9・12.18 FRI`；出發日等於回程日時回傳 1 筆；以不同 `TZ` 執行結果不變（不經 `new Date(string)`）。
- [X] T006 [P] 先在 `tests/unit/itinerarySchema.test.ts` 撰寫 Zod schema 測試，逐條覆蓋 `data-model.md` 規則：`name` trim 後為空且 `coordinates` 為 `null` 時拒絕並回傳「請輸入地點名稱或貼上座標」；`arrivalTime` 必須符合 `/^([01]\d|2[0-3]):[0-5]\d$/`，缺漏時回傳「請輸入抵達時間」；`coordinates` 的 lat ∈ [−90, 90]、lng ∈ [−180, 180]，超過 6 位小數時四捨五入至 6 位；`stay` 只接受 `{ kind: "none" }`、`{ kind: "duration", minutes: 1–1439 整數 }`、`{ kind: "departure", time: HH:mm }`，departure 早於 `arrivalTime` 時回傳「離開時間不可早於抵達時間」；`address` 預設空字串並 trim、`notes` 預設空字串且保留空白；`TransportSegment.mode` 只接受 `rail`、`bus`、`ferry`、`taxi`、`walk`、`drive`、`flight`、`other`，`id` 必須等於 `${fromPlaceId}->${toPlaceId}`。另測試 `deriveDepartureTime("09:00", 90)` 為 `{ time: "10:30", nextDay: false }`、`deriveDepartureTime("23:00", 120)` 為 `{ time: "01:00", nextDay: true }`，以及 `deriveStayMinutes("09:00", "10:30")` 為 90。
- [X] T007 [P] 先在 `tests/unit/itineraryOrdering.test.ts` 撰寫測試：`sortPlaces` 依 `arrivalTime` 字串遞增、相同時間依 `dayOrder` 遞增（spec US1-7：09:00 後樂園、11:30 岡山城、14:00 倉敷）；`listAdjacentPairs` 對 0 或 1 個地點回傳空陣列、3 個地點回傳 2 組；`findStaleSegmentIds(sortedPlaces, segments)` 保留起訖仍相鄰的紀錄、回傳不再相鄰（含端點已不在當天）的紀錄 ID，且 A→B 在 B、A 順序互換後視為失效；`nextDayOrder(places)` 回傳當天最大 `dayOrder` + 1、空白日回傳 1。
- [X] T008 [P] 先在 `tests/integration/data/databaseUpgrade.test.ts` 撰寫升級測試：使用 fake-indexeddb 的同一個 `IDBFactory`，以只宣告 `version(1).stores({ trips: "id,startDate,endDate" })` 的 Dexie 建立同名資料庫並寫入一趟旅程後關閉；再以 `createTripDatabase(name, factory)`（version 2）開啟，斷言旅程欄位完全相同、`places` 與 `transportSegments` 為空且可寫入、可用 `[tripId+dayNumber]` 索引查詢。
- [X] T009 [P] 先在 `tests/integration/trips/tripRepository.test.ts` 新增測試：刪除旅程時，同一交易內一併刪除該旅程所有 `places` 與 `transportSegments`，另一趟旅程的資料不受影響；模擬交易中途失敗時旅程與每日行程皆保持原狀。

### Implementation for Foundational

- [X] T010 [P] 在 `src/shared/dates/tripDates.ts` 新增 `addDaysToDateOnly(date, days)`、`getWeekdayShort(date)`（`SUN`…`SAT`）與 `listTripDays(startDate, endDate)`，回傳 `TripDay { dayNumber, date, label }`，`label` 格式為 `Day N・MM.DD WWW`；沿用檔案內既有的純日期解析，不將 `YYYY-MM-DD` 交給 `new Date(string)`。
- [X] T011 [P] 在 `src/features/itinerary/transportModes.ts` 定義單一來源 `TRANSPORT_MODES`（`as const` 陣列）與 `TransportModeCode` 型別，每項含 `code`、`label`（JR／電車、巴士、渡輪、計程車、步行、自駕、飛機、其他）、`travelmode`（`rail`/`bus`/`ferry` → `transit`，`walk` → `walking`，`taxi`/`drive` → `driving`，`flight`/`other` → `null`）與 `lineStyle { color: "ink" | "accent" | "muted" | "rule", weight, dashArray, lineCap }`，數值依 research「路線線條樣式」表；另匯出 `UNSET_TRANSPORT`（label「未設定」、travelmode `null`、`color: "rule"`、細點線 `2 6`、1.5px）與 `getTransportMode(code | null)`。
- [X] T012 在 `src/features/itinerary/itinerarySchema.ts` 實作 `coordinatesSchema`、`staySchema`（判別聯集）、`placeSchema`、`placeFormSchema`（接受表單原始值，`arrivalTime` 空字串時回傳「請輸入抵達時間」）、`transportSegmentSchema`（`mode` 使用 `TRANSPORT_MODES` 的代碼列舉），以 `z.infer` 匯出 `Place`、`PlaceFormInput`、`TransportSegment`、`Stay`、`Coordinates` 型別；並實作 `deriveDepartureTime(arrivalTime, minutes)` 與 `deriveStayMinutes(arrivalTime, departureTime)`。所有欄位規則與錯誤訊息逐字依 T006。依賴 T011。
- [X] T013 在 `src/features/itinerary/itineraryOrdering.ts` 實作 `sortPlaces`、`listAdjacentPairs`、`findStaleSegmentIds`、`nextDayOrder` 純函式，行為依 T007。依賴 T012（型別）。
- [X] T014 在 `src/data/database.ts` 保留既有 `version(1).stores({ trips: "id,startDate,endDate" })` 宣告不動，新增 `version(2).stores({ trips: "id,startDate,endDate", places: "id, tripId, [tripId+dayNumber]", transportSegments: "id, tripId, [tripId+dayNumber]" })`（不需 `upgrade()`），並在 `TripDatabase` 宣告 `places!: Table<Place, string>` 與 `transportSegments!: Table<TransportSegment, string>`。依賴 T012。
- [X] T015 在 `src/data/tripRepository.ts` 修改 `delete(id)`：以 `database.transaction("rw", [database.trips, database.places, database.transportSegments], ...)` 在同一交易內刪除旅程，並以 `where("tripId").equals(id).delete()` 刪除其地點與交通段。依賴 T014。

**Checkpoint**: `npx vitest run tests/unit/tripDays.test.ts tests/unit/itinerarySchema.test.ts tests/unit/itineraryOrdering.test.ts tests/integration/data tests/integration/trips/tripRepository.test.ts` 全部通過。

---

## Phase 3: User Story 1 - 安排每天的地點與時間 (Priority: P1) 🎯 MVP

**Goal**: 使用者進入旅程的每日行程，看到 Day 1…N，可用貼上座標、貼上電腦版 Google 地圖網址或手動輸入新增地點，地點依抵達時間排成時間軸並保存在本機。

**Independent Test**: 在 9 天旅程的 Day 1 以三種方式各新增一個地點，確認時間軸依抵達時間排列；重新開啟資料庫後資料仍在。

### Tests for User Story 1

- [X] T016 [P] [US1] 先在 `tests/unit/locationInput.test.ts` 撰寫 `parseLocationInput` 測試，逐一涵蓋 `contracts/location-input.md` 測試案例 #1–#14：純座標含／不含空白與負緯度、`91, 10` 為 `out-of-range`、`@` 座標、`!3d!4d` 優先於 `@`、`/place/<名稱>/` 的 URL decode 與 `+` 轉空白、`google.com.tw`／`google.co.jp`、`query=` 參數、`maps.app.goo.gl` 與 `goo.gl/maps` 為 `short-url`、無座標的 place 網址與非 Google 網址為 `unrecognized`、空白輸入為 `empty`；名稱本身為座標格式時不回傳 `name`。
- [X] T017 [P] [US1] 先在 `tests/integration/data/itineraryRepository.test.ts` 建立 `describe("US1 地點新增與讀取")`：使用 fake-indexeddb 建立 `createTripDatabase` 與 `createItineraryRepository`；`addPlace` 指派 `dayOrder` 為當天最大值 + 1、以 `crypto.randomUUID()` 產生 `id` 並設定 `createdAt`/`updatedAt`；schema 驗證失敗時不寫入並回傳錯誤；`listPlacesForDay(tripId, dayNumber)` 依 `sortPlaces` 回傳；新增地點使既有交通段不再相鄰時，同一交易內刪除該紀錄；關閉並以同名資料庫重新開啟後地點仍存在（SC-007）。
- [X] T018 [P] [US1] 先在 `tests/integration/itinerary/dayItinerary.test.tsx` 撰寫介面驗收測試（以 `tests/mocks/reactLeaflet.tsx` mock `react-leaflet`），對應 spec US1 情境 1–8：12.10–12.18 旅程列出 Day 1・12.10 THU 至 Day 9・12.18 FRI 並可切換；貼上 `34.6672, 133.9354` 加名稱與 09:00 儲存後出現在時間軸；貼上含 `/place/岡山城/` 與 `!3d!4d` 的網址自動帶入名稱與座標且名稱可修改；貼上 `https://maps.app.goo.gl/xxxx` 顯示 `contracts/location-input.md` 的短網址提示且儲存不帶座標；手動模式只填名稱與時間可儲存；未填抵達時間顯示「請輸入抵達時間」且未寫入；09:00／14:00 後新增 11:30 時順序正確；空白日顯示引導文字與「新增地點」按鈕；填停留 90 分鐘時顯示推算的離開時間。另測試從旅程詳情頁按「每日行程」可進入此畫面並返回。

### Implementation for User Story 1

- [X] T019 [P] [US1] 在 `src/shared/geo/locationInput.ts` 實作 `parseLocationInput(text): LocationParseResult`，回傳型別、主機判斷、座標取用優先順序（`!3d!4d` → `@lat,lng,zoomz` → `q`/`query`/`ll`/`destination` 參數）、名稱解析與短網址判斷皆逐字依 `contracts/location-input.md`；不發出任何網路請求；另匯出 `LOCATION_PARSE_MESSAGES`，內容為合約「介面提示」表中三段繁體中文提示（`empty` 不顯示）。
- [X] T020 [US1] 在 `src/data/itineraryRepository.ts` 建立 `createItineraryRepository(database)` 與預設實例 `itineraryRepository`，本階段實作 `listPlacesForDay(tripId, dayNumber)`、`listPlacesForTrip(tripId)`、`listSegmentsForDay(tripId, dayNumber)` 與 `addPlace(tripId, dayNumber, input, options?: { createId, now })`：在 `rw` 交易內讀取當天地點、以 `nextDayOrder` 指派順序、以 `placeSchema.safeParse` 驗證（失敗不得寫入）、寫入後以 `findStaleSegmentIds` 刪除失效交通段。依賴 T013、T014。
- [X] T021 [P] [US1] 在 `src/features/itinerary/DayTabs.tsx` 實作天數切換列：以 `listTripDays` 產生按鈕，標籤為「Day N」加 Cormorant Garamond／Inter 的「MM.DD WWW」雜誌式日期，選取中的天以 2px 墨黑底線標示，使用 `role="tablist"`／`role="tab"` 與 `aria-selected`。
- [X] T022 [P] [US1] 在 `src/features/itinerary/PlaceForm.tsx` 實作新增地點表單：「貼上座標或網址」與「手動輸入」兩種模式；貼上欄位變更時呼叫 `parseLocationInput`，成功時帶入座標並在名稱為空時帶入解析出的名稱，失敗時以 `LOCATION_PARSE_MESSAGES` 顯示提示且不保留座標；欄位為名稱、地址、抵達時間（`<input type="time">`，必填）、停留時間／離開時間單選擇一（停留時間以「小時」與「分鐘」兩個數字欄位輸入，換算為 `minutes = 小時 × 60 + 分鐘`，須為 1–1439 的整數；以 `deriveDepartureTime`／`deriveStayMinutes` 顯示推算值，跨午夜顯示「隔天」）、備註；以 `placeFormSchema` 驗證並在欄位旁顯示繁體中文錯誤；送出時呼叫傳入的 `onSubmit(input)`。
- [X] T023 [P] [US1] 在 `src/features/itinerary/PlaceTimeline.tsx` 實作時間軸：依傳入的已排序地點顯示順序編號、抵達時間、名稱、地址、停留／離開時間與備註，沒有座標的地點附「未標於地圖」的次要文字；當天沒有地點時顯示引導文字與「新增地點」按鈕；預留 `renderSegment(from, to)` 插槽於相鄰地點之間（US2 使用）。
- [X] T024 [US1] 在 `src/features/itinerary/DayItineraryPage.tsx` 實作每日行程頁：接收 `trip`、`repository`（預設 `itineraryRepository`）與 `onBack`；以 `selectedDayNumber` 狀態搭配 `DayTabs`；載入並在每次寫入後重新讀取當天地點；版面在小於 1024px 時為單欄：時間軸在上，地圖區塊在下，高度固定 `h-[420px]`。≥ 1024px 時以 `lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]` 分成雙欄：左欄 `PlaceTimeline` 與「新增地點」按鈕（開啟 `PlaceForm`），右欄地圖區塊容器（US3 填入 `DayMap`）以 `lg:sticky lg:top-0 lg:h-screen` 固定在視窗內，捲動時間軸時地圖不會跟著捲走。依賴 T020–T023。
- [X] T025 [US1] 在 `src/features/trips/TripDetailsPage.tsx` 加入「每日行程」按鈕（lucide `CalendarDays` 圖示）並新增 `onOpenItinerary` prop；在 `src/app/App.tsx` 新增 `itineraryTripId` 導覽狀態，選取時渲染 `DayItineraryPage`、返回時回到旅程詳情。依賴 T024。

**Checkpoint**: T016–T018 全部通過；使用者可建立並查看每天的地點，MVP 可獨立展示。

---

## Phase 4: User Story 2 - 設定交通方式並以 Google 地圖查詢 (Priority: P2)

**Goal**: 相鄰地點之間顯示移動段落，可選擇交通方式並保存，並以 Google Maps URLs 在新分頁查詢路線；順序改變時相鄰關係改變的段落重設為「未設定」。

**Independent Test**: 三個地點的一天設定兩段交通方式（JR／電車、步行），確認保存與顯示；確認每段連結的起點、終點與 travelmode。

### Tests for User Story 2

- [X] T026 [P] [US2] 先在 `tests/unit/googleMapsUrls.test.ts` 撰寫 `buildGoogleMapsDirectionsUrl` 測試，逐一涵蓋 `contracts/google-maps-urls.md` 測試案例 #1–#7，並斷言參數順序固定為 `api`、`origin`、`destination`、`travelmode`，以及座標以 `緯度,經度` 不含空白輸出。
- [X] T027 [P] [US2] 先在 `tests/integration/data/itineraryRepository.test.ts` 新增 `describe("US2 交通段")`：`setTransportMode(from, to, mode)` 以 `${fromPlaceId}->${toPlaceId}` 為 ID `put` 紀錄且驗證兩端為當天排序後相鄰地點（否則拒絕）；`mode` 為 `null`（未設定）時刪除紀錄；`updatePlace` 修改抵達時間使順序改變時，同一交易內刪除不再相鄰的紀錄、保留起訖未變的紀錄；之後即使恢復原順序，被刪除的設定也不會復活。
- [X] T028 [P] [US2] 先在 `tests/integration/itinerary/transportSegments.test.tsx` 撰寫介面驗收測試，對應 spec US2 情境 1–8：三個地點顯示兩段且未設定時顯示「未設定」；只有一個地點時不顯示段落；選擇八種交通方式之一後重新渲染仍保留；連結 `href` 的 travelmode 依交通方式為 `transit`／`walking`／`driving` 或省略，具 `target="_blank"` 與 `rel="noopener noreferrer"`，無障礙名稱為「在 Google 地圖開啟：起點 → 終點」；無座標的一端以「名稱, 地址」查詢；既無座標也無名稱時不顯示連結；以 repository `updatePlace` 改抵達時間後重新載入，相鄰關係改變的段落顯示「未設定」、其他保留。

### Implementation for User Story 2

- [X] T029 [P] [US2] 在 `src/shared/geo/googleMapsUrls.ts` 實作 `buildGoogleMapsDirectionsUrl(origin: PlaceEndpoint, destination: PlaceEndpoint, mode: TransportModeCode | null): string | null`，`PlaceEndpoint` 為 `{ name, address, coordinates }`；端點取值、travelmode 對應與 `URLSearchParams` 編碼逐字依 `contracts/google-maps-urls.md`，travelmode 由 `getTransportMode` 取得。
- [X] T030 [US2] 在 `src/data/itineraryRepository.ts` 新增 `setTransportMode(tripId, dayNumber, fromPlaceId, toPlaceId, mode | null)` 與 `updatePlace(placeId, input, options?: { now })`：皆在 `rw` 交易內執行；`setTransportMode` 先以 `sortPlaces`／`listAdjacentPairs` 確認相鄰、以 `transportSegmentSchema` 驗證後 `put`，`null` 時 `delete`；`updatePlace` 保留 `id`、`tripId`、`dayNumber`、`dayOrder`、`createdAt`，更新 `updatedAt`，以 `placeSchema` 驗證後寫入並以 `findStaleSegmentIds` 清理失效交通段。依賴 T020。
- [X] T031 [P] [US2] 在 `src/features/itinerary/TransportSegmentRow.tsx` 實作移動段落列：顯示目前交通方式（無紀錄時「未設定」），以 `<select>` 列出 `TRANSPORT_MODES` 與「未設定」，變更時呼叫 `onChange(mode | null)`；以 `buildGoogleMapsDirectionsUrl` 產生連結，回傳 `null` 時不顯示；連結文字「在 Google 地圖開啟」附 lucide `ExternalLink`（1.5px stroke），`aria-label` 為「在 Google 地圖開啟：{起點名稱} → {終點名稱}」。依賴 T029。
- [X] T032 [US2] 在 `src/features/itinerary/DayItineraryPage.tsx` 載入當天交通段（`listSegmentsForDay`），透過 `PlaceTimeline` 的 `renderSegment` 在相鄰地點之間渲染 `TransportSegmentRow`，以 `${from.id}->${to.id}` 查詢模式，變更時呼叫 `setTransportMode` 後重新讀取。依賴 T030、T031。

**Checkpoint**: T026–T028 全部通過；US1 測試仍通過。

---

## Phase 5: User Story 3 - 在地圖上總覽當天路線 (Priority: P3)

**Goal**: 右欄地圖以墨黑編號標記顯示有座標的地點，依交通方式以不同樣式直線連接，並提供圖例；地圖與清單雙向選取對應；空白日依旅程地點或亞洲預設範圍顯示。

**Independent Test**: 三個有座標地點加一個手動地點的一天，確認標記編號、線條樣式、圖例與雙向強調；切換到空白日確認地圖範圍。

### Tests for User Story 3

- [X] T033 [P] [US3] 先在 `tests/unit/mapModel.test.ts` 撰寫地圖模型測試：`buildMapMarkers(sortedPlaces, selectedPlaceId)` 只包含有座標的地點，`order` 使用時間軸編號（含手動地點，例如手動地點在第 2 位時標記為 1、3），選取中的標記 `isSelected` 為 true；`buildMapLines(sortedPlaces, segments)` 只為兩端都有座標的相鄰地點產生線段（A 有座標、B 手動、C 有座標時不產生任何線段，也不產生 A→C），每段帶 `mode`（無紀錄為 `null`）、`getTransportMode(mode).lineStyle` 與 `className`。`className` 為 `map-line map-line--{color}`，`{color}` 取自 `lineStyle.color`，例如步行為 `map-line--ink`、未設定為 `map-line--rule`；地圖模型不得輸出任何色碼字串。`getMapViewport(dayPlaces, tripPlaces)` 當天有 ≥ 2 個座標時回傳當天邊界、只有 1 個時回傳 `{ center, zoom: 14 }`、當天無座標時回傳整趟旅程座標邊界、全部無座標時回傳亞洲預設 `[[-11, 92], [46, 146]]`。另測試 `resolveTileTheme(dataTheme, prefersDark)`：`"light"` 時回傳 `light`，`"dark"` 時回傳 `dark`，`null` 時依 `prefersDark` 決定。
- [X] T034 [P] [US3] 先在 `tests/integration/itinerary/dayMap.test.tsx` 撰寫介面驗收測試（mock `react-leaflet`），對應 spec US3 情境 1–7：三個有座標地點顯示 `data-order` 1、2、3 的標記與兩條線；兩段不同交通方式的線 `data-mode` 不同，圖例列出九種樣式的中文名稱；手動地點不出現標記且編號仍與時間軸一致；點 2 號標記時清單對應項目具 `aria-current="true"` 且呼叫 `scrollIntoView({ block: "nearest" })`；點清單項目時對應標記 `data-selected="true"` 且呼叫 `panTo`（標記不在可見範圍內時）；點手動地點只強調清單；以 repository 改抵達時間後標記編號與線段順序更新；當天無座標時 `fitBounds` 以整趟旅程範圍呼叫、全旅程無座標時以亞洲預設範圍呼叫；觸發 `tileerror` 後顯示「地圖暫時無法載入」且時間軸與連結仍可操作；`TileLayer` 的 attribution 含「© OpenStreetMap contributors © CARTO」；系統偏好深色、且沒有 `data-theme` 時，URL 使用 `dark_all`；`<html data-theme="light">` 時即使系統偏好深色也使用 `light_all`；頁面容器具 `grid-cols-1` 與 `lg:grid-cols-[...]` class，且 DOM 順序為時間軸在前、地圖在後（確保單欄時時間軸在上）。

### Implementation for User Story 3

- [X] T035 [P] [US3] 在 `src/features/itinerary/mapModel.ts` 實作 `buildMapMarkers`、`buildMapLines`、`getMapViewport`（亞洲預設常數 `ASIA_DEFAULT_BOUNDS = [[-11, 92], [46, 146]]`，單點縮放 14）、`lineClassName(color)` 與 `resolveTileTheme`，行為依 T033；不得 import `leaflet`，維持純函式。
- [X] T036 [P] [US3] 在 `src/features/itinerary/markerIcon.ts` 實作 `createNumberedMarkerIcon(order: number, isSelected: boolean)`，以 `L.divIcon` 產生標記，`className` 為 `map-marker`，選取時加上 `map-marker--selected`；`html` 只插入由程式產生的數字（不插入使用者輸入）。在 `src/styles/tailwind.css` 新增 `.map-marker`（底色 `var(--color-ink)`、數字 `var(--color-paper)`、Cormorant Garamond）、`.map-marker--selected`（底色 `var(--color-accent)` 並放大），以及 `.map-line--ink`、`.map-line--accent`、`.map-line--muted`、`.map-line--rule`，分別設 `stroke: var(--color-ink)`、`var(--color-accent)`、`var(--color-muted)`、`var(--color-rule)`。不得寫死任何色碼；不使用 `L.Icon.Default`、不 import `leaflet/dist/images/*`。
- [X] T037 [P] [US3] 在 `src/features/itinerary/MapLegend.tsx` 實作圖例：讀取 `TRANSPORT_MODES` 與 `UNSET_TRANSPORT`，以 inline SVG `<line>` 套用與地圖相同的 `map-line--{color}` class 及 `lineStyle` 畫出樣本線並標示中文名稱，1px 細線分隔、小字 Inter／Noto Sans TC。
- [X] T038 [US3] 在 `src/features/itinerary/DayMap.tsx` 實作地圖元件：匯入 `leaflet/dist/leaflet.css`；`MapContainer` 內 `TileLayer` 使用 CARTO `light_all`（深色模式 `dark_all`；以 `resolveTileTheme(document.documentElement.dataset.theme ?? null, matchMedia("(prefers-color-scheme: dark)").matches)` 決定，並以 `matchMedia` 的 `change` 事件與 `MutationObserver`（監聽 `<html>` 的 `data-theme`）在主題切換時更新）與 attribution「© OpenStreetMap contributors © CARTO」並連結兩者版權頁；以 `buildMapMarkers` 渲染 `Marker`（icon 一律來自 `createNumberedMarkerIcon`，點擊呼叫 `onSelectPlace`）、以 `buildMapLines` 渲染 `Polyline`（`pathOptions` 只設定 `weight`、`dashArray`、`lineCap` 與 `className`（來自 `buildMapLines`），不設定 `color`）；子元件以 `useMap` 在 viewport 改變時 `fitBounds`／`setView`，在 `selectedPlaceId` 改變且標記不在 `getBounds()` 內時 `panTo`；`tileerror` 時於地圖上方顯示「地圖暫時無法載入」提示；右下角疊放 `MapLegend`。依賴 T035–T037。
- [X] T039 [US3] 在 `src/features/itinerary/DayItineraryPage.tsx` 新增 `selectedPlaceId` 狀態並載入 `listPlacesForTrip` 作為 viewport 依據，右欄渲染 `DayMap`；在 `src/features/itinerary/PlaceTimeline.tsx` 新增 `selectedPlaceId` 與 `onSelectPlace` props，點選項目時呼叫 `onSelectPlace`，選取中項目以點綴色左邊線強調並設 `aria-current="true"`，`selectedPlaceId` 由地圖改變時對該項目呼叫 `scrollIntoView({ block: "nearest" })`；切換天時清除選取。依賴 T038。

**Checkpoint**: T033–T034 全部通過；US1、US2 測試仍通過。

---

## Phase 6: User Story 4 - 編輯、刪除與移動地點 (Priority: P4)

**Goal**: 使用者可編輯地點所有欄位、經確認刪除、移到另一天；旅程日期縮短而移除有地點的天時先警告，讓使用者選擇刪除、移到保留的某天或取消。

**Independent Test**: 修改地點座標與時間、刪除（含取消）、移到 Day 3；將回程日期提前並分別測試「刪除」「移到 Day X」「取消」；整體平移日期不警告。

### Tests for User Story 4

- [X] T040 [P] [US4] 先在 `tests/integration/data/itineraryRepository.test.ts` 新增 `describe("US4 編輯、刪除、移動與日期變更")`：`updatePlace` 可新增、修正與移除座標（設為 `null`）；`deletePlace` 在同一交易內刪除地點與以它為端點的交通段，前後地點之間不產生任何紀錄；`movePlace(placeId, targetDayNumber)` 更新 `dayNumber`、重新指定 `dayOrder` 為目標天最大值 + 1，來源天與目標天都以 `findStaleSegmentIds` 清理；`countPlacesBeyondDay(tripId, dayCount)` 回傳 `{ dayNumbers, placeCount }`；`updateTripWithRemovedDays(trip, resolution)` 在單一交易中寫入旅程並依 `{ action: "delete" }` 刪除 `dayNumber > 新天數` 的地點與交通段，或依 `{ action: "move", targetDayNumber }` 把它們依原排序移入目標天（每個都視為最後加入）並清理目標天；交易中任一步失敗時旅程與地點皆不變。
- [X] T041 [P] [US4] 先在 `tests/integration/itinerary/placeEditMove.test.tsx` 撰寫介面驗收測試，對應 spec US4 情境 1–4：編輯表單預先帶入名稱、地址、座標、抵達時間、停留或離開時間與備註，儲存後時間軸與地圖替身反映修改；手動地點補上座標後出現標記；刪除時顯示確認對話框，取消時地點保留、確認後移除且前後兩地點間的新段落顯示「未設定」；移到 Day 3 後從 Day 1 消失、在 Day 3 依抵達時間排序出現，兩天中相鄰關係改變的段落顯示「未設定」、其他保留；離開時間早於抵達時間時阻止儲存並顯示「離開時間不可早於抵達時間」。
- [X] T042 [P] [US4] 先在 `tests/integration/itinerary/tripDateChange.test.tsx` 撰寫旅程編輯驗收測試，對應 spec US4 情境 5–6 與 SC-006：Day 8、Day 9 有地點時將回程提前到 Day 7 並儲存，顯示警告列出「Day 8、Day 9」與地點數量，在選擇前資料庫中旅程與地點都未改變；選「取消」時旅程日期不變，畫面留在編輯表單且保留使用者剛輸入的值；選「移到 Day 2」後旅程更新且地點出現在 Day 2；選「刪除這些地點」後地點與交通段被刪除；旅程整體平移 12.10–12.18 → 12.11–12.19 時不顯示警告且地點仍在原 Day N、標籤日期改為新日期；縮短但被移除的天沒有地點時直接保存不警告；旅程延長為 12.10–12.20 時不警告，既有地點不變，新增的 Day 10、Day 11 為空白日。另在 `tests/integration/trips/tripCopy.test.tsx` 新增斷言：複製一趟已有地點與交通段的旅程後，新旅程的 `listPlacesForTrip` 為空（data-model「複製旅程不複製」）。

### Implementation for User Story 4

- [X] T043 [US4] 在 `src/data/itineraryRepository.ts` 新增 `deletePlace(placeId)`、`movePlace(placeId, targetDayNumber, options?: { now })`、`countPlacesBeyondDay(tripId, dayCount)` 與 `updateTripWithRemovedDays(trip, resolution: { action: "delete" } | { action: "move"; targetDayNumber: number })`；所有寫入以 `database.transaction("rw", [database.trips, database.places, database.transportSegments], ...)` 執行，交通段清理一律使用 `findStaleSegmentIds`；`updateTripWithRemovedDays` 以 `tripSchema.safeParse` 驗證旅程，`targetDayNumber` 必須在 1…新天數之間，否則拋出錯誤且不寫入。依賴 T030。
- [X] T044 [P] [US4] 在 `src/features/itinerary/PlaceForm.tsx` 新增編輯模式：接受 `initialPlace`，預先帶入所有欄位與現有座標（顯示為「緯度, 經度」），提供「移除座標」按鈕將地點改為手動地點；標題與送出按鈕文字依模式顯示「新增地點」／「儲存變更」。
- [X] T045 [P] [US4] 在 `src/features/itinerary/DeletePlaceDialog.tsx` 實作刪除確認對話框（沿用 `src/features/trips/DeleteTripDialog.tsx` 的版面與焦點處理），顯示地點名稱與「刪除後無法復原」說明，按鈕為「取消」與「刪除地點」。
- [X] T046 [P] [US4] 在 `src/features/itinerary/MovePlaceDialog.tsx` 實作移動對話框：以 `listTripDays` 產生除目前天以外的目標天選單（顯示 `label`），說明「移入後依抵達時間排序，前後的交通方式會重設為未設定」，按鈕為「取消」與「移動」。
- [X] T047 [P] [US4] 在 `src/features/trips/RemovedDaysDialog.tsx` 實作旅程縮短警告對話框：列出將被移除的天（例如「Day 8、Day 9」）與受影響地點數，選項為「刪除這些地點」、「移到 Day X」（下拉選擇保留的 1…新天數，標籤使用新日期的 `listTripDays`）與「取消」，回傳使用者選擇的 resolution 或取消。
- [X] T048 [US4] 在 `src/features/itinerary/PlaceTimeline.tsx` 為每個地點加入「編輯」、「移到其他天」、「刪除」操作（lucide `Pencil`、`CalendarArrowUp` 或 `MoveRight`、`Trash2`，有 `aria-label`）；在 `src/features/itinerary/DayItineraryPage.tsx` 串接 `PlaceForm` 編輯模式與 `updatePlace`、`DeletePlaceDialog` 與 `deletePlace`、`MovePlaceDialog` 與 `movePlace`，完成後重新讀取當天與整趟旅程地點並清除失效的選取。依賴 T043–T046。
- [X] T049 [US4] 在 `src/features/trips/TripDetailsPage.tsx` 包裝傳給 `TripForm` 的 `save`：先以 `tripFormSchema.safeParse(input)` 取得新日期，若新天數（`getTripDurationDays`）小於舊天數，呼叫 `itineraryRepository.countPlacesBeyondDay`；有地點時開啟 `RemovedDaysDialog` 並等待選擇——取消時回傳 `{ success: false, message: "已取消日期變更，旅程未修改。", fieldErrors: {} }` 且不寫入，畫面留在編輯表單並保留使用者輸入的值；選擇後呼叫 `saveTrip(input, { existingTrip, repository })`，其中 `repository` 為覆寫 `update` 改呼叫 `itineraryRepository.updateTripWithRemovedDays(trip, resolution)` 的包裝；沒有地點被影響或天數未減少時沿用原本 `saveTrip` 流程。新增 `itineraryRepository` prop（預設實例）以利測試注入。依賴 T043、T047。

**Checkpoint**: T040–T042 全部通過；US1–US3 測試仍通過。

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Verify the whole feature against the constitution, design guide, and quickstart.

- [X] T050 [P] 檢查 `src/features/itinerary/*.tsx` 與 `src/features/trips/RemovedDaysDialog.tsx` 的所有介面文字、`aria-label`、錯誤與提示皆為繁體中文（FR-020），並對照 `docs/design-guide.md` 確認字體、顏色 tokens、2px 章節粗線／1px 細線、lucide 1.5px 圖示與深色模式樣式；不一致處直接修正於對應檔案。
- [X] T051 [P] 建立 FR-021 對照：逐一確認 `spec.md` 的 US1–US4 驗收情境、Edge Cases 與 SC-002～SC-007 在 `tests/unit/` 或 `tests/integration/` 中都有對應斷言，缺漏者補在對應的測試檔（`tests/integration/itinerary/*.test.tsx`、`tests/integration/data/itineraryRepository.test.ts` 或 `tests/unit/*.test.ts`）。
- [X] T052 執行 `npx vitest run`、`npm run typecheck`、`npm run build`，修正所有失敗與型別錯誤，並確認 build 產物中沒有 `marker-icon.png` 的參照。
- [ ] T053 依 `specs/002-daily-itinerary-map/quickstart.md` 手動驗證步驟 1–15 在 Chrome（寬度 ≥ 1280px）實際操作，特別確認 Esri 淺灰／深灰底圖與地名、墨黑編號標記無破圖、線條樣式與圖例一致、右下角 attribution、Offline 時「地圖暫時無法載入」提示，使用 001 時期資料庫開啟時舊旅程完整保留，並將視窗縮至 768px 確認改為單欄、時間軸在上、地圖高度固定且可操作；發現的問題修正於對應檔案。

---

## Phase 8: 實作後調整（2026-10-16）

**Purpose**: 真實瀏覽器檢查發現 CARTO 圖磚需要金鑰；使用者追加拖曳排序需求（spec FR-022）。

- [X] T054 [P] 在 `src/features/itinerary/DayMap.tsx` 將底圖改為 Esri 灰階底圖（淺色 `World_Light_Gray_Base` + `World_Light_Gray_Reference`，深色 `World_Dark_Gray_Base` + `World_Dark_Gray_Reference`），`maxNativeZoom` 16、`maxZoom` 18，attribution 依 research「底圖」修訂；更新 `tests/integration/itinerary/dayMap.test.tsx` 的圖磚與 attribution 斷言。
- [X] T055 [P] 在 `src/styles/tailwind.css` 以 `.leaflet-marker-icon.map-marker` 提高標記樣式權重，避免被延後載入的 `leaflet.css` 的 `display: block` 覆蓋造成數字未置中。
- [X] T056 先在 `tests/unit/itineraryOrdering.test.ts` 撰寫 `moveItem` 與 `arrivalTimeForReorder` 測試（拖到最前 = 下一點 −30 分、中間 = 前後中間值取整、最後 = 前一點 +30 分、不超出 00:00–23:59），再於 `src/features/itinerary/itineraryOrdering.ts` 實作；`toMinutes`／`fromMinutes` 由 `src/features/itinerary/itinerarySchema.ts` 匯出。
- [X] T057 先在 `tests/integration/data/itineraryRepository.test.ts` 新增「拖曳調整順序」測試，再於 `src/data/itineraryRepository.ts` 實作 `reorderPlace(tripId, dayNumber, placeId, toIndex, options?)`：單一交易內只更新被拖曳地點的 `arrivalTime`（離開時間早於新抵達時間時改為等長 `duration`）、依新順序重編當天 `dayOrder`、以 `findStaleSegmentIds` 清理交通段；目標位置無效時拋出「目標位置不正確」且不寫入。
- [X] T058 先在 `tests/integration/itinerary/placeReorder.test.tsx` 撰寫鍵盤拖曳驗收測試，再於 `src/features/itinerary/PlaceTimeline.tsx` 以 @dnd-kit（滑鼠、觸控、鍵盤感應器，沿用 `SortableDestinations` 做法）加入拖曳把手「拖曳調整順序：{名稱}」與拖曳預覽，只有兩個以上地點時顯示；在 `src/features/itinerary/DayItineraryPage.tsx` 先樂觀更新順序，再呼叫 `reorderPlace`，並以 `role="status"` 顯示「已將「{名稱}」的抵達時間改為 HH:mm，可再按編輯修改。」。
- [X] T060 依使用者回饋將路線改為「每種交通方式一色、一律實線」：`src/features/itinerary/transportModes.ts` 的 `LineStyle` 只保留 `color`（交通方式代碼或 `unset`）與 `weight`（設定 4px、未設定 3px）；`src/styles/tailwind.css` 新增淺色與深色模式的 `--color-route-*` 變數與 `.map-line--{code}` 樣式；`DayMap`、`MapLegend` 移除虛線設定，圖例移至地圖右上角；更新 `tests/unit/mapModel.test.ts`；於 `docs/design-guide.md`「地圖」記錄偏離理由與對比度（憲章 VI）。
- [X] T059 在 `src/app/App.tsx` 以 `React.lazy` 延後載入 `DayItineraryPage`（含 Leaflet），首頁主程式由 683 KB 降為 504 KB。

---

## Phase 9: 使用者回饋調整（2026-10-19）

- [X] T061 [P] 在 `src/features/itinerary/mapModel.ts` 讓 `buildMapLines` 略過沒有座標的地點、以未設定灰線連接前後有座標的地點（`bridgesManualPlaces`）；在 `src/features/itinerary/TransportSegmentRow.tsx` 為任一端沒有座標的段落加上說明；更新 `tests/unit/mapModel.test.ts` 與 `tests/integration/itinerary/dayMap.test.tsx`（spec US3-3、FR-013 修訂）。
- [X] T062 [P] 在 `src/features/itinerary/DayItineraryPage.tsx` 改為寬螢幕整頁固定一個視窗高（`lg:h-screen`、`lg:grid-rows-[auto_minmax(0,1fr)]`）、時間軸區塊內捲動且日期標題固定在上方、地圖 `lg:h-full` 完整顯示；窄螢幕維持單欄與 420px 地圖；更新 `dayMap.test.tsx` 的版面斷言（spec FR-012 修訂）。
- [X] T063 [P] 在 `src/styles/tailwind.css` 讓 Leaflet 縮放按鈕與版權列使用主題色，深色模式不出現白色區塊；版權列選擇器加上 `.leaflet-control-container` 提高權重，避免被延後載入的 `leaflet.css` 覆蓋。
- [X] T065 新增 `src/features/itinerary/PlaceFormDialog.tsx`，新增與編輯地點改以置中對話框呈現（`role="dialog"`、開啟時焦點進入第一個欄位、Esc 或取消關閉並把焦點還給觸發按鈕、內容過長時對話框內捲動），解決時間軸捲動後點編輯表單出現在畫面外的問題；`DayItineraryPage.tsx` 改用對話框；`tests/integration/itinerary/placeEditMove.test.tsx` 新增對話框焦點與關閉測試。
- [X] T064 以無頭 Chrome 自動執行 T053 中可自動化的 21 項檢查：001 舊資料庫升級、寬螢幕整頁不捲動與地圖／圖例／版權列在畫面內、灰線略過無座標地點、路線色、Google 地圖連結、深色模式底圖與路線色、768px 單欄與 420px 地圖、斷網提示與時間軸可用、主控台無錯誤，全部通過。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup (T001 for Leaflet types) — BLOCKS all user stories.
- **US1 (Phase 3)**: Depends on Foundational.
- **US2 (Phase 4)**: Depends on Foundational and on US1's page scaffolding (T020, T023, T024) because segments render inside the US1 timeline.
- **US3 (Phase 5)**: Depends on Foundational and US1's page (T024). Line styles read segments, so US3 is fully meaningful after US2, but its tests seed segments directly through the repository and do not require US2 UI.
- **US4 (Phase 6)**: Depends on US2's `updatePlace` (T030); UI integration (T048) touches US1/US3 files.
- **Polish (Phase 7)**: Depends on all desired user stories.

### Within-file sequencing

Several stories extend the same files, so these tasks run in order even across phases:

- `src/data/itineraryRepository.ts`: T020 → T030 → T043
- `tests/integration/data/itineraryRepository.test.ts`: T017 → T027 → T040
- `src/features/itinerary/DayItineraryPage.tsx`: T024 → T032 → T039 → T048
- `src/features/itinerary/PlaceTimeline.tsx`: T023 → T039 → T048
- `src/features/itinerary/PlaceForm.tsx`: T022 → T044
- `src/features/trips/TripDetailsPage.tsx`: T025 → T049

### Within Each User Story

- Tests are written first and must fail for the missing behavior.
- Pure functions (`src/shared/geo/*`, `mapModel.ts`) before repository methods, repository before components, components before page integration.

### Parallel Opportunities

- Setup: T002, T003, T004 in parallel after T001.
- Foundational tests T005–T009 in parallel; then T010 and T011 in parallel; T012 → T013/T014 → T015.
- US1: T016–T018 in parallel; T019, T021, T022, T023 in parallel (T020 can run alongside them).
- US2: T026–T028 in parallel; T029 and T031 in parallel with T030.
- US3: T033–T034 in parallel; T035–T037 in parallel.
- US4: T040–T042 in parallel; T044–T047 in parallel after T043 starts.
- Polish: T050 and T051 in parallel.

---

## Parallel Examples

### User Story 1

```bash
# Tests first:
Task: "parseLocationInput contract tests in tests/unit/locationInput.test.ts"
Task: "US1 repository tests in tests/integration/data/itineraryRepository.test.ts"
Task: "US1 UI acceptance tests in tests/integration/itinerary/dayItinerary.test.tsx"

# Then independent modules:
Task: "parseLocationInput in src/shared/geo/locationInput.ts"
Task: "DayTabs in src/features/itinerary/DayTabs.tsx"
Task: "PlaceForm in src/features/itinerary/PlaceForm.tsx"
Task: "PlaceTimeline in src/features/itinerary/PlaceTimeline.tsx"
```

### User Story 2

```bash
Task: "Google Maps URL contract tests in tests/unit/googleMapsUrls.test.ts"
Task: "Transport UI tests in tests/integration/itinerary/transportSegments.test.tsx"
Task: "buildGoogleMapsDirectionsUrl in src/shared/geo/googleMapsUrls.ts"
Task: "TransportSegmentRow in src/features/itinerary/TransportSegmentRow.tsx"
```

### User Story 3

```bash
Task: "mapModel tests in tests/unit/mapModel.test.ts"
Task: "DayMap UI tests in tests/integration/itinerary/dayMap.test.tsx"
Task: "mapModel in src/features/itinerary/mapModel.ts"
Task: "createNumberedMarkerIcon in src/features/itinerary/markerIcon.ts"
Task: "MapLegend in src/features/itinerary/MapLegend.tsx"
```

### User Story 4

```bash
Task: "Place edit/move UI tests in tests/integration/itinerary/placeEditMove.test.tsx"
Task: "Trip date change tests in tests/integration/itinerary/tripDateChange.test.tsx"
Task: "DeletePlaceDialog in src/features/itinerary/DeletePlaceDialog.tsx"
Task: "MovePlaceDialog in src/features/itinerary/MovePlaceDialog.tsx"
Task: "RemovedDaysDialog in src/features/trips/RemovedDaysDialog.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (database version 2, schemas, ordering).
3. Complete Phase 3: US1.
4. **STOP and VALIDATE**: 新增三種地點、時間軸排序、重新開啟後保留。

### Incremental Delivery

1. Setup + Foundational → 資料表與規則就緒。
2. US1 → 每日地點與時間軸（MVP）。
3. US2 → 交通方式與 Google 地圖連結。
4. US3 → 雙欄地圖總覽。
5. US4 → 編輯／刪除／移動與旅程日期縮短保護。
6. Polish → 視覺、FR-021 對照、quickstart 驗證。

---

## Notes

- [P] tasks = different files, no dependencies on unfinished tasks.
- 每個會改變地點順序的寫入都必須在同一個 Dexie 交易內清理失效交通段（data-model 不變式）。
- 不新增站內搜尋、路線服務、圖磚快取或 E2E 測試框架（憲章 V）。
- Commit after each task or logical group; stop at any checkpoint to validate the story independently.
