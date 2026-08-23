# ⚡ SETUP ULTRA SIMPLE (5 minutes)

David, c'est tout ce que tu dois faire. Copy-colle seulement.

---

## 1️⃣ FIREBASE (2 min)

Va ici → https://console.firebase.google.com/u/0/

Clique **"Add project"** → Nom: `training-portal` → Continue

Quand c'est créé, va dans **Project Settings** (engrenage en haut gauche)

Dans l'onglet **"Service Accounts"**, clique **"Generate new private key"**

Un JSON va télécharger. **Ne le perd pas**, c'est tes clés privées.

Ouvre le JSON, copie ces 6 valeurs dans le Slack:
```
apiKey: "AIzaSy..."
authDomain: "training-portal-xxxx.firebaseapp.com"
projectId: "training-portal-xxxx"
storageBucket: "training-portal-xxxx.appspot.com"
messagingSenderId: "1234567890"
appId: "1:1234567890:web:abc123..."
```

---

## 2️⃣ STRAVA (2 min)

Va ici → https://www.strava.com/settings/api

Clique **"Create an App"**

Remplis:
- **Application name**: Training Portal
- **Website**: training-portal-xxxxx.netlify.app *(tu vas le recevoir après)*
- **Authorization Callback Domain**: training-portal-xxxxx.netlify.app

Clique Create. T'as deux clés:
```
Client ID: 12345
Client Secret: abc123xyz...
```

Copie-les dans le Slack.

---

## 3️⃣ GOOGLE FIT (2 min)

Va ici → https://console.cloud.google.com/

Crée un **nouveau projet**: `training-portal`

Va dans **APIs & Services** → **Enable APIs and Services**

Cherche **"Google Fit"** → Enable

Va dans **Credentials** → **Create Credentials** → **OAuth 2.0 Client ID**

Quand ça demande type, choisis **"Web application"**

Add authorized redirect URI:
```
https://training-portal-xxxxx.netlify.app/callback
```

Copie le **Client ID** dans le Slack:
```
Client ID: 1234567890-abc123...apps.googleusercontent.com
```

---

## C'est tout!

Envoie-moi les 9 clés (6 Firebase + 2 Strava + 1 Google) et je configure tout.

Ton app sera live en 10 min après.

