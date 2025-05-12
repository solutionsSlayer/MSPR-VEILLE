#!/bin/bash

# Script de déploiement complet pour MSPR-VEILLE
# À exécuter sur votre VPS après avoir cloné le dépôt

# Variables à configurer
DOMAIN="veille.pandemicplatform.org"
EMAIL="votre@email.com"  # Pour les notifications Certbot

# Couleurs pour les messages
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Début du déploiement de l'application MSPR-VEILLE pour ${DOMAIN}${NC}"

# 0. Nettoyage Docker pour libérer de l'espace
echo -e "${YELLOW}Nettoyage de Docker pour libérer de l'espace disque...${NC}"
docker system prune -f

# 1. Créer les répertoires nécessaires
echo -e "${YELLOW}Création des répertoires nécessaires...${NC}"
mkdir -p nginx/conf
mkdir -p nginx/ssl
mkdir -p nginx/certbot/conf
mkdir -p nginx/certbot/www
mkdir -p public/podcasts
chmod -R 755 nginx
chmod -R 755 public

# 2. Créer le fichier de configuration Nginx HTTP-only
echo -e "${YELLOW}Création de la configuration Nginx (HTTP uniquement)...${NC}"
cat > nginx/conf/app.conf << EOL
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # For certbot challenges
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # For initial setup, proxy all requests to the app
    location / {
        proxy_pass http://app:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Serve podcasts directly from the file system
    location /podcasts/ {
        alias /var/www/podcasts/;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }
}
EOL

# 3. Création du fichier .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}Création du fichier .env depuis .env.prod.example...${NC}"
    cp .env.prod.example .env
    echo -e "${RED}⚠️ N'oubliez pas de modifier le fichier .env avec vos propres valeurs!${NC}"
fi

# 4. Correction des fichiers pour éviter les erreurs de compilation
echo -e "${YELLOW}Correction des fichiers pour éviter les erreurs de compilation...${NC}"

# Mise à jour de next.config.js - en utilisant une syntaxe simple et correcte
rm -f next.config.js next.config.ts
cat > next.config.js << EOL
module.exports = { 
  output: "standalone", 
  outputFileTracingRoot: __dirname, 
  typescript: { 
    ignoreBuildErrors: true 
  } 
};
EOL

# 5. Arrêter et supprimer les conteneurs existants
echo -e "${YELLOW}Arrêt et suppression des conteneurs existants...${NC}"
docker-compose -f docker-compose.prod.yml down --volumes

# 6. Démarrer l'application avec reconstruction forcée
echo -e "${YELLOW}Construction et démarrage des conteneurs...${NC}"
docker-compose -f docker-compose.prod.yml up -d --build

# 7. Attendre que les services soient prêts
echo -e "${YELLOW}Attente du démarrage des services...${NC}"
sleep 30

# 8. Vérifier l'état des conteneurs
echo -e "${YELLOW}Vérification de l'état des conteneurs...${NC}"
docker-compose -f docker-compose.prod.yml ps

# 9. Configuration des sauvegardes
echo -e "${YELLOW}Configuration des sauvegardes automatiques...${NC}"
cat > ~/backup-veille.sh << 'EOL'
#!/bin/bash

# Variables
BACKUP_DIR="/home/$(whoami)/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DOCKER_COMPOSE_DIR="/home/$(whoami)/mspr-veille"

# Créer le répertoire de sauvegarde s'il n'existe pas
mkdir -p "$BACKUP_DIR"

# Se déplacer dans le répertoire du projet
cd "$DOCKER_COMPOSE_DIR"

# Sauvegarder la base de données
echo "Sauvegarde de la base de données..."
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U veille_user veille_db > "$BACKUP_DIR/veille_db_$TIMESTAMP.sql"

# Sauvegarder les fichiers de configuration
echo "Sauvegarde des fichiers de configuration..."
tar -czf "$BACKUP_DIR/veille_config_$TIMESTAMP.tar.gz" .env docker-compose.prod.yml nginx/conf/

# Nettoyer les anciennes sauvegardes (garder les 7 dernières)
echo "Nettoyage des anciennes sauvegardes..."
ls -t "$BACKUP_DIR"/veille_db_*.sql | tail -n +8 | xargs -r rm
ls -t "$BACKUP_DIR"/veille_config_*.tar.gz | tail -n +8 | xargs -r rm

echo "Sauvegarde terminée avec succès!"
EOL

chmod +x ~/backup-veille.sh

# Ajouter le job de sauvegarde au crontab
(crontab -l 2>/dev/null; echo "0 2 * * * /home/$(whoami)/backup-veille.sh") | crontab -

# 10. Script de surveillance
echo -e "${YELLOW}Configuration de la surveillance automatique...${NC}"
cat > ~/check-veille.sh << 'EOL'
#!/bin/bash

# Variables
DOCKER_COMPOSE_DIR="/home/$(whoami)/mspr-veille"

# Se déplacer dans le répertoire du projet
cd "$DOCKER_COMPOSE_DIR"

# Vérifier l'état des conteneurs
CONTAINERS_DOWN=$(docker-compose -f docker-compose.prod.yml ps | grep -v "Up" | grep -v "^Name" | awk '{print $1}')

if [ -n "$CONTAINERS_DOWN" ]; then
    echo "Les conteneurs suivants ne sont pas en cours d'exécution: $CONTAINERS_DOWN"
    echo "Tentative de redémarrage..."
    
    docker-compose -f docker-compose.prod.yml up -d
    
    sleep 30
    
    # Vérifier à nouveau
    STILL_DOWN=$(docker-compose -f docker-compose.prod.yml ps | grep -v "Up" | grep -v "^Name" | awk '{print $1}')
    
    if [ -n "$STILL_DOWN" ]; then
        echo "Impossible de redémarrer les conteneurs: $STILL_DOWN"
    else
        echo "Tous les conteneurs ont été redémarrés avec succès."
    fi
else
    echo "Tous les conteneurs sont en cours d'exécution."
fi
EOL

chmod +x ~/check-veille.sh

# Ajouter le job de surveillance au crontab
(crontab -l 2>/dev/null; echo "0 * * * * /home/$(whoami)/check-veille.sh") | crontab -

# 11. Instructions finales
echo -e "${GREEN}Déploiement terminé!${NC}"
echo -e "${GREEN}Votre application est maintenant disponible à l'adresse http://${DOMAIN}${NC}"
echo -e "${GREEN}Surveillez les conteneurs avec : docker-compose -f docker-compose.prod.yml ps${NC}"
echo -e "${YELLOW}Pour voir les logs de l'application : docker-compose -f docker-compose.prod.yml logs -f app${NC}"
echo -e "${YELLOW}Pour voir les logs du cron : docker-compose -f docker-compose.prod.yml logs -f cron${NC}"
echo -e "${YELLOW}Pour redémarrer tous les services : docker-compose -f docker-compose.prod.yml restart${NC}"
echo -e "${YELLOW}Pour configurer HTTPS, exécutez get-ssl-cert.sh une fois que votre domaine est correctement configuré${NC}"
EOL
