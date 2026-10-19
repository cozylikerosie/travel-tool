# Research: 每日行程、交通方式與地圖（電腦端）

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-16

技術主軸沿用 001（Vite、React、TypeScript、Tailwind CSS、Dexie.js／IndexedDB、Zod、vite-plugin-pwa、Vitest），以下只記錄 002 新增或需要決定的項目。

## 地圖函式庫：Leaflet + react-leaflet

- **Decision**: 使用 `leaflet@^1.9.4` 與 `react-leaflet@^5.0.0`（peer 需求為 React 19 與 leaflet ^1.9，符合專案現況），型別使用 `@types/leaflet`。地圖元件集中在單一 `DayMap` 元件，其餘頁面不直接操作 Leaflet。
- **Rationale**: 使用者指定；Leaflet 不需 API 金鑰、可自由選擇底圖，react-leaflet 5 為支援 React 19 的版本。
- **Alternatives considered**: MapLibre GL（向量圖磚、需另找免金鑰樣式來源，對「直線連點」需求過重）；Google Maps JavaScript API（需金鑰與計費，違反本次限制）。

## 底圖：Esri 灰階底圖（2026-10-16 修訂，原為 CARTO Positron）

- **Revision**: 實作後於真實瀏覽器驗證時發現 CARTO basemaps 已改為需要 API 金鑰（所有圖磚回傳「API KEY REQUIRED」）。改用 Esri World Light Gray Canvas（`.../Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}` 加上地名圖層 `World_Light_Gray_Reference`），深色模式使用 `World_Dark_Gray_Base`／`World_Dark_Gray_Reference`；免金鑰、本身即為低彩度灰階。原生資料到縮放 16，地圖最大縮放 18（放大顯示）。attribution 為「Tiles © Esri — Esri, HERE, Garmin, © OpenStreetMap contributors, and the GIS user community」。風險：Esri 免費使用條款未來可能改變；OpenStreetMap 官方圖磚對非瀏覽器請求回傳 418，且政策要求應用程式節制流量，因此不採用。以下為原決策，保留作為紀錄。
- **Decision（原）**: 淺色模式使用 CARTO Positron 圖磚 `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png`；深色模式（`prefers-color-scheme: dark`）使用同系列的 Dark Matter `dark_all`，維持設計指南的低彩度與深色模式。地圖右下角保留 Leaflet 的 attribution 控制項，文字為「© OpenStreetMap contributors © CARTO」並連結至兩者的版權頁。
- **Rationale**: 設計指南指定 Positron；CARTO basemaps 不需金鑰，但使用條款要求標示 OpenStreetMap 與 CARTO 來源。本工具為個人使用，流量遠低於其免費使用範圍。
- **Alternatives considered**: OpenStreetMap 官方圖磚（色彩飽和、與設計指南不符，且其使用政策不鼓勵應用程式大量使用）；Stadia／Mapbox（需金鑰）。
- **PWA 注意事項**: 地圖離線不在範圍內，Workbox 不設定圖磚的 runtime caching，也不把圖磚加入 precache；圖磚失敗時顯示「地圖暫時無法載入」提示，時間軸與連結照常運作（spec Edge Cases）。

## 標記圖示與 Vite 打包問題

- **Decision**: 所有標記一律使用 `L.divIcon` 產生的自訂 HTML 標記（墨黑圓形底、白色 Cormorant Garamond 數字；選取時改為點綴色 `#8A7A5C` 並放大），由單一 `createNumberedMarkerIcon(order, isSelected)` 函式建立；不使用 `L.Icon.Default`。
- **Rationale**: Leaflet 預設圖示以 CSS 推導 `marker-icon.png` 路徑，Vite 打包後路徑失效會出現破圖；完全不使用預設圖示即可根除問題，也同時滿足設計指南「不用預設藍色圖釘」。`divIcon` 不需要任何圖片資源，PWA precache 也不需處理圖檔。
- **Guard**: 單元測試確認地圖模型產生的每個標記都帶有自訂 icon；`DayMap` 只透過 `createNumberedMarkerIcon` 建立 `Marker`，不 import `leaflet/dist/images/*`。Leaflet 的 CSS（`leaflet/dist/leaflet.css`）由 `DayMap` 匯入，交由 Vite 打包。

## 路線線條樣式

