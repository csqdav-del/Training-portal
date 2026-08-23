# 🎯 START HERE - Lis moi IMMÉDIATEMENT

David, voici ce que tu dois faire maintenant.

---

## 1. CE QUE TU VIENS DE RECEVOIR

Un projet React complet avec :
- ✅ Dashboard, Calendrier, Suivi poids, Compteur arrêt vape
- ✅ Design responsive (mobile + desktop)
- ✅ Structure Firebase prête
- ✅ Intégration Strava + Google Fit (en attente de clés)
- ✅ Doc complète

**Fichiers clés à lire:**
1. **QUICK_START.md** ← Lis ça si tu es impatient
2. **SETUP_CHECKLIST.md** ← Lis ça si tu veux l'ordre exact
3. **README.md** ← Lis ça pour tout comprendre
4. **ARCHITECTURE.md** ← Lis ça pour le fonctionnement interne

---

## 2. WHAT'S NEXT (Ordre exact)

### Semaine 1 : Setup

**Jour 1:**
- [ ] Installe Node.js si pas encore → https://nodejs.org (version 18+)
- [ ] Crée 3 comptes gratuits:
  - Firebase → https://console.firebase.google.com
  - Google Cloud → https://console.cloud.google.com
  - (Tu as déjà Strava)

**Jour 2-3:**
- [ ] Suis SETUP_CHECKLIST.md au complet (4 phases: Firebase, Strava, Google, Deploy)
- [ ] Crée fichier `.env.local` avec les 6 variables
- [ ] Run `npm install` + `npm run dev`
- [ ] Teste localement sur http://localhost:3000

**Jour 4:**
- [ ] Push vers GitHub (instructions dans README)
- [ ] Deploy sur Netlify (instructions dans README)
- [ ] Test sur ton domaine `xxx.netlify.app`

### Semaine 2-3 : Test avec vraies données

**Étape 1:**
- [ ] Connecte Strava
  - L'app sync tes séances vélo depuis Strava
  - Elles apparaissent dans Calendrier + Dashboard

**Étape 2:**
- [ ] Connecte Google Fit
  - L'app sync natation + course depuis Health Connect (via Google Fit)
  - Elles apparaissent dans Calendrier + Dashboard

**Étape 3:**
- [ ] Ajoute tes entrées de poids
  - Vu que tu logs poids dans Samsung Health, il faudra sync Phase 2
  - Pour l'instant: saisie manuelle dans l'app

**Étape 4:**
- [ ] Teste le compteur arrêt vape
  - Demo commence à J-15, tu peux changer la date

### Semaine 3+ : Itération

- [ ] Me donner du feedback (UI, bugs, features manquantes)
- [ ] On passe à Phase 2 (édition calendrier, stats avancées)
- [ ] Auto-sync Firestore (pas refresh manuel)

---

## 3. ORDRE EXACT FIREBASE + STRAVA + GOOGLE

**Important:** Fais-le dans cet ordre exactement.

### A. Firebase (10 min)

```
Console Firebase → Crée projet "training-portal"
↓
Enable Firestore Database (Test mode)
↓
Enable Authentication → Google provider
↓
Project Settings → Add Web App
↓
Copie config → Colle dans .env.local (6 lignes)
```

### B. Strava (5 min)

```
Strava Settings → API
↓
Create App
  - Name: Training Portal
  - Website: http://localhost:3000
  - Callback: localhost:3000
↓
Copie Client ID + Secret → .env.local (2 lignes)
```

### C. Google (15 min)

```
Google Cloud Console → Crée projet "training-portal"
↓
Enable API → Cherche "Google Fit" → Enable
↓
Create Credentials → OAuth 2.0 (Web Application)
  - Add redirect URI: http://localhost:3000/auth/callback
  - Add redirect URI: http://localhost:3000
↓
Copie Client ID → .env.local (1 ligne)
```

**Si t'es perdu à une étape**, relire README section SETUP (ÉTAPE 2/3/4).

---

## 4. TON .env.local FINAL DOIT RESSEMBLER À ÇA

```env
# Firebase
VITE_FIREBASE_API_KEY=AIzaSyB...
VITE_FIREBASE_AUTH_DOMAIN=training-portal.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=training-portal-xxxx
VITE_FIREBASE_STORAGE_BUCKET=training-portal-xxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abc123...

# Strava
VITE_STRAVA_CLIENT_ID=12345
VITE_STRAVA_CLIENT_SECRET=abc123...

# Google
VITE_GOOGLE_CLIENT_ID=1234567890-abc123...apps.googleusercontent.com
```

(Tes vraies clés bien sûr, pas les exemples)

---

## 5. COMMANDES CLÉS À SAVOIR

```bash
# Installe dépendances
npm install

# Lance l'app localement
npm run dev

# Build pour production
npm run build

# Et voilà!
```

---

## 6. PROBLÈMES COURANTS

| Problème | Solution |
|----------|----------|
| "Cannot find module 'react'" | `npm install` n'a pas marché. Re-run `npm install -g npm` puis `npm install` |
| "VITE_FIREBASE_API_KEY is not defined" | T'as pas créé `.env.local` → Re-read comment plus haut |
| "Strava login échoue" | Callback domain dans https://www.strava.com/settings/api n'est pas `localhost:3000` ou ton domaine Netlify |
| "L'app ne charge rien" | F12 → Console → Tu vois une erreur? Copycolle-la dans le chat |

---

## 7. JE SUIS LÀ POUR QUOI?

- Questions setup → Je réponds
- Bugs → Je fix
- Besoin Phase 2 features → On les build ensemble
- Données ne sync pas → Debug ensemble

**Dis-moi quand tu fais:**
1. ✅ `npm install` + `npm run dev` marche
2. ✅ Firebase setup complet
3. ✅ Strava connected
4. ✅ Google Fit connected
5. ✅ Deploy Netlify réussi

---

## ✅ CHECKLIST FINALE

Avant de me dire "c'est prêt":

- [ ] Node.js installé
- [ ] `.env.local` créé avec toutes les variables
- [ ] `npm install` a marché (pas d'erreurs)
- [ ] `npm run dev` lance sans erreurs
- [ ] http://localhost:3000 s'ouvre
- [ ] Tu peux cliquer "Se connecter avec Google"
- [ ] Dashboard affiche les 4 tabs
- [ ] Sur Netlify: domaine généré, deploy en cours
- [ ] Strava settings updated avec le domaine Netlify

Une fois tout ça ✅, on peut dire Phase 1 "MVP terminée" et passer aux vrais tests!

---

**Besoin d'aide?** Dis-moi à quelle étape tu es bloqué et je t'aide.

🚀 C'est parti!
