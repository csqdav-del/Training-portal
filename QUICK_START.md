# 🚀 QUICK START (Trop impatient pour lire le README complet)

## 3 commandes pour démarrer

```bash
# 1. Installe dépendances
npm install

# 2. Crée .env.local (voir plus bas)
cp .env.example .env.local
# ÉDITE .env.local avec tes clés API

# 3. Démarre l'app
npm run dev
```

→ Ouvre http://localhost:3000

---

## Les 3 clés API essentielles

Tu dois remplir `.env.local` avec :

### 1️⃣ Firebase (10 sec)
- Va https://console.firebase.google.com
- Crée projet `training-portal`
- Copie la config Web → colle dans `.env.local`

### 2️⃣ Strava (30 sec)
- Va https://www.strava.com/settings/api
- Create App → callback domain = `localhost:3000`
- Copie Client ID + Client Secret → `.env.local`

### 3️⃣ Google Fit (2 min)
- Va https://console.cloud.google.com
- Crée projet `training-portal`
- Enable Google Fit API
- Create OAuth Web app
- Copie Client ID → `.env.local`

---

## Deploy sur Netlify

```bash
# Push vers GitHub
git add .
git commit -m "First commit"
git push

# Sur netlify.com:
# 1. Add new site → Connect to GitHub → Select repo
# 2. Build command: npm run build
# 3. Publish: dist
# 4. Add env vars (de .env.local)
# 5. Done!
```

---

**Full docs** → lire README.md  
**Setup détaillé** → lire SETUP_CHECKLIST.md  
**Problème?** → Voir README troubleshoot

Voilà. Go! 🏊
