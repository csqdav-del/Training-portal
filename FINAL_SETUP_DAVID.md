# 🎯 FINAL SETUP - 10 minutes pour être LIVE

David, c'est les 3 dernières étapes. Après ça, l'app est en direct!

---

## ÉTAPE 1: Crée le repo GitHub (2 min)

1. Va https://github.com/new
2. **Repository name**: `training-portal`
3. Click **"Create repository"**

Copie les commandes que GitHub te donne (ou utilise celles-ci):

```bash
git branch -M main
git remote add origin https://github.com/csqdav_del/training-portal.git
git push -u origin main
```

(Change `csqdav_del` par ton username si différent)

GitHub va te demander ton token. Va https://github.com/settings/tokens, crée un token, copie-le.

---

## ÉTAPE 2: Va sur Netlify (2 min)

1. Va https://app.netlify.com/
2. Click **"Add new site"** → **"Import an existing project"**
3. Sélectionne **GitHub** → Authorize → Sélectionne `training-portal`
4. Configure:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
5. Click **"Deploy site"**

Netlify va builder. Attends ~2-3 min.

**Note le domaine**: `xxx.netlify.app`

---

## ÉTAPE 3: Ajoute les 9 clés (2 min)

Dans Netlify:
1. Va **Site settings** → **Build & deploy** → **Environment**
2. Click **"Edit variables"**
3. Ajoute ces 9 clés exactement:

```
VITE_FIREBASE_API_KEY=AIzaSyD_YXJb5bWtCKc0iEyeLmEDqvuWKsfrJFY
VITE_FIREBASE_AUTH_DOMAIN=training-portal-a9335.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=training-portal-a9335
VITE_FIREBASE_STORAGE_BUCKET=training-portal-a9335.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=101721516054
VITE_FIREBASE_APP_ID=1:101721516054:web:515f8a7bc4151a7eb6ed37
VITE_STRAVA_CLIENT_ID=274149
VITE_STRAVA_CLIENT_SECRET=c9b92943eb7c7550902e17593c65bf4d77f3fffd
VITE_GOOGLE_CLIENT_ID=174673752624-gi3itdcqu5s54ij2a045gjvcaeqfqtea.apps.googleusercontent.com
```

Click **Save** → Netlify va redeploy automatiquement (~1 min)

---

## ✅ C'EST LIVE!

Va sur **`https://xxx.netlify.app`** (ton domaine)

- Clique **"Se connecter avec Google"**
- L'app marche!

---

## 🎉 PROCHAINES ÉTAPES

Teste:
1. ✅ Login fonctionne
2. ✅ Dashboard affiche les 4 tabs
3. ✅ Connecte Strava (ton icône apparaît)
4. ✅ Connecte Google Fit (tes séances sync)
5. ✅ Ajoute du poids
6. ✅ Regarde le compteur arrêt vape

---

**C'est parti? Dis-moi quand tu as besoin d'aide!** 🚀
