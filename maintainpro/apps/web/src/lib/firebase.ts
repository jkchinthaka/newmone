import { FirebaseApp, getApps, initializeApp } from "firebase/app";

import { webEnv } from "./env";

const firebaseConfig = {
  apiKey: webEnv.VITE_FIREBASE_API_KEY,
  authDomain: webEnv.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: webEnv.VITE_FIREBASE_PROJECT_ID,
  storageBucket: webEnv.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: webEnv.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: webEnv.VITE_FIREBASE_APP_ID
};

export const firebaseApp: FirebaseApp | null = webEnv.VITE_FIREBASE_API_KEY
  ? getApps()[0] ?? initializeApp(firebaseConfig)
  : null;
