# Guide de déploiement MSPR-VEILLE sur VPS

Ce document explique comment déployer l'application MSPR-VEILLE sur un VPS Linux avec Docker, Nginx, et SSL.

## Prérequis

- Un VPS sous Linux (Ubuntu/Debian recommandé)
- Un nom de domaine configuré pour pointer vers votre VPS (`veille.pandemicplatform.org`)
- Git installé sur votre VPS
- Docker et Docker Compose installés sur votre VPS

## Procédure de déploiement rapide

1. **Connexion au VPS**:
   ```bash
   ssh utilisateur@adresse_ip_de_votre_vps
   ```

2. **Installation des prérequis (si nécessaire)**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y apt-transport-https ca-certificates curl software-properties-common git
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   sudo usermod -aG docker $USER
   sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.3/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   # Se déconnecter et se reconnecter pour appliquer les changements
   exit
   ```

3. **Clonage du dépôt et déploiement**:
   ```bash
   ssh utilisateur@adresse_ip_de_votre_vps
   
   mkdir -p ~/mspr-veille
   cd ~/mspr-veille
   
   # Cloner le dépôt
   git clone https://votre_repo_git.git .
   
   # Éditer le script de déploiement pour changer l'adresse email
   nano deploy.sh
   # Remplacer votre@email.com par votre adresse email réelle
   
   # Rendre le script exécutable
   chmod +x deploy.sh
   
   # Exécuter le script de déploiement
   ./deploy.sh
   ```

4. **Configuration des variables d'environnement**:
   Après l'exécution du script, vous devrez peut-être ajuster les variables d'environnement:
   ```bash
   nano .env
   # Mettre à jour les variables comme nécessaire
   
   # Redémarrer les services pour appliquer les changements
   docker-compose -f docker-compose.prod.yml down
   docker-compose -f docker-compose.prod.yml up -d
   ```

## Commandes utiles

### Vérifier l'état des conteneurs
```bash
docker-compose -f docker-compose.prod.yml ps
```

### Consulter les logs
```bash
# Tous les logs
docker-compose -f docker-compose.prod.yml logs

# Logs d'un service spécifique avec suivi
docker-compose -f docker-compose.prod.yml logs -f app
docker-compose -f docker-compose.prod.yml logs -f nginx
docker-compose -f docker-compose.prod.yml logs -f cron
```

### Exécuter les jobs manuellement
```bash
# Récupération des flux RSS
docker-compose -f docker-compose.prod.yml exec app node src/services/manual-runner.js --job=rss-fetch

# Génération des résumés AI
docker-compose -f docker-compose.prod.yml exec app node src/services/manual-runner.js --job=ai-summary

# Génération des podcasts
docker-compose -f docker-compose.prod.yml exec app node src/services/manual-runner.js --job=podcast

# Envoi sur Telegram
docker-compose -f docker-compose.prod.yml exec app node telegram-sender.js
```

### Mise à jour de l'application
```bash
cd ~/mspr-veille
git pull
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### Sauvegarde manuelle
```bash
~/backup-veille.sh
```

## Dépannage

### Les conteneurs ne démarrent pas
Vérifiez les logs:
```bash
docker-compose -f docker-compose.prod.yml logs
```

### Problèmes avec les certificats SSL
Si les certificats SSL ne se renouvellent pas:
```bash
# Vérifier les logs du conteneur certbot
docker-compose -f docker-compose.prod.yml logs certbot

# Forcer le renouvellement manuel
docker-compose -f docker-compose.prod.yml stop nginx
docker-compose -f docker-compose.prod.yml run --rm certbot renew --force-renewal
docker-compose -f docker-compose.prod.yml start nginx
```

### Espace disque insuffisant
Nettoyez les images et conteneurs Docker inutilisés:
```bash
docker system prune -af
```

## Contacts

Pour toute question ou problème concernant le déploiement, contactez l'équipe de développement.
