# Contract: 地點座標輸入解析

**Function**: `parseLocationInput(text: string): LocationParseResult`

**Location**: `src/shared/geo/locationInput.ts`（純函式，無副作用、不連網）

```ts
type LocationParseResult =
  | { ok: true; coordinates: { lat: number; lng: number }; name?: string }
  | { ok: false; reason: "empty" | "short-url" | "out-of-range" | "unrecognized" };
```

## 接受的輸入

輸入先 `trim()`；空字串回傳 `empty`。

### 1. 純座標

```text
<緯度> , <經度>
```

- 逗號前後可有任意空白；數字可帶正負號與小數點，例如 `34.6672, 133.9354`、`34.6672,133.9354`、`-33.8568, 151.2153`。
- 數值超出緯度 [−90, 90] 或經度 [−180, 180] → `out-of-range`。

### 2. 電腦版 Google 地圖網址

主機為 `google.<tld>` 或 `www.google.<tld>`（含 `google.com`、`google.com.tw`、`google.co.jp` 等），路徑以 `/maps` 開頭。座標取用優先順序：

1. 資料段中的地點座標 `!3d<緯度>!4d<經度>`（地點本身的位置）。
2. 路徑中的 `@<緯度>,<經度>,<縮放>z`（地圖畫面中心）。
3. 查詢參數 `q`、`query`、`ll`、`destination` 中符合純座標格式的值。

找不到任何座標 → `unrecognized`。

**名稱**：路徑含 `/maps/place/<名稱>/` 時，取 `<名稱>` 做 `decodeURIComponent` 並將 `+` 轉為空白，回傳於 `name`；名稱本身是座標格式時不回傳。

### 3. 短網址

主機為 `maps.app.goo.gl`、`goo.gl`（路徑 `/maps`）或 `g.co`（路徑 `/kgs`）→ `short-url`。

### 4. 其他

其餘內容一律 `unrecognized`。

## 介面提示（繁體中文）

| reason | 提示 |
|--------|------|
| `short-url` | 「無法讀取手機分享的短網址。請在 Google 地圖長按（或在電腦上按右鍵）地點，複製畫面上的座標（例如 34.6672, 133.9354）後貼上；或改貼電腦版瀏覽器網址列中的網址。」 |
| `out-of-range` | 「座標超出範圍：緯度需在 −90 到 90、經度需在 −180 到 180 之間。」 |
| `unrecognized` | 「無法從貼上的內容取得座標。請貼上座標（例如 34.6672, 133.9354）或電腦版 Google 地圖網址；也可以改用手動輸入名稱。」 |
| `empty` | 不顯示錯誤（欄位尚未填寫） |

解析失敗時不得保存任何座標；使用者可修正輸入或改用手動輸入。

## 測試案例（單元測試必須涵蓋）

| # | 輸入 | 預期 |
|---|------|------|
| 1 | `34.6672, 133.9354` | ok，34.6672 / 133.9354 |
| 2 | `34.6672,133.9354` | ok |
| 3 | `  -33.8568 ,151.2153  ` | ok，負緯度 |
| 4 | `91, 10` | `out-of-range` |
| 5 | `https://www.google.com/maps/@34.6672,133.9354,15z` | ok，取 `@` 座標，無 name |
| 6 | `https://www.google.com/maps/place/岡山後樂園/@34.6680,133.9340,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d34.6672!4d133.9354` | ok，取 `!3d!4d` 的 34.6672 / 133.9354（非 `@`），name 為「岡山後樂園」 |
| 7 | 同上但名稱為 URL 編碼 `%E5%B2%A1%E5%B1%B1%E5%9F%8E`，含 `+` 的英文名稱 `Okayama+Castle` | name 正確 decode 為「岡山城」／「Okayama Castle」 |
| 8 | `https://www.google.com.tw/maps/place/...` 或 `google.co.jp` | 與 `google.com` 相同處理 |
| 9 | `https://www.google.com/maps/search/?api=1&query=34.6672,133.9354` | ok，取 query 參數 |
| 10 | `https://maps.app.goo.gl/AbCdEf123` | `short-url` |
| 11 | `https://goo.gl/maps/AbCdEf123` | `short-url` |
| 12 | `https://www.google.com/maps/place/岡山城/`（無任何座標） | `unrecognized` |
| 13 | `岡山後樂園`、`https://example.com/@34.6,133.9,15z` | `unrecognized` |
| 14 | 空字串或只有空白 | `empty` |
