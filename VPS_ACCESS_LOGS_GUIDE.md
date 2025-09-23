# Guide d'Accès VPS et Consultation des Logs

Ce guide vous explique comment accéder à votre serveur VPS et consulter les logs de votre application backend en temps réel.

## 📋 Prérequis

- Accès SSH à votre VPS
- Informations de connexion (IP, utilisateur, clé SSH ou mot de passe)
- Terminal ou client SSH (PuTTY, Windows Terminal, etc.)

## 🔧 Configuration de Déploiement

**Votre backend est déployé avec :**
- **Répertoire de déploiement :** `/var/www/ubora-backend-prod`
- **Nom du processus PM2 :** `ubora-backend-prod`
- **Port :** `3000`
- **Branche Git :** `master`
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

# Aller dans le répertoire de votre application (répertoire de production)
cd /var/www/ubora-backend-prod

# Vérifier la structure
ls -la
```

**Répertoire de production :**
- `/var/www/ubora-backend-prod` (répertoire principal de votre backend)

## 🚀 3. Vérification du Statut de l'Application

### Vérifier si l'application est en cours d'exécution
```bash
# Vérifier les processus Node.js
ps aux | grep node

# Vérifier les processus sur le port 3000
netstat -tlnp | grep :3000

# Ou avec ss (plus moderne)
ss -tlnp | grep :3000
```

### Vérifier les services systemd (si configuré)
```bash
# Statut du service
sudo systemctl status ubora-backend-prod

# Démarrer le service
sudo systemctl start ubora-backend-prod

# Redémarrer le service
sudo systemctl restart ubora-backend-prod
```

## 📊 4. Consultation des Logs en Temps Réel

### Option A: Logs de l'Application (PM2 - Recommandé)
```bash
# Vérifier les processus PM2
pm2 list

# Voir les logs en temps réel
pm2 logs

# Logs d'une application spécifique (nom exact de votre déploiement)
pm2 logs ubora-backend-prod

# Logs avec timestamps
pm2 logs --timestamp

# Logs des 100 dernières lignes
pm2 logs --lines 100

# Logs d'erreurs uniquement
pm2 logs ubora-backend-prod --err
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
```bash
# Avec PM2 (nom exact de votre déploiement)
pm2 restart ubora-backend-prod

# Avec systemd
sudo systemctl restart ubora-backend-prod

# Manuel (tuer le processus et redémarrer)
pkill -f "node.*server/production-server.js"
cd /var/www/ubora-backend-prod
npm start
```

### Mettre à jour l'application
```bash
# Aller dans le répertoire
cd /var/www/ubora-backend-prod

# Récupérer les dernières modifications
git pull origin master

# Installer les nouvelles dépendances
npm ci

# Redémarrer l'application
pm2 restart ubora-backend-prod
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
# Vérifier les erreurs
pm2 logs ubora-backend-prod --err

# Vérifier les variables d'environnement
cd /var/www/ubora-backend-prod
cat .env

# Tester manuellement
node server/production-server.js
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

**Aller au répertoire de production :**
```bash
cd /var/www/ubora-backend-prod
```

**Voir les logs en temps réel :**
```bash
pm2 logs ubora-backend-prod
```

**Redémarrer l'application :**
```bash
pm2 restart ubora-backend-prod
```

**Vérifier le statut :**
```bash
pm2 list
```

---

**Note :** Ce guide est configuré pour votre déploiement automatique avec GitHub Actions. Votre VPS est accessible à l'adresse `72.60.94.31` avec l'utilisateur `root`.

