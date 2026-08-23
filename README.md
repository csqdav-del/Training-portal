# 🏊🚴🏃 Training Portal - Triathlon 2027

Application web complète pour tracker ton entraînement triathlon avec sync Strava + Samsung Health.

## 🎯 Fonctionnalités Phase 1

- **Dashboard** : Résumé semaine (natation, vélo, course, muscu)
- **Calendrier interactif** : Vue semaine de tes séances
- **Suivi du poids** : Entrées manuelles + graphique tendance
- **Compteur arrêt vapoteuse** : Timer + économies + santé
- **Zones d'entraînement** : Basées sur FC max 192 bpm (28 ans)
- **Responsive** : Mobile + Desktop
- **Sync** : Strava (vélo) + Samsung Health via Google Fit (natation/course)

---

## 🚀 SETUP - Step by Step

### ÉTAPE 1 : Cloner et Installer

```bash
# Clone le repo (tu vas le faire après qu'on push sur GitHub)
git clone https://github.com/YOUR_USERNAME/training-portal.git
cd training-portal

# Installe les dépendances
npm install
```

### ÉTAPE 2 : Créer l'app Firebase

1. Va à https://console.firebase.google.com
2. Click "Créer un projet" → Nom: "training-portal"
3. Enable Firestore Database (mode test = OK pour départ)
4. Enable Authentication → Google Sign-in
5. Dans Project Settings → "Tes apps" → Web → Copie la config
6. Crée un `.env.local` à la racine du projet :

```env
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx
```

### ÉTAPE 3 : Créer l'app Strava

1. Va à https://www.strava.com/settings/api
2. Click "Create an App"
3. Remplis :
   - **Application name**: "Training Portal"
   - **Website**: `http://localhost:3000` (pour dev local)
   - **Authorization Callback Domain**: `localhost:3000`
4. Copie le **Client ID** et **Client Secret**
5. Ajoute dans `.env.local` :

```env
VITE_STRAVA_CLIENT_ID=xxx
VITE_STRAVA_CLIENT_SECRET=xxx
```

### ÉTAPE 4 : Setup Google Fit (pour Samsung Health)

1. Va à https://console.cloud.google.com
2. Crée un nouveau projet: "Training Portal"
3. Enable "Google Fit API"
4. Create OAuth 2.0 credentials (Web Application)
5. Add authorized redirect URIs:
   - `http://localhost:3000/auth/callback`
   - `https://yournetlifydomain.netlify.app/auth/callback`
6. Copie le **Client ID**
7. Ajoute dans `.env.local` :

```env
VITE_GOOGLE_CLIENT_ID=xxx
```

### ÉTAPE 5 : Lancer en local

```bash
npm run dev
```

L'app s'ouvre sur `http://localhost:3000`

---

## 🌐 DÉPLOYER SUR NETLIFY

### Option A : Via GitHub UI (Recommandé)

1. **Push ton repo sur GitHub**:
   ```bash
   git add .
   git commit -m "Initial commit: Training Portal Phase 1"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/training-portal.git
   git push -u origin main
   ```

2. **Sur Netlify** (https://netlify.com) :
   - Click "Add new site" → "Import an existing project"
   - Sélectionne GitHub + authorize
   - Sélectionne ton repo `training-portal`
   - Configure:
     - **Build command**: `npm run build`
     - **Publish directory**: `dist`
   - Click "Deploy"

3. **Netlify génère un domaine** : `your-site.netlify.app`

4. **Update Strava + Google**: Change les callback domains vers ce domaine Netlify

### Option B : Via Netlify CLI (si tu veux tester avant push)

```bash
npm install -g netlify-cli
netlify deploy
```

---

## 🔑 VARIABLES D'ENVIRONNEMENT NETLIFY

Une fois le site créé sur Netlify :

1. Va dans **Site settings** → **Build & deploy** → **Environment**
2. Click **Edit variables**
3. Ajoute chaque variable du `.env.local`

→ Netlify lira automatiquement ces variables lors du build.

---

## 📱 UTILISATION

### Login
- Click "Se connecter avec Google"
- Approuve les permissions

### Dashboard
- Voir résumé de la semaine
- Vois tes zones d'entraînement
- Graph du poids (si entrées)

### Calendrier
- Vue semaine de tes entraînements
- Sync auto de Strava (vélo) + Google Fit (natation/course)
- Clic sur un jour = détails séance

### Poids
- Ajoute entrées manuelles
- Voir tendance
- Sync avec Samsung Health (optionnel)

### Arrêt Vapoteuse
- Compteur qui tourne (démarre à J-15 de demo)
- Voir économies + bénéfices santé
- Reset si besoin

---

## 🔌 PROCHAINES ÉTAPES (Phase 2+)

- [ ] Drag-drop calendrier (réorganiser séances)
- [ ] Créer/éditer séances directement
- [ ] Stats détaillées par séance (zones HR, effort)
- [ ] Notifications rappels d'entraînement
- [ ] Export PDF/CSV
- [ ] Mode offline (PWA)
- [ ] Intégration Google Fit complète
- [ ] Webhook Strava pour sync live

---

## 🛠️ TROUBLESHOOT

### "Firebase not initialized"
→ Vérifie `.env.local` (copier-coller les variables Firebase depuis console)

### "Strava login fails"
→ Vérifie que le callback domain dans Strava settings = ton domaine local ou Netlify

### "App build fails sur Netlify"
→ Vérifie que les env vars sont configurées dans Netlify site settings

### "Poids/santé ne sync pas"
→ C'est normal Phase 1 (sera en Phase 2), pour l'instant = saisie manuelle seulement

---

## 📚 ARCHITECTURE

```
src/
├── components/        # React components
│   ├── Dashboard.tsx
│   ├── Calendar.tsx
│   ├── WeightTracker.tsx
│   └── VapingCounter.tsx
├── types/            # TypeScript types
│   └── index.ts
├── firebase.ts       # Firebase config
├── App.tsx           # Main app
├── main.tsx          # Entry point
└── index.css         # Tailwind styles
```

---

## 💾 BASE DE DONNÉES (Firestore)

Collections attendues:

```
users/
  {userId}/
    profile
    lastSyncStrava
    lastSyncHealth

workouts/
  {workoutId}
    userId, date, type, distance, duration, etc.

weights/
  {weightId}
    userId, date, weight, notes

vaping/
  {userId}
    startDate, lastQuitDate, streak
```

→ On crée les Cloud Functions pour les sauver au fur et à mesure

---

## 📞 QUESTIONS ?

- Firebase issues? → https://console.firebase.google.com
- Strava API? → https://developers.strava.com
- Google Fit? → https://developers.google.com/fit
- Netlify deploy? → https://docs.netlify.com

---

**Status**: Phase 1 MVP ✅  
**Last Updated**: August 2026  
**Next Review**: Après premiers tests avec données réelles Strava + Health
