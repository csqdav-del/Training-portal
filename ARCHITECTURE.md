# 🏗️ ARCHITECTURE - Training Portal

Comment l'app fonctionne (haute vue).

---

## FLUX GLOBAL

```
User (toi)
    ↓
    ├─ Google Login
    │   ↓
    └─ App Frontend (React)
        ↓
        ├─ Sync Strava
        │  ├─ OAuth → strava.com
        │  └─ GET /api/v3/athlete/activities → Firestore
        │
        ├─ Sync Samsung Health (via Google Fit)
        │  ├─ OAuth → Google
        │  └─ GET /fitness/rest/v1/users/me/dataset → Firestore
        │
        └─ Firestore Database
           ├─ users/
           ├─ workouts/
           ├─ weights/
           └─ vaping/
```

---

## COMPOSANTS

### Frontend (src/components/)

| Component | Role | Données |
|-----------|------|---------|
| **App.tsx** | Main app, tab routing | Gère l'état global |
| **Dashboard** | Résumé semaine + stats | Workouts + Weights |
| **Calendar** | Vue semaine des séances | Workouts |
| **WeightTracker** | Suivi du poids | Weights |
| **VapingCounter** | Arrêt vapoteuse | Vaping dates |

### Backend (Firebase)

#### Collections

```javascript
// users/{userId}
{
  email: "david@example.com",
  name: "David Bibeau",
  age: 28,
  fcMax: 192,
  lastSyncStrava: Timestamp,
  lastSyncHealth: Timestamp
}

// workouts/{workoutId}
{
  userId: "user123",
  date: Timestamp,
  type: "swim" | "bike" | "run" | "strength",
  duration: 45, // minutes
  distance: 1.2, // km
  calories: 450,
  heartRate: { avg: 140, max: 160 },
  source: "strava" | "health_connect" | "manual",
  externalId: "strava_123456", // pour dedup
  syncedAt: Timestamp,

  // --- Saisie manuelle uniquement (id du doc préfixé "manual_") ---
  title: "Push day — haut du corps",
  rpe: 7,                       // effort ressenti /10
  exercises: [                  // musculation : le détail que Strava ne porte pas
    { name: "Développé couché", sets: 4, reps: 8, weightLbs: 155 }
  ],
  plannedSessionId: "w12-d3-swim", // séance du plan validée ou remplacée
  plannedWeekNumber: 12
}

// weights/{weightId}
{
  userId: "user123",
  date: Timestamp,
  weight: 87.5, // kg
  notes: "Matin"
}

// vaping/{userId}
{
  startDate: Timestamp,
  lastQuitDate: Timestamp,
  currentStreak: 15 // days
}
```

---

## API INTEGRATIONS

### 1. Strava OAuth

```
Flow:
1. User clique "Connect Strava"
2. Redirect vers strava.com/oauth/authorize
3. User authorise → Strava redirige vers app avec code
4. Frontend échange code contre access_token
5. Cloud Function fetch /athlete/activities
6. Parse + save dans workouts collection (type='bike')

Champs Strava → Workout:
- id → externalId
- type → type (filter bike only)
- distance → distance
- elapsed_time → duration
- average_heartrate → heartRate.avg
- max_heartrate → heartRate.max
```

### 2. Health Connect (Samsung Health)

> L'approche Google Fit REST décrite à l'origine est abandonnée : l'API est en fin
> de vie. Health Connect la remplace — mais il **n'a aucune API serveur**, les
> données vivent uniquement sur l'appareil. D'où l'app Android Capacitor.
> Détails complets : `HEALTH_CONNECT_SETUP.md`.

```
Flow:
1. User ouvre l'app Android (le même site, emballé avec Capacitor)
2. Clique "Autoriser Health Connect" → écran de permissions Android
3. L'app lit le magasin local (60 derniers jours) via @capgo/capacitor-health
4. POST du payload vers /.netlify/functions/health-sync + Firebase ID token
5. La fonction normalise, déduplique contre Strava, écrit via Admin SDK
6. Firestore pousse en temps réel vers le portail web ET l'app

Champs Health Connect → Workout:
- startDate           → date
- duration (secondes) → duration (pauses exclues)
- workoutType         → type ("running", "cycling", "swimmingPool"...)
- totalDistance (m)   → distance
- totalEnergyBurned   → calories
- heartRate (samples) → heartRate.avg / .max, recoupé par fenêtre temporelle
```

La fréquence cardiaque est le seul champ que le plugin ne rattache pas à la
séance : on retient les échantillons tombant entre le début et la fin.

### 3. Saisie manuelle d'un entraînement

Pour tout ce qui ne passe ni par Strava ni par la montre — typiquement la
musculation, que David ne veut pas mélanger aux sorties course/vélo/natation sur
Strava.

