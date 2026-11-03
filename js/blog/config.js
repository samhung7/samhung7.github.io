/* Blog settings.
   firebase: the web app config from the Firebase console (Project settings > Your apps > Web app). It is public by
   design; who may read and write what is decided by firestore.rules. While it is null the blog runs nowhere but in
   demo mode (add ?demo to any blog address: posts are kept in this browser only, to try the pages and the editor).
   ownerUid: the Firebase user id allowed to write (also in firestore.rules). The editor shows it after signing in. */
export const CONFIG = {
  firebase: null,
  ownerUid: "",
  site: "https://samhungstudio.com",
};
