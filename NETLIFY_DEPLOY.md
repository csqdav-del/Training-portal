# Deploy sur Netlify en 2 clics

## Étape 1: Va sur Netlify.com

https://app.netlify.com/

Clique **"Add new site"** → **"Import an existing project"**

---

## Étape 2: Connecte GitHub

Clique **"GitHub"** → Authorize → Sélectionne ton repo `training-portal`

---

## Étape 3: Configure le build

Remplis:
- **Build command**: `npm run build`
- **Publish directory**: `dist`

Clique **"Deploy site"**

→ Netlify va builder et te donner un domaine: `xxx.netlify.app`

**Note ce domaine, tu vas l'utiliser pour Strava + Google.**

---

## Étape 4: Ajoute les variables d'env

Dans Netlify:
1. Va dans **Site settings** → **Build & deploy** → **Environment**
2. Click **"Edit variables"**
3. Ajoute les 9 clés:

```
VITE_FIREBASE_API_KEY=xxx
VITE_FIREBASE_AUTH_DOMAIN=xxx
VITE_FIREBASE_PROJECT_ID=xxx
VITE_FIREBASE_STORAGE_BUCKET=xxx
VITE_FIREBASE_MESSAGING_SENDER_ID=xxx
VITE_FIREBASE_APP_ID=xxx
VITE_STRAVA_CLIENT_ID=xxx
VITE_STRAVA_CLIENT_SECRET=xxx
VITE_GOOGLE_CLIENT_ID=xxx
```

Redeploy (Netlify va le faire auto ou tu cliques le bouton).

---

## C'est live!

Va sur ton domaine `xxx.netlify.app` → Clique "Se connecter avec Google" → L'app marche!

