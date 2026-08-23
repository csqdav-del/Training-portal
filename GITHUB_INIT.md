# 🐙 Comment Push vers GitHub (pas de CLI!)

Si tu n'aimes pas Git CLI, tu peux tout faire via GitHub UI. Voici comment.

---

## Méthode 1: Via GitHub UI (RECOMMANDÉ - super simple)

### Étape 1: Crée un repo vide sur GitHub

1. Va sur https://github.com/new
2. Remplis:
   - **Repository name**: `training-portal`
   - **Description**: `Training app for triathlon - sync Strava + Samsung Health`
   - **Public** (ou Private si tu préfères)
   - **Initialize with README**: NON (pas de checkbox)
3. Click "Create repository"

### Étape 2: GitHub te donne des instructions

Copie **exactement** cette section:
```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/training-portal.git
git push -u origin main
```

### Étape 3: Terminal/PowerShell sur ta machine

Va dans le dossier du projet:
```bash
cd /chemin/vers/training-portal
```

Colle les commandes que GitHub t'a données:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/training-portal.git
git push -u origin main
```

→ Ça va te demander ton GitHub username + password (ou token)

### Étape 4: Vérifie

Va sur https://github.com/YOUR_USERNAME/training-portal

Tu devrais voir tous tes fichiers!

---

## Méthode 2: Via GitHub Desktop (Alternative)

Si tu veux une interface graphique:

1. Télécharge GitHub Desktop → https://desktop.github.com
2. Open app → File → Add Local Repository
3. Sélectionne le dossier `training-portal`
4. Click "Publish repository"
5. Remplis les infos → Click "Publish"

→ C'est fait!

---

## Après (pour les futures updates)

Chaque fois que tu modifies le code:

```bash
git add .
git commit -m "Description de tes changements"
git push
```

Ou via GitHub Desktop: juste un click!

---

## Si ça échoue

**Erreur: "fatal: destination path already exists"**
→ Efface le `.git` folder: `rm -rf .git` puis re-essaye

**Erreur: "Could not read Username"**
→ GitHub demande un token. Va https://github.com/settings/tokens et crée un token, puis colle-le au lieu du password

**Autre erreur?**
→ Google l'erreur exacte + demande-moi!

---

Voilà. Simple et rapide 🚀