- **Revision（2026-10-16）**: 使用者回饋地圖上看不到交通線，且要求以顏色區分、不要點線。原本的虛線／點線（尤其「未設定」的分隔線色細點線）在灰階底圖上幾乎不可見。改為每種交通方式一種低彩度實線色（未設定為灰色實線），色碼與對比計算記錄於 `docs/design-guide.md`「地圖」，以 `--color-route-*` 變數定義並提供深色模式版本；圖例移到地圖右上角，進入頁面即可看到。以下為原決策，保留作為紀錄。

- **Decision**: 交通方式的中文名稱、Google 地圖 travelmode 與 polyline 樣式定義在同一份 `TRANSPORT_MODES` 常數（單一來源），並由同一份資料產生地圖圖例：

  | 交通方式 | 線條樣式（顏色／寬度／虛線） |
  |----------|------------------------------|
  | JR／電車 | 墨黑實線，3px |
  | 巴士 | 墨黑虛線 `8 6`，2.5px |
  | 渡輪 | 點綴色長虛線 `14 8`，2.5px |
  | 計程車 | 點綴色實線，2.5px |
  | 自駕 | 點綴色短虛線 `4 4`，2.5px |
  | 步行 | 墨黑圓點線 `1 6`（round cap），2.5px |
  | 飛機 | 點綴色點虛線 `10 5 2 5`，2px |
  | 其他 | 次要文字色虛線 `6 6`，2px |
  | 未設定 | 分隔線色細點線 `2 6`，1.5px |

- **Rationale**: 設計指南限制路線只用墨黑或點綴色；以「顏色 × 實線/虛線/點線 × 粗細」組合區分 9 種狀態，不需引入飽和色。圖例與線條同源，避免兩者不一致。
- **Alternatives considered**: 每種交通方式一種顏色（違反低彩度原則）；在線條上加 icon（實作複雜，直線密集時易重疊）。

## Google 地圖路線連結（Google Maps URLs）

- **Decision**: 以純函式 `buildGoogleMapsDirectionsUrl(origin, destination, transport)` 產生 `https://www.google.com/maps/dir/?api=1&origin=...&destination=...&travelmode=...`，不需 API 金鑰。端點有座標時用 `緯度,經度`；沒有座標時用「名稱, 地址」（無地址則只用名稱）；任一端兩者皆無時回傳 `null`（不顯示連結）。travelmode 對應：JR／電車、巴士、渡輪 → `transit`；步行 → `walking`；計程車、自駕 → `driving`；飛機、其他、未設定 → 省略參數。所有參數以 `URLSearchParams` 編碼。連結以 `target="_blank" rel="noopener noreferrer"` 開啟。
- **Rationale**: Google Maps URLs 是官方提供的跨平台、免金鑰的連結格式；省略 travelmode 時由 Google 地圖自行選擇預設模式，符合 spec 對飛機／其他的要求。詳細格式見 [contracts/google-maps-urls.md](./contracts/google-maps-urls.md)。
- **Alternatives considered**: `maps.google.com/?saddr=&daddr=` 舊格式（非官方文件化、行為不穩定）；Directions API（需金鑰與計費）。

## 座標與 Google 地圖網址解析

- **Decision**: 以純函式 `parseLocationInput(text)` 解析使用者貼上的內容，回傳判別聯集：成功時為 `{ ok: true, coordinates, name? }`，失敗時為 `{ ok: false, reason: "short-url" | "unrecognized" | "out-of-range" }`，由介面依 reason 顯示對應的繁體中文提示。解析順序：
  1. 純座標 `緯度, 經度`（允許逗號前後空白、正負號與小數）。
  2. `google.com/maps` 網址：優先取地點本身座標 `!3d緯度!4d經度`；沒有時取 `@緯度,經度,縮放z`（地圖畫面中心）；再沒有時取 `q=`、`query=`、`ll=`、`destination=` 參數中的座標。
  3. 網址路徑含 `/place/<名稱>/` 時，將名稱 URL decode 並把 `+` 轉回空白後帶入。
  4. `maps.app.goo.gl`、`goo.gl/maps` 等短網址 → `short-url`（需連線展開，本次不支援）。
  5. 其他內容 → `unrecognized`；格式正確但超出緯度 ±90、經度 ±180 → `out-of-range`。
- **Rationale**: 規格要求優先使用地點本身而非畫面中心的座標，`!3d!4d` 正是 Google 地圖網址中地點的座標，`@` 則是視窗中心。解析邏輯完全不連網，可用單元測試覆蓋所有格式。完整輸入文法與測試案例見 [contracts/location-input.md](./contracts/location-input.md)。
- **Alternatives considered**: 透過網路展開短網址（需代理伺服器或 CORS 例外，違反無後端原則）；Geocoding API（需金鑰）。

