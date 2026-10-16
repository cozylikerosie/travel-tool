# Implementation Plan: 每日行程、交通方式與地圖（電腦端）

**Branch**: `002-daily-itinerary-map` | **Date**: 2026-10-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-daily-itinerary-map/spec.md`

## Summary

在既有旅程中加入電腦端的每日行程：依旅程日期產生 Day 1…N，每天可加入地點（貼上座標或電腦版 Google 地圖網址，或手動輸入名稱），依抵達時間排成時間軸，相鄰地點之間設定交通方式並一鍵以 Google Maps URLs 開啟路線查詢；右側以 Leaflet + CARTO Positron 地圖顯示編號標記與依交通方式區分樣式的直線。資料以 Dexie version 2 新增 `places`、`transportSegments` 兩個資料表，不影響 001 旅程資料。座標解析、連結產生、排序、失效交通段與地圖模型皆為獨立純函式並有單元測試。

## Technical Context

**Language/Version**: TypeScript（strict），沿用 001 的 TypeScript 7 與 Vite 8。

**Primary Dependencies**: 沿用 Vite、React 19、Tailwind CSS 4、Dexie.js 4、Zod 4、vite-plugin-pwa、lucide-react；新增 `leaflet@^1.9.4`、`react-leaflet@^5.0.0`、`@types/leaflet`（dev）。

**Storage**: IndexedDB（Dexie），資料庫 version 1 → 2，新增 `places` 與 `transportSegments`；`trips` 不變。

**Testing**: Vitest、React Testing Library、jsdom、fake-indexeddb；整合測試中以替身 mock `react-leaflet`；真實瀏覽器視覺檢查依 [quickstart.md](./quickstart.md)。

**Target Platform**: 電腦版瀏覽器（≥ 1024px 寬為雙欄主要版面）；靜態 GitHub Pages 部署與既有 PWA app shell。

**Project Type**: 單一前端 Web 應用程式／可安裝的靜態 PWA。

**External Services**: Esri 灰階底圖圖磚（免金鑰，需標示來源；2026-10-16 由 CARTO 改用，見 research）；Google Maps URLs（僅產生連結，免金鑰）。不使用任何需金鑰或付費的服務。

**Visual Design**: 遵循 `docs/design-guide.md`：Esri 淺灰底圖（深色模式深灰）、墨黑／點綴色的自訂編號標記與線條、2px 章節粗線與 1px 細線、Day 標籤採「Day 1・12.10 THU」雜誌式日期、lucide-react 1.5px 圖示。

**Performance Goals**: 無額外數值目標；以每天 10 個以內地點為驗收規模，切換天數與修改時間後清單與地圖即時更新。

**Constraints**: 時間以 `HH:mm` 當地時間字串保存、不做時區轉換；日期沿用 001 純日期運算；地圖不做離線快取；座標解析不連網、不展開短網址；每次會改變順序的寫入必須在單一 Dexie 交易內同時清理失效交通段。

**Scale/Scope**: 單一使用者、本機資料；只實作功能 002。手機版面、輸出到手機（003）、花費記錄（004）、站內搜尋、整趟總覽地圖、KML 匯入不在範圍內。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. 三階段旅行流程 — PASS**: 本功能屬行前規劃，以電腦大螢幕、鍵盤滑鼠操作的雙欄版面為主；旅途中的手機查看留給 003。
- **II. 旅途離線使用 — PASS WITH SCOPE BOUNDARY**: 本功能是電腦端規劃，不承諾離線地圖（spec 明列不做）；地圖無法載入時時間軸、交通方式與連結仍可用。地點與交通段保存在本機，003 輸出到手機時可一併帶入離線查看所需資料。
- **III. 裝置獨立與使用者掌控資料 — PASS**: 所有行程資料只存於 IndexedDB；圖磚與 Google 地圖連結只用於檢視與查詢，不是資料保存或交換的必要條件，也不需帳號或金鑰。
- **IV. 功能必須有測試 — PASS**: 每個驗收情境都有對應的單元或整合測試；資料庫升級以 version 1 → 2 的整合測試驗證既有旅程不受影響；地圖視覺以 quickstart 的真實瀏覽器檢查補足 jsdom 限制。
- **V. 簡單且聚焦 — PASS**: 只新增兩個資料表與必要純函式；不加入站內搜尋、路線規劃、圖磚快取或 E2E 測試框架。交通段只保存已設定的值，「未設定」不佔紀錄。
- **VI. 全站視覺一致 — PASS**: 地圖底圖、標記、線條、圖例與表單都依設計指南；標記與線條只用墨黑與點綴色，不使用預設藍色圖釘。
- **Additional Constraints — PASS**: 所有介面文字、提示與錯誤訊息使用繁體中文，包含座標解析失敗的引導說明。
- **Development Workflow — PASS**: 每項需求對應行前規劃階段與可驗收結果；涉及資料保存的旅程日期縮短流程以完整整合測試覆蓋。

**Post-design re-check（Phase 1 後）**: data-model 只新增資料表、不改 `trips`；contracts 皆為不連網的純函式；無新增違反項目。全部 PASS。

## Project Structure

### Documentation (this feature)

```text
specs/002-daily-itinerary-map/
├── plan.md               # 本檔
├── research.md           # Phase 0
├── data-model.md         # Phase 1
├── quickstart.md         # Phase 1
├── contracts/
│   ├── google-maps-urls.md   # Google 地圖路線連結格式
│   └── location-input.md     # 座標／網址輸入文法與提示
├── checklists/
│   └── requirements.md
└── tasks.md              # Phase 2（/speckit-tasks 產生，非本指令）
```

### Source Code (repository root)

```text
src/
├── app/
│   └── App.tsx                         # 新增「每日行程」畫面的導覽狀態
├── data/
│   ├── database.ts                     # version 2：places、transportSegments
│   ├── tripRepository.ts               # 刪除旅程時同一交易刪除每日行程
│   └── itineraryRepository.ts          # 地點／交通段 CRUD、移動、日期縮短處理（皆含失效交通段清理）
├── features/
│   ├── trips/
│   │   ├── TripDetailsPage.tsx         # 新增「每日行程」入口；編輯儲存前檢查被移除的天
│   │   └── RemovedDaysDialog.tsx       # 旅程縮短警告：刪除／移到 Day X／取消
│   └── itinerary/
│       ├── itinerarySchema.ts          # Place、TransportSegment、stay 的 Zod schema 與型別
│       ├── transportModes.ts           # TRANSPORT_MODES：名稱、travelmode、線條樣式
│       ├── itineraryOrdering.ts        # 排序、相鄰組合、失效交通段計算
│       ├── mapModel.ts                 # 標記、連線、樣式、viewport（含亞洲預設範圍）
│       ├── DayItineraryPage.tsx        # 雙欄版面、選取狀態
│       ├── DayTabs.tsx                 # Day 1・12.10 THU 切換
│       ├── PlaceTimeline.tsx           # 時間軸清單與空白日引導
│       ├── PlaceForm.tsx               # 新增／編輯地點（貼上或手動）
│       ├── TransportSegmentRow.tsx     # 交通方式選單與 Google 地圖連結
│       ├── MovePlaceDialog.tsx
│       ├── DeletePlaceDialog.tsx
│       ├── DayMap.tsx                  # react-leaflet 地圖、圖磚、attribution、tileerror 提示
│       ├── MapLegend.tsx
│       └── markerIcon.ts               # createNumberedMarkerIcon（L.divIcon）
├── shared/
│   ├── dates/tripDates.ts              # 新增 addDaysToDateOnly、getWeekdayShort、listTripDays
│   └── geo/
│       ├── locationInput.ts            # parseLocationInput
│       └── googleMapsUrls.ts           # buildGoogleMapsDirectionsUrl
└── styles/
    └── tailwind.css                    # 新增 .map-marker、.map-line--{ink,accent,muted,rule}（使用顏色變數）

