# Guide d'Accès VPS et Consultation des Logs

## SSL certificate management (Certbot)

Use these steps to verify, renew, or reinstall certificates for `apidev.ubora-app.com` (and similarly for other domains) and reload Nginx.

```bash
# SSH into your VPS
ssh root@your-vps-ip

# Check current certificates
sudo certbot certificates

# Renew certificates for apidev.ubora-app.com
sudo certbot renew --cert-name apidev.ubora-app.com

# Or reinstall if missing
sudo certbot --nginx -d apidev.ubora-app.com

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

Ce guide vous explique comment accéder à votre serveur VPS et consulter les logs de votre application backend en temps réel.

## 📋 Prérequis

- Accès SSH à votre VPS
- Informations de connexion (IP, utilisateur, clé SSH ou mot de passe)
- Terminal ou client SSH (PuTTY, Windows Terminal, etc.)

## 🔧 Configuration de Déploiement

**Votre backend est déployé avec :**
- **Répertoire de production :** `/var/www/ubora-backend-prod`
- **Répertoire de développement :** `/var/www/ubora-backend-dev`
- **Nom du processus PM2 (prod) :** `ubora-backend-prod`
- **Nom du processus PM2 (dev) :** `ubora-backend-dev`
- **Port production :** `3000`
- **Port développement :** `3001`
- **Branche Git (prod) :** `master`
- **Branche Git (dev) :** `dev`
- **Repository :** `https://github.com/CamaireTech-Production/Ubora.git`

## 🔐 1. Connexion SSH au VPS

### Option A: Windows PowerShell (Recommandé)
```powershell
# Connexion SSH basique
ssh root@72.60.94.31

# Connexion avec clé SSH
ssh -i "path\to\your\private-key.pem" root@72.60.94.31

# Connexion sur un port spécifique (si différent de 22)
ssh -p 22 root@72.60.94.31
```

**Vos informations de connexion VPS :**
- **IP :** `72.60.94.31`
- **Utilisateur :** `root`
- **Port SSH :** `22` (par défaut)

### Option B: PuTTY (Interface graphique)
1. Ouvrez PuTTY
2. Entrez `72.60.94.31` dans "Host Name"
3. Port: 22
4. Cliquez "Open"
5. Entrez `root` comme utilisateur et votre mot de passe

### Option C: Windows Terminal
```powershell
# Dans Windows Terminal
ssh root@72.60.94.31
```

## 📁 2. Navigation vers le Répertoire de l'Application

Une fois connecté, naviguez vers votre application :

```bash
# Lister les répertoires
ls -la

# Aller dans le répertoire de production
cd /var/www/ubora-backend-prod

# OU aller dans le répertoire de développement
cd /var/www/ubora-backend-dev

# Vérifier la structure
ls -la
```

**Répertoires disponibles :**
- `/var/www/ubora-backend-prod` (répertoire de production - branche master)
- `/var/www/ubora-backend-dev` (répertoire de développement - branche dev)

## 🚀 3. Vérification du Statut de l'Application

### Vérifier si l'application est en cours d'exécution
```bash
# Vérifier les processus Node.js
ps aux | grep node

# Vérifier les processus sur le port 3000 (production)
netstat -tlnp | grep :3000

# Vérifier les processus sur le port 3001 (développement)
netstat -tlnp | grep :3001

# Ou avec ss (plus moderne)
ss -tlnp | grep :3000
ss -tlnp | grep :3001
```

### Vérifier les services systemd (si configuré)
```bash
# Statut du service de production
sudo systemctl status ubora-backend-prod

# Statut du service de développement
sudo systemctl status ubora-backend-dev

# Démarrer le service de production
sudo systemctl start ubora-backend-prod

# Démarrer le service de développement
sudo systemctl start ubora-backend-dev

# Redémarrer le service de production
sudo systemctl restart ubora-backend-prod

# Redémarrer le service de développement
sudo systemctl restart ubora-backend-dev
```

## 📊 4. Consultation des Logs en Temps Réel

### Option A: Logs de l'Application (PM2 - Recommandé)
```bash
# Vérifier les processus PM2
pm2 list

# Voir les logs en temps réel (tous les processus)
pm2 logs

# Logs de production
pm2 logs ubora-backend-prod

# Logs de développement
pm2 logs ubora-backend-dev

# Logs avec timestamps
pm2 logs --timestamp

# Logs des 100 dernières lignes
pm2 logs --lines 100

# Logs d'erreurs uniquement (production)
pm2 logs ubora-backend-prod --err

# Logs d'erreurs uniquement (développement)
pm2 logs ubora-backend-dev --err

# Logs en temps réel pour le développement (recommandé pour debug)
pm2 logs ubora-backend-dev -f

# Logs en temps réel pour la production
pm2 logs ubora-backend-prod -f
```

### Option B: Logs systemd
```bash
# Voir les logs du service
sudo journalctl -u ubora-backend-prod -f

# Logs des dernières 50 lignes
sudo journalctl -u ubora-backend-prod -n 50

# Logs avec timestamps
sudo journalctl -u ubora-backend-prod -f --since "1 hour ago"
```

