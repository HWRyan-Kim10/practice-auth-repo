// Firebase (CDN ESM imports)
// Note: We use CDN imports instead of npm dependencies because this repo's existing
// node_modules directory is root-owned, which blocks installs in this environment.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBAX9o7KXrjakXd-0qCm6nY_D8em6Raxus",
  authDomain: "practicing-auth-website.firebaseapp.com",
  projectId: "practicing-auth-website",
  storageBucket: "practicing-auth-website.firebasestorage.app",
  messagingSenderId: "708118442878",
  appId: "1:708118442878:web:838c46ee4f576df5c3392f",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);


