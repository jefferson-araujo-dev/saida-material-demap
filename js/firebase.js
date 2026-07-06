import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

<<<<<<< HEAD
// As credenciais agora são carregadas de forma segura através de variáveis de ambiente.
// Crie um arquivo .env na raiz do projeto com as chaves VITE_FIREBASE_*.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Validação para garantir que as variáveis de ambiente foram carregadas.
// Se alguma estiver faltando, um erro claro será lançado no console do desenvolvedor.
for (const key in firebaseConfig) {
  if (!firebaseConfig[key]) {
    throw new Error(
      `Variável de ambiente do Firebase ausente: VITE_FIREBASE_${key.replace("Id", "_ID").replace("Domain", "_DOMAIN").toUpperCase()}. Verifique seu arquivo .env e reinicie o servidor Vite.`,
    );
  }
}
=======
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
>>>>>>> 24d2cb891fc548c14a2e39aedda9bc6f613aead5

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
<<<<<<< HEAD
export const appId = import.meta.env.VITE_APP_ID || "demap-estoque-app";
=======
export const appId =
  typeof __app_id !== "undefined" ? __app_id : "demap-estoque-app";
>>>>>>> 24d2cb891fc548c14a2e39aedda9bc6f613aead5
