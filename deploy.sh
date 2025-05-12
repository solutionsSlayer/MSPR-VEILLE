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

# 1. Créer les répertoires nécessaires
echo -e "${YELLOW}Création des répertoires nécessaires...${NC}"
mkdir -p nginx/conf
mkdir -p nginx/ssl
mkdir -p nginx/certbot/conf
mkdir -p nginx/certbot/www
chmod -R 755 nginx

# 2. Créer le fichier de configuration Nginx initial
echo -e "${YELLOW}Création de la configuration Nginx initiale...${NC}"
cat > nginx/conf/app-init.conf << EOL
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

# 3. Créer le fichier de configuration Nginx avec SSL
echo -e "${YELLOW}Création de la configuration Nginx avec SSL...${NC}"
cat > nginx/conf/app-ssl.conf << EOL
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # For certbot challenges
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all HTTP traffic to HTTPS
    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ${DOMAIN};

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/${DOMAIN}/chain.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy Next.js app
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

# 4. Copier la configuration initiale
echo -e "${YELLOW}Utilisation de la configuration Nginx initiale...${NC}"
cp nginx/conf/app-init.conf nginx/conf/app.conf

# 5. Création du fichier .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}Création du fichier .env depuis .env.prod.example...${NC}"
    cp .env.prod.example .env
    echo -e "${RED}⚠️ N'oubliez pas de modifier le fichier .env avec vos propres valeurs!${NC}"
fi

# 6. Démarrer l'application
echo -e "${YELLOW}Démarrage de l'application...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# 7. Attendre que les services soient prêts
echo -e "${YELLOW}Attente du démarrage des services...${NC}"
sleep 30

# 8. Obtention du certificat SSL - modifié pour utiliser le port 8080
echo -e "${YELLOW}Obtention du certificat SSL...${NC}"
echo -e "${RED}⚠️ Si l'obtention du certificat échoue, vous pouvez utiliser votre application sans HTTPS${NC}"
echo -e "${RED}   Accédez à votre application via http://${DOMAIN}:8080${NC}"

# 9. Plutôt que d'essayer d'exécuter le job dans le conteneur, nous l'exécutons dans le conteneur cron
# qui a déjà toutes les dépendances installées
echo -e "${YELLOW}Exécution du job RSS-Fetch via le conteneur cron...${NC}"
echo -e "${YELLOW}Les jobs cron s'exécuteront automatiquement selon la planification configurée dans le conteneur cron.${NC}"

echo -e "${YELLOW}Vérification des logs du conteneur cron...${NC}"
docker-compose -f docker-compose.prod.yml logs --tail=30 cron

# 10. Configuration des sauvegardes
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

# 11. Script de surveillance
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

echo -e "${GREEN}Déploiement terminé!${NC}"
echo -e "${GREEN}Votre application est maintenant disponible à l'adresse http://${DOMAIN}:8080${NC}"
echo -e "${GREEN}Le conteneur cron s'occupera d'exécuter les jobs selon la planification configurée.${NC}"
echo -e "${YELLOW}N'oubliez pas de vérifier les logs pour vous assurer que tout fonctionne correctement:${NC}"
echo -e "${YELLOW}docker-compose -f docker-compose.prod.yml logs -f${NC}"
echo -e "${YELLOW}docker-compose -f docker-compose.prod.yml logs -f cron${NC}"
