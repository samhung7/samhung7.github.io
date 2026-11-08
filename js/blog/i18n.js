/* The blog's words in 中文 and English, following the same 中/EN toggle and saved choice as the home page. */
const S = {
  zh: {
    blog: "Blog", blogTitle: "Blog · Samhung Studio", blogTagline: "寫給自己，也寫給路過的你。",
    all: "全部", viewList: "列表顯示", viewCards: "卡片顯示", noPosts: "還沒有文章。", noTagPosts: "這個標籤還沒有文章。", loading: "載入中…",
    loadFail: "載入失敗，請稍後再試。", notFound: "找不到這篇文章，可能已移除或尚未發佈。", back: "← 所有文章",
    minRead: "{n} 分鐘閱讀", notSetUp: "部落格即將開張。",
    share: "分享", copyLink: "複製連結", copied: "已複製連結", more: "更多…", copyFail: "無法複製，請手動複製網址",
    demo: "示範模式：文章只存在這個瀏覽器。", privacy: "隱私權",
    // editor
    editor: "編輯器", signIn: "以 Google 登入", signOut: "登出", notOwner: "這個帳號沒有編輯權限。",
    yourUid: "你的使用者 ID（填入 config.js 與 firestore.rules 的 ownerUid）：",
    newPost: "新文章", posts: "文章", drafts: "草稿", scheduled: "預約", published: "已發佈",
    untitled: "（未命名）", updated: "更新於 {d}", publishesAt: "預約 {d} 發佈", publishedAt: "{d} 發佈", lastUpdated: "最近更新 {d}",
    titlePh: "標題", bodyPh: "開始寫…（支援 Markdown：# 標題、**粗體**、*斜體*、- 清單、> 引用、[連結](網址)；圖片可直接貼上或拖進來）",
    slug: "網址", slugHint: "只能用英文小寫、數字和連字號（-），發佈後就不能改。", tags: "標籤", tagsPh: "輸入標籤後按 Enter",
    bold: "粗體", italic: "斜體", heading: "標題", list: "清單", numList: "編號清單", quote: "引用", link: "連結", image: "插入圖片（也可以直接貼上或拖進來）", code: "程式碼",
    preview: "預覽", write: "編輯", count: "{n} 字",
    saveDraft: "存成草稿", publishNow: "立即發佈", schedule: "預約發佈", scheduleAt: "發佈時間", update: "更新文章",
    unpublish: "改回草稿", del: "刪除", delAsk: "確定要刪除「{t}」嗎？刪除後無法復原。",
    localKept: "已自動暫存在這台裝置", localBack: "已載回這台裝置上尚未儲存的內容", localDrop: "捨棄暫存",
    saved: "已存成草稿", publishedOk: "已發佈", scheduledOk: "已預約在 {d} 發佈", updatedOk: "已更新", deleted: "已刪除",
    saveFail: "儲存失敗：{e}", needTitle: "請輸入標題", needBody: "請輸入內文", badSlug: "網址格式不對", slugTaken: "這個網址已經有文章了",
    pastTime: "預約時間要在現在之後", view: "查看", edit: "編輯", close: "關閉", unsaved: "有尚未儲存的變更，確定要離開嗎？",
    cancel: "取消", confirm: "確定", linkUrl: "連結網址", imageUrl: "圖片網址",
    picWidth: "圖片寬度", picFull: "滿版", picAlign: "對齊", pic_left: "置左", pic_center: "置中", pic_right: "置右",
    uploading: "圖片上傳中…", uploadFail: "圖片上傳失敗",
    // gallery
    gallery: "Gallery", galleryTitle: "Gallery · Samhung Studio", galleryTagline: "用鏡頭留下的片刻。", noPhotos: "還沒有照片。", noTagPhotos: "這個標籤還沒有照片。",
    photoNotFound: "找不到這張照片，可能已移除或尚未發佈。", backGallery: "← Gallery", prevPhoto: "上一張", nextPhoto: "下一張", prevPost: "上一篇", nextPost: "下一篇", enlarge: "放大",
    taken: "拍攝日期", camera: "相機", lens: "鏡頭", focal: "焦距", aperture: "光圈", shutter: "快門", iso: "ISO", settings: "參數",
    photos: "照片", uploadPhotos: "上傳照片", uploadingN: "上傳中 {i} / {n}…", dragHint: "拖曳縮圖可以調整在 Gallery 的順序（手機請先長按再拖曳）", orderSaved: "已更新順序",
    descPh: "說明（可留空）", needPhotoTitle: "發佈前請先輸入標題", photoDelAsk: "確定要刪除「{t}」嗎？刪除後無法復原。", exifNote: "上傳時自動從照片讀取，可以修改。",
  },
  en: {
    blog: "Blog", blogTitle: "Blog · Samhung Studio", blogTagline: "Notes for myself, and for you passing by.",
    all: "All", viewList: "List view", viewCards: "Card view", noPosts: "No posts yet.", noTagPosts: "No posts with this tag yet.", loading: "Loading…",
    loadFail: "Couldn't load. Please try again later.", notFound: "This post doesn't exist, or isn't published yet.", back: "← All posts",
    minRead: "{n} min read", notSetUp: "The blog opens soon.",
    share: "Share", copyLink: "Copy link", copied: "Link copied", more: "More…", copyFail: "Couldn't copy. Please copy the address yourself.",
    demo: "Demo mode: posts are kept in this browser only.", privacy: "Privacy",
    editor: "Editor", signIn: "Sign in with Google", signOut: "Sign out", notOwner: "This account can't edit the blog.",
    yourUid: "Your user id (put it in ownerUid in config.js and firestore.rules):",
    newPost: "New post", posts: "Posts", drafts: "Drafts", scheduled: "Scheduled", published: "Published",
    untitled: "(Untitled)", updated: "Updated {d}", publishesAt: "Publishes {d}", publishedAt: "Published {d}", lastUpdated: "Last updated {d}",
    titlePh: "Title", bodyPh: "Start writing… (Markdown: # heading, **bold**, *italic*, - list, > quote, [link](url); paste or drop pictures in)",
    slug: "Address", slugHint: "Lowercase letters, digits and - only. Fixed once published.", tags: "Tags", tagsPh: "Type a tag, press Enter",
    bold: "Bold", italic: "Italic", heading: "Heading", list: "List", numList: "Numbered list", quote: "Quote", link: "Link", image: "Add picture (or paste / drop one in)", code: "Code",
    preview: "Preview", write: "Write", count: "{n} characters",
    saveDraft: "Save draft", publishNow: "Publish now", schedule: "Schedule", scheduleAt: "Publish at", update: "Update post",
    unpublish: "Back to draft", del: "Delete", delAsk: "Delete “{t}”? This can't be undone.",
    localKept: "Kept on this device", localBack: "Restored unsaved changes from this device", localDrop: "Discard",
    saved: "Draft saved", publishedOk: "Published", scheduledOk: "Scheduled for {d}", updatedOk: "Updated", deleted: "Deleted",
    saveFail: "Couldn't save: {e}", needTitle: "Please add a title", needBody: "Please write something", badSlug: "That address isn't valid", slugTaken: "A post already uses this address",
    pastTime: "Pick a time in the future", view: "View", edit: "Edit", close: "Close", unsaved: "You have unsaved changes. Leave anyway?",
    cancel: "Cancel", confirm: "OK", linkUrl: "Link address", imageUrl: "Image address",
    picWidth: "Width", picFull: "Full", picAlign: "Align", pic_left: "Left", pic_center: "Center", pic_right: "Right",
    uploading: "Uploading picture…", uploadFail: "Couldn't upload the picture",
    gallery: "Gallery", galleryTitle: "Gallery · Samhung Studio", galleryTagline: "Moments, kept in light.", noPhotos: "No photos yet.", noTagPhotos: "No photos with this tag yet.",
    photoNotFound: "This photo doesn't exist, or isn't published yet.", backGallery: "← Gallery", prevPhoto: "Previous", nextPhoto: "Next", prevPost: "Previous", nextPost: "Next", enlarge: "Enlarge",
    taken: "Taken", camera: "Camera", lens: "Lens", focal: "Focal length", aperture: "Aperture", shutter: "Shutter", iso: "ISO", settings: "Settings",
    photos: "Photos", uploadPhotos: "Upload photos", uploadingN: "Uploading {i} / {n}…", dragHint: "Drag a thumbnail to change its place in the gallery (on a phone, hold it first)", orderSaved: "Order updated",
    descPh: "Description (optional)", needPhotoTitle: "Add a title before publishing", photoDelAsk: "Delete “{t}”? This can't be undone.", exifNote: "Read from the photo when uploaded; edit as you like.",
  },
};

export const lang = () => (document.documentElement.getAttribute("lang") === "en" ? "en" : "zh");
export const t = (k, v = {}) => (S[lang()][k] ?? S.zh[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? "");
export const fmtDate = (d, time = false) => new Intl.DateTimeFormat(lang() === "en" ? "en-US" : "zh-TW",
  { year: "numeric", month: lang() === "en" ? "short" : "long", day: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(d);
export function apply(root = document) {
  root.querySelectorAll("[data-t]").forEach((e) => { e.textContent = t(e.dataset.t); });
  root.querySelectorAll("[data-t-ph]").forEach((e) => { e.placeholder = t(e.dataset.tPh); });
  root.querySelectorAll("[data-t-label]").forEach((e) => { e.setAttribute("aria-label", t(e.dataset.tLabel)); e.title = t(e.dataset.tLabel); });
}
