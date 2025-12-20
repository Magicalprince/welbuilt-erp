import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics, isSupported } from "firebase/analytics";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCZnsaqsFMlXfmG5P_rCPkUav_9UNpQubg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "erp-45f28.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "erp-45f28",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "erp-45f28.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "775947373392",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:775947373392:web:6cf89ae9262e3358577a55",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-JSR6ZC64S8"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize Analytics conditionally (only in browser)
export const initAnalytics = async () => {
  if (await isSupported()) {
    return getAnalytics(app);
  }
  return null;
};
