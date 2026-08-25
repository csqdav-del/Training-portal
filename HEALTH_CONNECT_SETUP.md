# Health Connect — mise en place

## Pourquoi une app Android

Health Connect **n'a pas d'API serveur**. Contrairement à Strava, il n'existe aucun lien
OAuth à cliquer : les données vivent uniquement dans le magasin local d'Android. Le code
qui les lit doit donc tourner sur le téléphone.

L'app Android est simplement le **même site**, emballé avec Capacitor. Le portail web
continue de fonctionner exactement comme avant — la carte Health Connect y affiche
« Disponible dans l'app Android ».

```
[Samsung Health] → [Health Connect (sur l'appareil)]
                          ↓  @capgo/capacitor-health
                   [App Android = le site + Capacitor]
                          ↓  POST + Firebase ID token
                   [netlify/functions/health-sync.ts]  (Admin SDK)
                          ↓
                   [Firestore] → temps réel → portail web + app
```

---

## Choix du plugin

Deux plugins ont été évalués :

| Plugin | Verdict |
|---|---|
| `capacitor-health-connect` | **Rejeté.** Ses types se limitent aux mesures ponctuelles — ni `ExerciseSession`, ni `SleepSession`, ni `Distance`. Donc ni entraînements ni sommeil. |
| `@capgo/capacitor-health` | **Retenu.** Couvre `workouts`, `sleep`, `steps`, `weight`, `bodyFat`, `restingHeartRate`, `heartRate`, `distance`, `calories`. |

Bonus du plugin retenu : `queryWorkouts()` porte déjà la distance et les calories dans la
séance (Health Connect les stocke normalement dans des enregistrements séparés), et
`queryAggregated()` fait la somme des pas par journée côté natif.

---

## Ce qui est déjà fait (code — compile, `npm run build` passe)

| Fichier | Rôle |
|---|---|
| `netlify/functions/health-sync.ts` | Reçoit le payload, normalise, déduplique contre Strava, écrit via Admin SDK |
| `src/lib/healthConnectPlugin.ts` | Adaptateur du plugin — **seul fichier à changer si on change de plugin** |
| `src/lib/healthConnect.ts` | Lecture, agrégation, POST |
| `src/lib/firestoreDailyMetrics.ts` | Abonnement temps réel aux métriques quotidiennes |
| `capacitor.config.ts` | Configuration de la coquille Android |
| `firestore.rules` | `dailyMetrics` en lecture seule côté client |

Destination des données :

| Health Connect | Firestore |
|---|---|
| `workouts` (+ `heartRate` recoupée par fenêtre) | `users/{uid}/workouts/hc_{id}` |
| `weight` + `bodyFat` | `users/{uid}/weights/{YYYY-MM-DD}` — **converti en lbs** |
| `sleep`, `steps`, `restingHeartRate` | `users/{uid}/dailyMetrics/{YYYY-MM-DD}` |

---

## Étapes restantes (nécessitent Android Studio + le téléphone)

### 1. Générer le projet Android

```bash
npx cap add android
```

### 2. Ajouter UNE permission au manifest

Le plugin déclare déjà toutes ses permissions Health Connect, le bloc `<queries>` et
l'activité de justification — Capacitor les fusionne automatiquement. **Une seule** doit
être ajoutée à la main dans `android/app/src/main/AndroidManifest.xml`, avant
`<application>` :

```xml
<uses-permission android:name="android.permission.health.READ_HEALTH_DATA_HISTORY" />
```

Sans elle, Health Connect **plafonne la lecture aux ~30 derniers jours**, alors que la
synchro remonte sur 60 jours comme celle de Strava. `requestPermissions()` la demande
déjà via `requestHistoryAccess: true`, mais la demande est ignorée si le manifest ne la
déclare pas.

Optionnel — pour l'écran « politique de confidentialité » qu'affiche Health Connect,
ajouter dans `android/app/src/main/res/values/strings.xml` :

```xml
<string name="health_connect_privacy_policy_url">https://…</string>
```

### 3. Connexion Google native

`@capacitor-firebase/authentication` a besoin de :

1. `google-services.json` (Firebase Console → paramètres du projet → ajouter une app
   Android avec l'appId `com.davidbibeau.trainingportal`) déposé dans `android/app/`.
2. L'**empreinte SHA-1** du certificat de signature ajoutée dans la Firebase Console :
   ```bash
   cd android && ./gradlew signingReport
   ```
   Sans ça, la connexion Google échoue silencieusement dans l'app.

### 4. Variable d'environnement

Dans `.env` (et dans les variables Netlify pour le build web) :

```
VITE_API_BASE=https://<ton-site>.netlify.app
```

Sans cette valeur, l'app Android POSTerait vers `capacitor://localhost` et la synchro
échouerait avec une erreur réseau.

### 5. Déployer les règles Firestore

```bash
firebase deploy --only firestore:rules
```

### 6. Construire et installer

```bash
npm run android:sync
```

```bash
npm run android:open
```

Dans Android Studio : *Build → Build APK*, puis installer l'APK sur le téléphone.
**Pas besoin du Play Store** — il exigerait une révision de la déclaration Health
Connect, inutile pour un usage personnel.

---

## Vérifications

1. **Connexion** : se connecter avec Google *dans l'app Android* → les activités Strava
   existantes se chargent.
2. **Permissions** : taper « Autoriser Health Connect » → l'écran système Android
   apparaît. Vérifier que l'accès à l'historique est proposé.
3. **Synchro** : taper « Synchroniser » → vérifier dans la console Firestore que
   `workouts/hc_*`, `weights/` et `dailyMetrics/` se remplissent.
4. **Déduplication** : prendre une journée avec une sortie vélo présente à la fois dans
   Strava et dans Health Connect → **une seule** entrée doit apparaître, celle de Strava.
   La réponse de la fonction indique `skippedAsDuplicate`.
5. **Poids** : un relevé Samsung de 80 kg doit s'afficher à ~176 lbs dans l'onglet Poids.
6. **Mapping des disciplines** : vérifier qu'une nage en piscine tombe bien en `swim` et
   une muscu en `strength` — le mapping vit dans `health-sync.ts` et n'a pas encore vu de
   vraies données Samsung.
7. **Non-régression web** : `npm run dev` sur desktop → tout fonctionne comme avant, la
   carte Health Connect affiche « Disponible dans l'app Android ».

---

## Points de friction connus

- **Permissions révoquées après ~30 jours** sans ouverture de l'app. Comme l'app est
  ouverte quotidiennement, ce n'est pas bloquant : `connectHealthConnect()` peut être
  rejoué à tout moment.
- **`READ_HEALTH_DATA_HISTORY` n'existe pas sur les vieux Health Connect** (avant
  l'extension Android 14 n°13 / APK 171302). Dans ce cas la lecture reste plafonnée à
  30 jours, sans erreur — c'est une dégradation silencieuse, pas une panne.
- **La FC des séances est recoupée par fenêtre temporelle** : le plugin ne rattache pas
  les échantillons de fréquence cardiaque aux séances, on prend ceux qui tombent entre le
  début et la fin. Approximatif si deux séances se chevauchent.
- **`npm run lint` est cassé** — et l'était avant ces changements : le projet n'a aucun
  fichier de configuration ESLint. Sans rapport avec Health Connect.