## 資料表與 Dexie 版本升級

- **Decision**: 將 `TripDatabase` 由 version 1 升到 version 2，新增兩個資料表，`trips` 定義原樣保留：
  - `places: "id, tripId, [tripId+dayNumber]"`
  - `transportSegments: "id, tripId, [tripId+dayNumber]"`
  version 2 不需要 `upgrade()` 轉換函式，因為既有 `trips` 紀錄的結構不變。
- **Rationale**: Dexie 只要在新版本宣告新增的 store，既有 store 與資料會原樣保留；依 001 research 的「schema 變更必升版、保留舊版宣告」原則。以 `[tripId+dayNumber]` 複合索引一次取出某天的地點與交通段。
- **Verification**: 新增升級測試：以 version 1 定義建立資料庫並寫入旅程，關閉後以 version 2 開啟，確認旅程完整保留、新資料表為空且可寫入。
- **Alternatives considered**: 把地點以陣列嵌入旅程紀錄（每次編輯地點都要重寫整趟旅程，且與 004 記帳要跨資料表查詢的方向不一致）。

## 交通段的保存與「相鄰關係改變即重設」（Clarification Q1:C）

- **Decision**: 交通段只保存「已設定」的交通方式，主鍵為 `${fromPlaceId}->${toPlaceId}`；畫面上的移動段落由當天排序後的相鄰地點對推導，以起訖地點組合查詢交通方式，查無紀錄即顯示「未設定」。任何會改變某天地點順序的操作（新增、修改抵達時間、刪除、移到別天、旅程日期變更時搬移）都在同一個 Dexie 交易內重新計算受影響天的相鄰組合，刪除不再相鄰的交通段紀錄。選擇「未設定」則刪除該紀錄。
- **Rationale**: 符合 Q1:C——起訖不變的段落保留設定，相鄰關係改變的段落成為未設定，且不會在之後重新相鄰時「復活」舊設定。重新計算邏輯寫成純函式 `findStaleSegmentIds(sortedPlaces, segments)`，可單元測試。
- **Alternatives considered**: 以「出發地點」綁定交通方式（Q1:B，已被否決）；保留舊紀錄只在顯示時忽略（會在重新相鄰時錯誤復活，也累積垃圾資料）。

## 地點排序與加入順序

- **Decision**: 抵達時間以 `HH:mm` 字串保存（24 小時制、補零），可直接字串比較；同時間時以 `dayOrder`（加入當天時的遞增整數，等於當天現有最大值 + 1）排序。地點移入另一天時重新指定 `dayOrder`，視為該天最後加入（spec Edge Cases）。
- **Rationale**: 固定寬度的 `HH:mm` 字串比較等同時間比較，不需轉成 `Date`，也不涉及時區；`dayOrder` 比時間戳記穩定，不受系統時鐘影響。
- **Alternatives considered**: 以 `createdAt` 排序（移到別天時無法表達「最後加入」）；以分鐘數整數保存（顯示與輸入都要轉換，且使用者指定以 `HH:mm` 儲存）。

## 停留時間與離開時間

- **Decision**: 地點的 `stay` 欄位為判別聯集：`{ kind: "none" }`、`{ kind: "duration", minutes }`、`{ kind: "departure", time: "HH:mm" }`，Zod 驗證 duration 為 1–1439 分鐘的整數、departure 不早於抵達時間。介面以單選切換兩種輸入，另一者由純函式推算顯示；推算的離開時間超過 23:59 時顯示「隔天」字樣但不改變排序。
- **Rationale**: 從資料結構上保證「只能擇一」，不需另外寫互斥驗證。

## 旅程日（Day N）與日期平移（Clarification Q2:A）

- **Decision**: 地點以 `tripId` + `dayNumber`（1 起算整數）關聯；Day N 的日期與英文星期縮寫由出發日期加 N−1 天計算，延用 001 的純日期運算（不經 `new Date(string)`）。在 `src/shared/dates/tripDates.ts` 新增 `addDaysToDateOnly`、`getWeekdayShort` 與 `listTripDays(startDate, endDate)`。
- **旅程日期變更**: 在 001 的旅程編輯儲存流程前加入檢查：新天數小於舊天數時，查詢 `dayNumber > 新天數` 的地點；有地點則顯示對話框（列出受影響天數與地點數），選項為「刪除這些地點」、「移到 Day X」（下拉選擇保留的某一天）與「取消」。確認後在單一交易中同時更新旅程、刪除或搬移地點並清理交通段；取消則旅程日期不變。旅程平移（天數不變）不觸發任何地點變更。
- **Rationale**: 依 Q2:A，日期只是 Day N 的顯示屬性，所以平移無須搬資料；單一交易避免「旅程已改日期但地點未處理」的中間狀態。

