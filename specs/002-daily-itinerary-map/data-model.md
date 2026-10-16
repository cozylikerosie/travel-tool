# Data Model: 每日行程、交通方式與地圖（電腦端）

**Feature**: [spec.md](./spec.md) | **Research**: [research.md](./research.md)

所有持久化結構以 Zod schema 定義，並以 `z.infer` 匯出 TypeScript 型別；寫入 IndexedDB 前一律以 schema `safeParse` 驗證，驗證失敗不得寫入（沿用 001 的 `saveTrip` 原則）。

## 資料庫版本

| Dexie 版本 | Stores | 說明 |
|------------|--------|------|
| 1（001） | `trips: "id,startDate,endDate"` | 原樣保留宣告，不修改 |
| 2（002） | 沿用 `trips`，新增 `places: "id, tripId, [tripId+dayNumber]"`、`transportSegments: "id, tripId, [tripId+dayNumber]"` | 只新增資料表，不需 `upgrade()` 轉換；既有旅程資料不變 |

## Place（地點）

| 欄位 | 型別 | 必填 | 規則 |
|------|------|------|------|
| `id` | UUID 字串 | 是 | 建立時以 `crypto.randomUUID()` 產生 |
| `tripId` | UUID 字串 | 是 | 對應既有旅程 `Trip.id` |
| `dayNumber` | 正整數 | 是 | 1 ≤ dayNumber ≤ 旅程天數；地點以 Day N 對應，旅程平移日期時不變 |
| `dayOrder` | 正整數 | 是 | 加入該天的先後順序；新增或移入時為當天最大值 + 1；拖曳排序後依新順序重新編為 1…n，讓相同抵達時間的地點維持拖曳位置 |
| `name` | 字串（trim） | 條件 | 與 `coordinates` 至少擇一；可為空字串 |
| `address` | 字串（trim） | 否 | 預設空字串 |
| `coordinates` | `{ lat, lng }` 或 `null` | 條件 | lat ∈ [−90, 90]、lng ∈ [−180, 180]，最多保留 6 位小數；`null` 表示手動地點，不顯示在地圖 |
| `arrivalTime` | `HH:mm` 字串 | 是 | 24 小時制、補零，`/^([01]\d\|2[0-3]):[0-5]\d$/`；當地時間，不做時區轉換 |
| `stay` | 判別聯集 | 是 | `{ kind: "none" }`、`{ kind: "duration", minutes: 1–1439 整數 }`、`{ kind: "departure", time: HH:mm }`；departure 不得早於 `arrivalTime` |
| `notes` | 字串 | 否 | 預設空字串，保留使用者輸入的空白 |
| `createdAt` / `updatedAt` | ISO datetime 字串 | 是 | 同 001 的 metadata 規則 |

**驗證規則**
- `name` 為空且 `coordinates` 為 `null` 時拒絕：「請輸入地點名稱或貼上座標」。
- 抵達時間缺漏：「請輸入抵達時間」。
- 離開時間早於抵達時間：「離開時間不可早於抵達時間」。
- 停留時間與離開時間由聯集結構保證只能擇一。

**排序（衍生）**：同一 `tripId` + `dayNumber` 的地點依 `arrivalTime` 字串遞增，再依 `dayOrder` 遞增；排序後的位置（1 起算）即時間軸與地圖標記的順序編號。

## TransportSegment（交通段）

「交通段」即 spec 中的「移動段落」，兩個名稱指同一個概念。

只保存已設定交通方式的段落；「未設定」以「沒有紀錄」表示。

| 欄位 | 型別 | 必填 | 規則 |
|------|------|------|------|
| `id` | 字串 | 是 | `${fromPlaceId}->${toPlaceId}` |
| `tripId` | UUID 字串 | 是 | 與兩端地點相同 |
| `dayNumber` | 正整數 | 是 | 與兩端地點相同 |
| `fromPlaceId` / `toPlaceId` | UUID 字串 | 是 | 排序後必須是相鄰的兩個地點（from 在前） |
| `mode` | 列舉 | 是 | `rail`、`bus`、`ferry`、`taxi`、`walk`、`drive`、`flight`、`other` |
| `updatedAt` | ISO datetime 字串 | 是 | 最後設定時間 |

**不變式**：任何交易完成後，每一筆交通段的 `fromPlaceId`、`toPlaceId` 都是同一天排序後的相鄰地點。會改變順序的操作必須在同一交易內刪除失效的交通段（Clarification Q1:C）。

## TransportMode（交通方式，常數，不持久化）

單一來源的 `TRANSPORT_MODES` 定義每種交通方式的：

| 代碼 | 顯示名稱 | Google travelmode | 線條樣式 |
|------|----------|-------------------|----------|
| `rail` | JR／電車 | `transit` | 見 research「路線線條樣式」 |
| `bus` | 巴士 | `transit` | 〃 |
| `ferry` | 渡輪 | `transit` | 〃 |
| `taxi` | 計程車 | `driving` | 〃 |
| `walk` | 步行 | `walking` | 〃 |
| `drive` | 自駕 | `driving` | 〃 |
| `flight` | 飛機 | 不指定 | 〃 |
| `other` | 其他 | 不指定 | 〃 |
| （未設定） | 未設定 | 不指定 | 〃 |

選單、時間軸、地圖線條、圖例與 Google 地圖連結都讀取這份常數。

## TripDay（旅程日，衍生，不持久化）

由 `listTripDays(trip.startDate, trip.endDate)` 產生：

| 欄位 | 說明 |
|------|------|
| `dayNumber` | 1…旅程天數 |
| `date` | `YYYY-MM-DD`，出發日加 `dayNumber − 1` 天 |
| `label` | `Day N・MM.DD WWW`，WWW 為 `SUN`…`SAT` |

## 關聯與生命週期

```text
Trip 1 ──< Place (tripId, dayNumber)
Trip 1 ──< TransportSegment (tripId, dayNumber)
Place 2 ──  TransportSegment (fromPlaceId, toPlaceId)
```

| 事件 | 地點 | 交通段 |
|------|------|--------|
| 新增地點 | 指定 `dayOrder`，寫入 | 重新計算該天相鄰組合，刪除失效紀錄 |
| 修改抵達時間 | 更新 | 同上 |
| 修改名稱、地址、座標、停留、備註 | 更新 | 順序不變，不受影響 |
| 刪除地點 | 刪除 | 刪除以它為端點的紀錄，並重新計算該天 |
| 移到另一天 | 更新 `dayNumber`、重新指定 `dayOrder` | 兩天都重新計算 |
| 拖曳排序（FR-022） | 只更新被拖曳地點的 `arrivalTime`（離開時間早於新抵達時間時改為等長的停留時間），當天全部重新編 `dayOrder` | 同一交易內重新計算該天 |
| 設定交通方式 | — | `put` 紀錄；選「未設定」時刪除紀錄 |
| 旅程平移日期（天數不變或增加） | 不變 | 不變 |
| 旅程縮短且被移除的天有地點 | 先警告；依使用者選擇刪除或移到保留的某一天，與旅程更新在同一交易 | 被刪除或搬移地點相關的紀錄刪除，目標天重新計算 |
| 刪除旅程 | 同一交易內刪除該旅程所有地點 | 同一交易內刪除所有交通段 |
| 複製旅程（001） | 不複製 | 不複製 |

## 資料交換相容性

本功能不實作匯出或匯入。未來輸出到手機（003）時，地點與交通段以 `tripId` 歸屬於旅程一併輸出，格式版本依 001 data-model 的 `formatVersion` 規則另行定義。