```
Points d'entrée (tous ouvrent LogWorkoutModal) :
- Tableau de bord → « Logger » sur une séance du jour (pré-remplit le formulaire)
- Tableau de bord → « Logger un autre entraînement » (formulaire vierge, muscu par défaut)
- Détail d'une journée → « J'ai fait ça » / « Remplacer » sur chaque séance
- Activités récentes → ✏️ pour modifier, 🗑 dans le formulaire pour supprimer

Écriture : users/{uid}/workouts/manual_{timestamp}, directement depuis le client.
Les règles Firestore n'autorisent l'écriture cliente que sur ce préfixe — impossible
donc de falsifier une activité Strava (strava_*) ou Health Connect (hc_*).
```

**Substitution.** Quand la discipline saisie diffère de celle du plan (piscine
fermée → muscu), le formulaire propose de marquer la séance comme remplacée :

- l'activité garde `plannedSessionId`, ce qui la relie à la séance prévue ;
- la séance reçoit `edits[sessionId].replacedBy = "strength"` dans
  `scheduleOverrides` ;
- au calendrier elle apparaît barrée avec « → 💪 » plutôt que de rester « à faire ».

C'est volontairement distinct de `skipped`, qui fait disparaître une séance
carrément abandonnée.

### 4. Weight Sync (Manual + Health Connect)

```
Manual:
- User ajoute poids dans WeightTracker
- Save direct dans weights collection

Health Connect:
- Records Weight + BodyFat lus par l'app Android
- Conversion kg → lbs (l'app affiche en lbs partout)
- Un doc par jour (id = YYYY-MM-DD), le relevé le plus récent gagne

Métriques quotidiennes (nouveau) — users/{uid}/dailyMetrics/{YYYY-MM-DD}:
- SleepSession    → sleepMinutes + répartition deep/rem/light/awake
- Steps           → steps (cumul de la journée)
- RestingHeartRate → restingHr
```

---

## DATA FLOW - EXAMPLE

### Scenario: User a une séance Strava (vélo)

```
1. User va dashboard, clique "Sync Strava"
2. Frontend call Strava OAuth endpoint
3. User approuve sur strava.com
4. Strava redirige → frontend reçoit access_token
5. Frontend envoie token à Firebase Cloud Function
6. Cloud Function:
   - Fetch https://www.strava.com/api/v3/athlete/activities
   - Parse la réponse:
     {
       "id": 9876543,
       "name": "Morning Ride",
       "type": "Ride",
       "distance": 35000, // meters
       "elapsed_time": 5400, // seconds
       "average_heartrate": 145,
       "max_heartrate": 170,
       ...
     }
   - Transform en Workout:
     {
       userId: "user123",
       externalId: "strava_9876543",
       type: "bike",
       distance: 35, // convert m→km
       duration: 90, // convert s→min
       heartRate: { avg: 145, max: 170 },
       source: "strava",
       date: Timestamp,
       syncedAt: now()
     }
   - Save dans firestore.workouts
7. Frontend recharge → Calendar affiche "🚴 Vélo 35km - 90min"
```

---

## SECURITY RULES

### Firestore Rules (draft)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Users can only read their own data
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Users can only read/write their own workouts
    match /workouts/{doc=**} {
      allow read, write: if request.auth.uid == resource.data.userId;
    }
    
    // Same for weights
    match /weights/{doc=**} {
      allow read, write: if request.auth.uid == resource.data.userId;
    }
  }
}
```

---

## RATE LIMITS & CONSIDERATIONS

### Strava API
- 600 requests/15min per app
- 30,000 requests/day per app
- For David: easily under limits

### Google Fit API
- 1,000,000 requests/day (free tier)
- Queries count as 1 request
- No issue for personal use

### Firebase
- Firestore: 1 write/sec per doc (sufficient)
- Free tier: 50K reads/day, 20K writes/day, 20K deletes/day

---

## NEXT PHASES

### Phase 2: Interactivity
- Drag-drop workouts on calendar
- Create/edit workouts (local override)
- Detailed stats per workout

### Phase 3: Advanced
- Automated scheduled sync (every 6 hours)
- Notifications (upcoming workouts)
- Export PDF/CSV
- Progressive Web App (offline mode)

### Phase 4: Polish
- Dark mode
- Performance optimization
- Analytics (training trends)
- Social features (Strava leaderboard integration)

---

## LOCAL DEV vs PRODUCTION

### Local (localhost:3000)

```env
VITE_STRAVA_CLIENT_ID=xxx
VITE_STRAVA_CLIENT_SECRET=xxx  
# Callback: localhost:3000
# Firebase emulator: optional
```

### Production (netlify.com)

```env
# Same vars, Netlify injects via Environment
# Callback: https://xxx.netlify.app
# Firebase: production database
```

No code changes needed - just env vars!

---

## TESTING CHECKLIST

- [ ] Firebase auth works (can login with Google)
- [ ] Can add weight entry
- [ ] Strava OAuth works (exchange code for token)
- [ ] Strava sync imports workouts
- [ ] Google Fit OAuth works
- [ ] Google Fit sync imports health data
- [ ] Calendar displays all synced workouts
- [ ] Responsive on mobile
- [ ] No console errors

---

Voilà. L'architecture est scalable et sécurisée. Questions?