## 地圖預設範圍（Clarification Q3:A，2026-10-16 修訂為亞洲）

- **Decision**: 純函式 `getMapViewport(dayPlaces, tripPlaces)`：當天有座標地點時 fit 當天範圍；否則 fit 整趟旅程所有有座標地點；都沒有時使用亞洲預設範圍 `[[-11, 92], [46, 146]]`（南至印尼、北至北海道、西至緬甸、東至日本東岸）。只有單一點時以該點為中心、縮放 14。
- **Rationale**: 不依賴地名查詢服務（FR-018），全部由使用者自己的資料決定。

## 沒有座標的地點與連線（2026-10-19）

- **Decision**: `buildMapLines` 依時間軸順序取出有座標的地點兩兩連線；兩點之間若夾著沒有座標的地點，該線 `bridgesManualPlaces = true`、交通方式視為未設定（灰色實線），不沿用任何交通段的顏色。時間軸中任一端沒有座標的移動段落旁顯示「一端沒有座標，地圖上以灰線連接前後地點」。
- **Rationale**: 使用者只輸入地點名稱時，原設計完全不畫線，看起來像功能故障；略過並以灰線相連讓路線不中斷，同時以灰色與文字說明表示這段不是實際的交通方式。

## 地圖與清單的互相對應

- **Decision**: `DayItineraryPage` 持有 `selectedPlaceId` 狀態；點選清單項目時地圖以 `panTo`（不在可見範圍內時）移動並強調標記；點選標記時清單項目強調並 `scrollIntoView({ block: "nearest" })`。手動地點只強調清單。標記編號使用時間軸編號（含手動地點），所以地圖上的編號可能不連續，例如 1、3（spec US3-3）。
- **Rationale**: 狀態集中在頁面層，地圖與清單都只是受控元件，方便測試。

## 測試策略

- **Decision**:
  - **純函式單元測試**：座標與網址解析、Google 地圖連結產生、旅程日列表與星期、排序與失效交通段計算、地圖模型（標記、連線、樣式、viewport）、Zod schema。
  - **資料層整合測試**（fake-indexeddb）：version 1 → 2 升級保留旅程、地點與交通段 CRUD、刪除旅程連帶刪除每日行程、旅程日期縮短時刪除或搬移。
  - **介面整合測試**（React Testing Library）：在測試中以輕量替身 mock `react-leaflet`，將標記與線段渲染為帶 `data-*` 屬性的 DOM，以驗證編號、連線、選取與雙向強調。
  - **真實瀏覽器檢查**：以 quickstart 的步驟在 Chrome 中檢查實際圖磚、標記、線條樣式、圖例、attribution 與雙欄版面。
- **Rationale**: jsdom 沒有實作 SVG `createSVGRect` 與 canvas，Leaflet 在 jsdom 中無法可靠渲染 polyline；把地圖行為收斂到可測的純函式「地圖模型」，再用替身驗證頁面整合，最後以真實瀏覽器確認視覺，三層互補。
- **Alternatives considered**: 在 jsdom 直接跑 Leaflet（polyline 渲染失敗、結果不穩定）；只做瀏覽器 E2E（需引入 Playwright 測試框架，增加複雜度，違反憲章 V）。

## 安全與隱私

- 貼上的網址只在本機解析，不發出任何請求；短網址不展開。
- 圖磚請求只包含地圖範圍座標，不含旅程名稱或地點資料。
- 「在 Google 地圖開啟」由使用者點擊才送出起訖資訊，使用 `rel="noopener noreferrer"`。
- 地點名稱與備註以 React 文字節點輸出；`divIcon` 的 HTML 只包含由程式產生的數字，不插入使用者輸入，避免 XSS。

## Resolved Unknowns

- 所有技術選擇由使用者指定或依 001 沿用；Technical Context 沒有剩餘 NEEDS CLARIFICATION。
- 效能沒有額外數值目標：以每天 10 個以內地點、單一使用者本機資料為規模，不需分頁或虛擬清單。
