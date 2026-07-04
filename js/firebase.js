import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig =
  typeof __firebase_config !== "undefined"
    ? JSON.parse(__firebase_config)
    : {
        apiKey: "AIzaSyB8hC3rX_UuMIkdSdcswsez4n_7ZiDhJ6k",
        authDomain: "saida-demap.firebaseapp.com",
        projectId: "saida-demap",
        storageBucket: "saida-demap.firebasestorage.app",
        messagingSenderId: "28837173501",
        appId: "1:28837173501:web:2a1d090d06479c8681c694",
      };

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const appId =
  typeof __app_id !== "undefined" ? __app_id : "demap-estoque-app";
