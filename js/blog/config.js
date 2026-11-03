/* Blog settings.
   firebase: the web app config from the Firebase console (Project settings > Your apps > Web app). It is public by
   design; who may read and write what is decided by firestore.rules. While it is null the blog runs nowhere but in
   demo mode (add ?demo to any blog address: posts are kept in this browser only, to try the pages and the editor).
   images: the picture service (worker/, a Cloudflare Worker) and the public address of the R2 bucket it fills.
   ownerUid: the Firebase user id allowed to write (also in firestore.rules). The editor shows it after signing in. */
export const CONFIG = {
  firebase: {
    apiKey: "AIzaSyAcR6yZeNte3QyPYC0EXV7h-7TR2FXWUmg",
    authDomain: "samhung-studio.firebaseapp.com",
    projectId: "samhung-studio",
    storageBucket: "samhung-studio.firebasestorage.app",
    messagingSenderId: "381227398897",
    appId: "1:381227398897:web:b078ffb56ab36459471b50",
  },
  ownerUid: "",
  images: { api: "https://blog-api.samhungstudio.com", host: "https://img.samhungstudio.com" },
  site: "https://samhungstudio.com",
};
