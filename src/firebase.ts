import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

// ⚠️ REPLACE WITH YOUR FIREBASE CONFIG
// Get this from Firebase Console → Project Settings → Your apps
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "YOUR_PROJECT_ID",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

/**
 * signInWithPopup ne fonctionne pas dans la WebView Capacitor (pas de fenêtre
 * popup, et l'origine `capacitor://localhost` n'est pas un domaine autorisé).
 * En natif on passe donc par le SDK Google natif, puis on injecte le credential
 * obtenu dans le SDK JS pour que le reste de l'app (Firestore, ID token pour
 * les fonctions Netlify) fonctionne exactement pareil.
 */
export async function signInWithGoogle() {
  if (!Capacitor.isNativePlatform()) {
    return signInWithPopup(auth, googleProvider);
  }

  const result = await FirebaseAuthentication.signInWithGoogle();
  const idToken = result.credential?.idToken;
  if (!idToken) throw new Error('Connexion Google annulée ou sans jeton');
  return signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
}

export async function signOutUser() {
  if (Capacitor.isNativePlatform()) {
    await FirebaseAuthentication.signOut();
  }
  return signOut(auth);
}

export default app;
