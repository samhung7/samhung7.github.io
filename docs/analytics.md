# 網站流量統計

全站（首頁、部落格、隱私權頁）用自己的統計，不用 cookie、不存 IP。設計文件：
[Blog 流量分析 Dashboard](https://claude.ai/artifact/E7JzeGXtsYdmix4vMAWmK3)。隱私說明在 `/privacy/`。

## 怎麼運作

1. `js/blog/analytics.js`（每頁 `<script defer>`）把事件用 `sendBeacon` 送到 `https://blog-api.samhungstudio.com/e`。
2. `worker/src/analytics.js` 過濾爬蟲與其他網站的請求，算出當天有效的訪客雜湊，一個事件寫成 Workers Analytics Engine 的一筆
   （dataset `samhung_site_events`，約保留 3 個月）。欄位順序寫在該檔開頭。
3. 第二階段：每日彙總到 D1 與 `/blog/dashboard/`（只有 Sam 登入看得到）。

事件：`pageview`、`read`（讀完）、`leave`（捲動深度、前景秒數、Core Web Vitals）、`share`、`out`（外部連結）、
`lang`、`error`、`notfound`。分享按鈕的連結會帶 `?ref=line|fb|x|threads|copy|native`，有人點回來就算這個來源，
`analytics.js` 記下後會把 `ref`、`utm_*` 從網址列拿掉。

## 不統計

- 瀏覽器開了 Do Not Track 或 Global Privacy Control。
- 在 `/blog/editor/` 以 Sam 的帳號登入過的瀏覽器（localStorage `ss-no-track`）。
- 任何網址加 `?notrack` 後的這個瀏覽器；`?notrack=0` 恢復。
- `samhungstudio.com`、`samhung7.github.io` 以外的網址（本機測試不會送）。

## 一次性設定

1. Cloudflare dashboard → **Storage & Databases → Analytics Engine**（舊介面在 Workers & Pages 底下），
   如果看到 **Set up / Enable** 按鈕就按一次。之後部署 Worker 時 dataset 會自動建立。
2. （建議）GitHub repo → Settings → Secrets and variables → Actions 新增 `ANALYTICS_SECRET`，填一串長的亂碼
   （例如 `openssl rand -hex 32`）。這是訪客雜湊的金鑰；沒設時會改用 `DISPATCH_TOKEN`。
3. 合併後 `Deploy picture service` workflow 會部署 Worker；部署成功後打開網站任一頁，
   Cloudflare 的 Analytics Engine 頁面幾分鐘內就會看到 `samhung_site_events`。

## 本機看資料（第二階段前）

Analytics Engine 可用 SQL API 查，例如過去 7 天各文章的瀏覽數：

```sql
SELECT blob4 AS slug, SUM(_sample_interval) AS views
FROM samhung_site_events
WHERE blob1 = 'pageview' AND timestamp > NOW() - INTERVAL '7' DAY
GROUP BY slug ORDER BY views DESC
```

需要一個有 **Account Analytics: Read** 權限的 API token：
`curl https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/analytics_engine/sql -H "Authorization: Bearer <TOKEN>" -d "<SQL>"`
