# ✅ CHECKLIST DE SETUP - Training Portal

Suit cet ordre exact. Chaque ✅ = tu peux passer à la suivante.

---

## 📋 PHASE A : PRÉPARATION (5-10 min)

- [ ] **A1**: Tu as Node.js installé? (https://nodejs.org - version 18+)
  - Test: ouvre terminal → `node --version`

- [ ] **A2**: Tu as Git installé?
  - Test: `git --version`

- [ ] **A3**: Tu as un compte GitHub?
  - Crée-le si besoin: https://github.com/signup

---

## 🔐 PHASE B : FIREBASE SETUP (10 min)

- [ ] **B1**: Va sur Firebase Console → https://console.firebase.google.com
  - Crée un nouveau projet nommé `training-portal`

- [ ] **B2**: Enable Firestore Database
  - Start in test mode (OK pour dev)

- [ ] **B3**: Enable Authentication → Google provider

- [ ] **B4**: Dans Project Settings → "Tes apps" → Crée une app Web
  - Copie-colle la config dans `.env.local` (voir README section ÉTAPE 2)

✅ **Firebase est setup quand tu as ce .env.local**:
```env
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx
```

---

## 🚴 PHASE C : STRAVA SETUP (5 min)

- [ ] **C1**: Va sur Strava Settings → https://www.strava.com/settings/api

- [ ] **C2**: Click "Create an App"
  - Application name: `Training Portal`
  - Website: `http://localhost:3000`
  - Authorization Callback Domain: `localhost:3000`

- [ ] **C3**: Copie **Client ID** et **Client Secret**

- [ ] **C4**: Ajoute dans `.env.local`:
```env
VITE_STRAVA_CLIENT_ID=xxx
VITE_STRAVA_CLIENT_SECRET=xxx
```

---

## 🏥 PHASE D : GOOGLE FIT SETUP (10 min)

- [ ] **D1**: Va sur Google Cloud Console → https://console.cloud.google.com

- [ ] **D2**: Crée un nouveau projet: `training-portal`

- [ ] **D3**: Enable Google Fit API
  - Search "Google Fit" → Enable

- [ ] **D4**: Create OAuth 2.0 Credentials
  - Type: Web Application
  - Authorized redirect URIs:
    - `http://localhost:3000/auth/callback`
    - `http://localhost:3000` (add)

- [ ] **D5**: Copie le **Client ID**

- [ ] **D6**: Ajoute dans `.env.local`:
```env
VITE_GOOGLE_CLIENT_ID=xxx
```

---

## 💻 PHASE E : DEV LOCAL (5 min)

- [ ] **E1**: Clone le repo (tu le recevras)
  ```bash
  git clone https://github.com/YOUR_USERNAME/training-portal.git
  cd training-portal
  ```

- [ ] **E2**: Installe dépendances
  ```bash
  npm install
  ```

- [ ] **E3**: Crée `.env.local` avec toutes les variables des phases B/C/D

- [ ] **E4**: Démarre l'app
  ```bash
  npm run dev
  ```

- [ ] **E5**: Ouvre http://localhost:3000
  - Clique "Se connecter avec Google"
  - L'app charge sans erreur = ✅

---

## 🌐 PHASE F : NETLIFY DEPLOY (10 min)

- [ ] **F1**: Va sur Netlify → https://app.netlify.com

- [ ] **F2**: Click "Add new site" → "Import an existing project"

- [ ] **F3**: Authorize GitHub + sélectionne ton repo `training-portal`

- [ ] **F4**: Configure le build:
  - Build command: `npm run build`
  - Publish directory: `dist`

- [ ] **F5**: Click "Deploy"
  - Attends ~2-3 min
  - Netlify te donne un domaine: `xxx.netlify.app`

- [ ] **F6**: Dans Netlify → Site settings → Build & deploy → Environment
  - Ajoute chaque variable `.env.local` (FIREBASE_*, STRAVA_*, GOOGLE_*)

---

## 🔄 PHASE G : UPDATE STRAVA + GOOGLE (5 min)

- [ ] **G1**: Va dans Strava Settings API
  - Change **Authorization Callback Domain** de `localhost:3000` → `xxx.netlify.app`

- [ ] **G2**: Va dans Google Cloud Console
  - OAuth 2.0 Credentials → Add authorized redirect URI:
    - `https://xxx.netlify.app/auth/callback`
    - `https://xxx.netlify.app`

- [ ] **G3**: Retourne sur Netlify → Trigger un redeploy (ou juste attends qu'il se redéploie)

---

## ✨ PHASE H : TESTS (5 min)

- [ ] **H1**: Ouvre https://xxx.netlify.app dans le navigateur

- [ ] **H2**: Click "Se connecter avec Google"
  - Approuve les permissions

- [ ] **H3**: Vas dans chaque tab du dashboard:
  - 📊 Tableau de bord = voir les stats mock
  - 📅 Calendrier = voir les séances
  - ⚖️ Poids = ajouter une entrée
  - 🎯 Arrêt Vape = voir le compteur

- [ ] **H4**: Test sur mobile
  - L'app doit être responsive

✅ **Si tout fonctionne = Phase 1 est complète!**

---

## 🚨 TROUBLESHOOT RAPIDE

| Problème | Solution |
|----------|----------|
| "Cannot find module 'react'" | `npm install` n'a pas marché → Re-run `npm install` |
| Firebase auth fails | Vérifie `.env.local` contre Firebase Console → copie exactement |
| Strava login échoue | Vérifie callback domain dans https://www.strava.com/settings/api |
| Rien ne s'affiche | Check console (F12) → vois-tu des erreurs? |
| "VITE_* not defined" | Les env vars ne sont pas dans Netlify → va à Netlify Site settings → Environment |

---

## 📞 PROCHAINES ÉTAPES

Une fois Phase 1 déployée:

1. On teste avec **tes vraies données** Strava + Samsung Health
2. On setup les Cloud Functions pour sync automatique
3. On passe à Phase 2 (drag-drop, édition, stats avancées)

**C'est parti ?** Dis-moi quand tu commences et on iterate ensemble ! 🚀
