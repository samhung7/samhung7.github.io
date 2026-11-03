# 部落格設定（Firebase）

部落格的文章存在 Firebase Firestore，只有 Sam 的 Google 帳號能登入 `/blog/editor/` 寫文章。
在設定好之前，`/blog/` 會顯示「部落格即將開張」，首頁的 Journal 區塊不會出現。
想先試用，可以在任何部落格網址後面加 `?demo`（文章只存在這個瀏覽器），`?demo=0` 關掉。

## 一次性設定（約 10 分鐘）

1. 到 [Firebase console](https://console.firebase.google.com/) 新增專案（例如 `samhung-studio`），Google Analytics 可以不開。
2. **Build → Firestore Database → Create database**，地區選 `asia-east1`（台灣），先用 production mode。
3. **Build → Authentication → Get started → Sign-in method → Google → Enable**。
4. **Authentication → Settings → Authorized domains** 加入 `samhungstudio.com`（還有 `samhung7.github.io`）。
5. **Project settings → Your apps → Web（</>）** 新增一個 web app，把產生的 `firebaseConfig` 貼進 `js/blog/config.js` 的 `firebase:`。
   這組設定本來就是公開的，安全靠的是 `firestore.rules`。
6. 打開 `https://samhungstudio.com/blog/editor/`，用 Google 登入。頁面會顯示「你的使用者 ID」。
7. 把這個 ID 填進：
   - `js/blog/config.js` 的 `ownerUid`
   - `firestore.rules` 裡的 `OWNER_UID`
8. 部署規則與索引（在 repo 根目錄）：
   ```
   npm i -g firebase-tools
   firebase login
   firebase use --add        # 選剛剛的專案
   firebase deploy --only firestore
   ```
   也可以在 console 的 Firestore → Rules 直接貼上 `firestore.rules` 的內容；索引則會在第一次載入列表時，於瀏覽器 console 給一個建立連結。

## 圖片（Cloudflare R2，約 5 分鐘）

文章裡的圖片在編輯器上傳（工具列的圖片鈕，或直接貼上、拖進文字框），會先在瀏覽器縮成 JPEG（長邊最多 2000px），
再交給 `worker/` 這支 Cloudflare Worker 存進 R2，網址是 `https://img.samhungstudio.com/img/<雜湊>.jpg`。
Worker 只收 `OWNER_UID` 的上傳，做法跟 StoaTalk 的照片服務一樣。

1. Cloudflare dashboard → **R2** → Create bucket，名稱 `samhung-blog`。
2. 進這個 bucket → **Settings → Custom Domains → Connect Domain**，填 `img.samhungstudio.com`。
3. **My Profile → API Tokens → Create Token**，用「Edit Cloudflare Workers」範本，再加上 **Account → Workers R2 Storage → Edit**。
4. 到 GitHub repo 的 **Settings → Secrets and variables → Actions** 新增：
   - `CLOUDFLARE_API_TOKEN`：上一步的 token
   - `CLOUDFLARE_ACCOUNT_ID`：Cloudflare dashboard 右側的 Account ID
5. `worker/wrangler.toml` 的 `PROJECT_ID` 和 `OWNER_UID` 要填上 Firebase 專案 ID 和你的使用者 ID（給我，我來改）。
   合併到 main 後，Actions 的「Deploy picture service」會自動部署到 `blog-api.samhungstudio.com`。

## 怎麼運作

- **草稿**：`status: "draft"`，只有你看得到。編輯時內容也會每 0.8 秒暫存在這台裝置，關掉分頁也不會掉（跟 StoaTalk 長文一樣）。
- **預約發佈**：`status: "published"` 加上未來的 `publishAt`。規則讓其他人在那個時間之前讀不到，時間到就自動出現，不需要伺服器排程。
- **網址**：`/blog/<網址>/`。發佈後就固定。GitHub Pages 找不到檔案時會給 `404.html`，它就是文章頁，所以新文章發佈後立刻能看。
- **分享預覽**：`.github/workflows/blog.yml` 每 30 分鐘跑 `tools/build-blog.mjs`，替每篇已發佈的文章產生 `blog/<網址>/index.html`（含標題、摘要、第一張圖的 og 標籤）和 `sitemap.xml`，讓 LINE、Facebook、X、Threads 貼上連結時有預覽。也可以在 Actions 頁面手動執行。
- **圖片**：上傳後在文字裡是一行 `![](圖片網址)`，`[ ]` 裡寫的字會成為圖說。第一張圖也會當分享預覽的封面。刪掉文字裡的圖片不會刪 R2 的檔案（同一張圖只存一份）。
- **Markdown**：`#`/`##`/`###` 標題、`**粗體**`、`*斜體*`、`` `程式碼` ``、``` 區塊、`- ` 與 `1. ` 清單、`> ` 引用、`---` 分隔線、`[文字](網址)`、`![說明](圖片網址)`。所有文字都會被跳脫，不會執行 HTML。
- **快捷鍵**：編輯器裡 ⌘/Ctrl+S 儲存、⌘/Ctrl+B 粗體、⌘/Ctrl+I 斜體。
