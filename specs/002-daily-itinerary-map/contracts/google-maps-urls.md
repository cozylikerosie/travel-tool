# Contract: Google 地圖路線連結

**Function**: `buildGoogleMapsDirectionsUrl(origin: PlaceEndpoint, destination: PlaceEndpoint, mode: TransportModeCode | null): string | null`

**Location**: `src/shared/geo/googleMapsUrls.ts`（純函式，無副作用、不連網）

## 輸出格式

```text
https://www.google.com/maps/dir/?api=1&origin=<端點>&destination=<端點>[&travelmode=<模式>]
```

- 依 Google Maps URLs 官方格式，不需 API 金鑰。
- 參數以 `URLSearchParams` 編碼（空白為 `+`，中文與逗號依規則編碼）。
- 參數順序固定為 `api`、`origin`、`destination`、`travelmode`，方便測試比對。

## 端點取值規則

| 端點狀況 | 帶入值 |
|----------|--------|
| 有座標 | `緯度,經度`（不含空白，保留原精度，最多 6 位小數） |
| 無座標、有名稱與地址 | `名稱, 地址` |
| 無座標、只有名稱 | `名稱` |
| 無座標也無名稱 | 整個函式回傳 `null`（介面不顯示連結） |

起點與終點各自獨立判斷；可以一端用座標、另一端用名稱。

## travelmode 對應

| 交通方式 | travelmode |
|----------|------------|
| JR／電車 `rail`、巴士 `bus`、渡輪 `ferry` | `transit` |
| 步行 `walk` | `walking` |
| 計程車 `taxi`、自駕 `drive` | `driving` |
| 飛機 `flight`、其他 `other`、未設定 `null` | 省略參數 |

## 介面呈現

- 連結文字：「在 Google 地圖開啟」，附 lucide `ExternalLink` 圖示。
- `target="_blank"`、`rel="noopener noreferrer"`。
- 無障礙名稱包含起訖，例如「在 Google 地圖開啟：岡山後樂園 → 岡山城」。

## 測試案例（單元測試必須涵蓋）

| # | origin | destination | mode | 預期 |
|---|--------|-------------|------|------|
| 1 | 座標 34.6672,133.9354 | 座標 34.6650,133.9360 | `rail` | `...origin=34.6672%2C133.9354&destination=34.665%2C133.936&travelmode=transit` |
| 2 | 座標 | 座標 | `walk` | travelmode=`walking` |
| 3 | 座標 | 座標 | `taxi` / `drive` | travelmode=`driving` |
| 4 | 座標 | 座標 | `flight` / `other` / `null` | 無 travelmode 參數 |
| 5 | 無座標「岡山城」、地址「岡山市北区丸の内2-3-1」 | 座標 | `bus` | origin 為「岡山城, 岡山市北区丸の内2-3-1」的編碼 |
| 6 | 無座標、只有名稱 | 無座標、只有名稱 | `ferry` | 兩端皆為名稱，travelmode=`transit` |
| 7 | 無座標也無名稱 | 任意 | 任意 | `null` |
