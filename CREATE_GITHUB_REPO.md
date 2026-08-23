# Crée ton GitHub Repo en 30 secondes

## Étape 1: Sur GitHub.com (1 min)

1. Va https://github.com/new
2. Remplis:
   - **Repository name**: `training-portal`
   - Laisse tout le reste par défaut
3. Click **"Create repository"**

→ Tu vas avoir une page qui te donne des commandes. **Copie pas**, j'ai le script pour toi.

---

## Étape 2: Sur ton ordinateur (Terminal/PowerShell)

Dans le dossier `training-portal`, run:

```bash
git init
git add .
git commit -m "Initial commit: Training Portal"
git branch -M main
git remote add origin https://github.com/csqdav_del/training-portal.git
git push -u origin main
```

(Change `csqdav_del` par ton username GitHub si c'est pas ça)

---

## Ça va te demander username + password

Utilise ton GitHub username + un token personnel.

Pour créer un token:
1. Va https://github.com/settings/tokens
2. Click "Generate new token"
3. Donne-lui accès à `repo`
4. Copy le token
5. Colle-le quand Git le demande (à la place du password)

---

## C'est fait!

Ton code est maintenant sur GitHub. Dis-moi quand c'est fait!