### Option C: Logs de Fichiers
```bash
# Suivre les logs en temps réel
tail -f logs/app.log

# Logs avec numéros de ligne
tail -f -n 50 logs/app.log

# Logs des erreurs uniquement
tail -f logs/error.log
```

## 🔍 5. Commandes de Diagnostic Avancées

### Vérifier l'utilisation des ressources
```bash
# Utilisation CPU et mémoire
top
# ou
htop

# Utilisation disque
df -h

# Utilisation mémoire détaillée
free -h
```

### Vérifier les connexions réseau
```bash
# Connexions actives
netstat -an | grep :3000

# Connexions avec processus
lsof -i :3000

# Test de connectivité
curl http://localhost:3000/health
```

### Vérifier les logs système
```bash
# Logs système généraux
sudo tail -f /var/log/syslog

# Logs d'authentification
sudo tail -f /var/log/auth.log

# Logs du serveur web (si applicable)
sudo tail -f /var/log/nginx/error.log
```

## 🛠️ 6. Gestion de l'Application

### Redémarrer l'application

#### Pour l'environnement de PRODUCTION :
```bash
# Avec PM2 (recommandé)
pm2 restart ubora-backend-prod

# Avec systemd
sudo systemctl restart ubora-backend-prod

# Manuel (tuer le processus et redémarrer)
pkill -f "node.*server/production-server.js"
cd /var/www/ubora-backend-prod
npm start
```

#### Pour l'environnement de DÉVELOPPEMENT :
```bash
# Avec PM2 (recommandé)
pm2 restart ubora-backend-dev

# Avec systemd
sudo systemctl restart ubora-backend-dev

# Manuel (tuer le processus et redémarrer)
pkill -f "node.*server/dev-server.js"
cd /var/www/ubora-backend-dev
npm start
```

#### Redémarrer les deux environnements :
```bash
# Redémarrer production et développement
pm2 restart ubora-backend-prod ubora-backend-dev

# Ou redémarrer tous les processus PM2
pm2 restart all
```

### Déploiement par artefacts (recommandé) – Releases et symlink `current`

Le CI envoie une archive `deploy.tar.gz` sur le VPS et déploie dans un dossier versionné.

#### Arborescence DEV
```bash
/var/www/ubora-backend-dev/
  releases/
    20251007084000/        # release horodatée
    20251007091530/
  current -> releases/20251007091530/   # symlink vers la release active
  uploads/deploy.tar.gz
```

#### Arborescence PROD
```bash
/var/www/ubora-backend-prod/
  releases/
    20251007084000/        # release horodatée
    20251007091530/
  current -> releases/20251007091530/   # symlink vers la release active
  uploads/deploy.tar.gz
```

#### Redémarrer sur la release active (DEV)
```bash
pm2 stop ubora-backend-dev || true
pm2 delete ubora-backend-dev || true
pm2 start /var/www/ubora-backend-dev/current/server/production-server.js --name ubora-backend-dev --update-env
pm2 save
```

#### Redémarrer sur la release active (PROD)
```bash
pm2 stop ubora-backend-prod || true
pm2 delete ubora-backend-prod || true
pm2 start /var/www/ubora-backend-prod/current/server/production-server.js --name ubora-backend-prod --update-env
pm2 save
```

#### Bascule manuelle vers une release antérieure (rollback DEV)
```bash
cd /var/www/ubora-backend-dev
ls -1dt releases/* | head -n 5         # lister les dernières releases
ln -sfn releases/20251007084000 current # pointer sur une release précédente
pm2 stop ubora-backend-dev || true
pm2 delete ubora-backend-dev || true
pm2 start /var/www/ubora-backend-dev/current/server/production-server.js --name ubora-backend-dev --update-env
pm2 save
```

#### Bascule manuelle vers une release antérieure (rollback PROD)
```bash
cd /var/www/ubora-backend-prod
ls -1dt releases/* | head -n 5         # lister les dernières releases
ln -sfn releases/20251007084000 current # pointer sur une release précédente
pm2 stop ubora-backend-prod || true
pm2 delete ubora-backend-prod || true
pm2 start /var/www/ubora-backend-prod/current/server/production-server.js --name ubora-backend-prod --update-env
pm2 save
```

#### Vérifier la version déployée
```bash
# DEV
cat /var/www/ubora-backend-dev/current/VERSION
curl -s http://localhost:3001/health

# PROD
cat /var/www/ubora-backend-prod/current/VERSION
curl -s http://localhost:3000/health
```

## 📱 7. Monitoring en Temps Réel

### Interface PM2 (si disponible)
```bash
# Lancer l'interface web PM2
pm2 web

# Accéder via navigateur : http://your-vps-ip:9615
```

### Monitoring avec htop
```bash
# Installer htop si nécessaire
sudo apt install htop

# Lancer htop
htop
```

## 🚨 8. Dépannage des Problèmes Courants

### Application ne démarre pas
```bash
# Vérifier les erreurs (production)
pm2 logs ubora-backend-prod --err

# Vérifier les erreurs (développement)
pm2 logs ubora-backend-dev --err

# Vérifier les variables d'environnement
cd /var/www/ubora-backend-dev
cat .env

# Tester manuellement (développement)
cd /var/www/ubora-backend-dev
node server/dev-server.js

# Tester manuellement (production)
cd /var/www/ubora-backend-prod
node server/production-server.js
```