tests/
├── setup.ts                            # 補上 scrollIntoView、matchMedia 替身
├── mocks/
│   └── reactLeaflet.tsx                # react-leaflet 測試替身（data-* 屬性）
├── unit/
│   ├── locationInput.test.ts
│   ├── googleMapsUrls.test.ts
│   ├── tripDays.test.ts
│   ├── itineraryOrdering.test.ts
│   ├── itinerarySchema.test.ts
│   └── mapModel.test.ts
└── integration/
    ├── data/
    │   ├── databaseUpgrade.test.ts
    │   └── itineraryRepository.test.ts
    ├── itinerary/
    │   ├── dayItinerary.test.tsx        # 旅程日、新增／排序／空白日
    │   ├── transportSegments.test.tsx   # 交通方式、連結、重設規則
    │   ├── dayMap.test.tsx              # 以 react-leaflet 替身驗證標記、連線、雙向選取
    │   ├── placeEditMove.test.tsx       # 編輯、刪除、移到別天
    │   └── tripDateChange.test.tsx      # 平移不警告、縮短警告三種選擇
    └── trips/
        ├── tripRepository.test.ts       # 刪除旅程連帶刪除每日行程
        └── tripCopy.test.tsx            # 複製旅程不複製每日行程
```

**Structure Decision**: 沿用 001 的單一 Vite 前端與 feature 目錄。每日行程集中在 `src/features/itinerary/`；與 UI 無關且可重用的座標解析與 Google 地圖連結放在 `src/shared/geo/`，日期運算延伸既有 `src/shared/dates/`。資料存取沿用 repository 模式，新增 `itineraryRepository`，讓所有改變順序的寫入集中處理失效交通段。旅程日期縮短的警告屬於 001 旅程編輯流程，因此放在 `features/trips/`，但透過 `itineraryRepository` 執行資料變更。

## Complexity Tracking

無憲章違反項目。新增的 Leaflet／react-leaflet 為使用者指定且直接支援地圖需求；未引入路線服務、圖磚快取或 E2E 測試框架。