### Dépannage du Background Formatting (Nouvelle fonctionnalité)
```bash
# Vérifier les logs de développement pour les erreurs de formatage
pm2 logs ubora-backend-dev --lines 50

# Chercher spécifiquement les erreurs de formatage
pm2 logs ubora-backend-dev | grep -i "formatting\|openai\|firebase"

# Vérifier les erreurs Firebase Admin SDK
pm2 logs ubora-backend-dev | grep -i "firebase\|admin"

# Tester le worker de formatage manuellement
cd /var/www/ubora-backend-dev
node api/start-worker.js

# Vérifier les collections Firestore
# (nécessite l'accès à la console Firebase ou un script de test)
```

### Vérifier que les nouvelles fonctionnalités sont actives
```bash
# Vérifier que le code a été déployé
cd /var/www/ubora-backend-dev
git log --oneline -5

# Vérifier que les nouveaux fichiers existent
ls -la api/background/
ls -la api/ocr/

# Tester l'endpoint de formatage
curl -X POST http://localhost:3001/api/ocr/extractPdfText \
  -H "Content-Type: application/json" \
  -d '{"test": "connection"}'
```

### Port déjà utilisé
```bash
# Trouver le processus utilisant le port
sudo lsof -i :3000

# Tuer le processus
sudo kill -9 PID
```

### Problèmes de permissions
```bash
# Vérifier les permissions
cd /var/www/ubora-backend-prod
ls -la

# Corriger les permissions
sudo chown -R $USER:$USER /var/www/ubora-backend-prod
chmod +x server/production-server.js
```

## 📋 9. Scripts Utiles

### Script de monitoring rapide
```bash
#!/bin/bash
# Créer un fichier monitor.sh
echo "=== Statut de l'Application ==="
pm2 list
echo ""
echo "=== Logs Récentes ==="
pm2 logs ubora-backend-prod --lines 10
echo ""
echo "=== Utilisation Ressources ==="
top -bn1 | head -20
```

### Script de redémarrage
```bash
#!/bin/bash
# Créer un fichier restart.sh
echo "Redémarrage de l'application..."
pm2 restart ubora-backend-prod
echo "Application redémarrée!"
pm2 logs ubora-backend-prod --lines 5
```

## 🔧 10. Configuration des Logs

### Configuration PM2 (ecosystem.config.js)
```javascript
module.exports = {
  apps: [{
    name: 'ubora-backend-prod',
    script: 'server/production-server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

### Variables d'environnement importantes
```bash
# Dans votre fichier .env (déployé automatiquement par GitHub Actions)
NODE_ENV=production
PORT=3000
FIREBASE_PROJECT_ID=studio-gpnfx
FIREBASE_CLIENT_EMAIL=your-service-account@studio-gpnfx.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
OPENAI_API_KEY=sk-...
CORS_ORIGIN=https://my.ubora-app.com
```

## 📞 11. Contacts et Support

En cas de problème :

1. **Vérifiez d'abord les logs** avec `pm2 logs ubora-backend-prod`
2. **Consultez ce guide** pour les solutions courantes
3. **Redémarrez l'application** si nécessaire
4. **Contactez l'administrateur système** si les problèmes persistent

## 🔐 12. Sécurité

### Bonnes pratiques
- Utilisez des clés SSH plutôt que des mots de passe
- Limitez l'accès SSH par IP si possible
- Maintenez le système à jour
- Surveillez régulièrement les logs d'authentification

### Commandes de sécurité
```bash
# Vérifier les connexions SSH récentes
sudo tail -f /var/log/auth.log | grep ssh

# Vérifier les tentatives de connexion échouées
sudo grep "Failed password" /var/log/auth.log | tail -20
```

---

## 🎯 Commandes Rapides pour Votre Setup

**Connexion SSH :**
```bash
ssh root@72.60.94.31
```

**Aller au répertoire de développement :**
```bash
cd /var/www/ubora-backend-dev
```

**Aller au répertoire de production :**
```bash
cd /var/www/ubora-backend-prod
```

**Voir les logs de développement en temps réel :**
```bash
pm2 logs ubora-backend-dev -f
```

**Voir les logs de production en temps réel :**
```bash
pm2 logs ubora-backend-prod -f
```

**Redémarrer l'application de développement :**
```bash
pm2 restart ubora-backend-dev
```

**Redémarrer l'application de production :**
```bash
pm2 restart ubora-backend-prod
```

**Vérifier le statut de tous les processus :**
```bash
pm2 list
```

**Mettre à jour et redémarrer le développement (après déploiement GitHub) :**
```bash
cd /var/www/ubora-backend-dev
git pull origin dev
npm ci
pm2 restart ubora-backend-dev
pm2 logs ubora-backend-dev --lines 10
```

---

**Note :** Ce guide est configuré pour votre déploiement automatique avec GitHub Actions. Votre VPS est accessible à l'adresse `72.60.94.31` avec l'utilisateur `root`.

