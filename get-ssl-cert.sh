#!/bin/bash

# Stop Nginx temporarily
docker-compose -f docker-compose.prod.yml stop nginx

# Replace with your email
EMAIL="votre@email.com"
DOMAIN="veille.pandemicplatform.org"

# Get SSL certificate
docker run --rm -it \
  -v "$(pwd)/nginx/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/nginx/certbot/www:/var/www/certbot" \
  certbot/certbot \
  certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email $EMAIL \
  --agree-tos --no-eff-email \
  -d $DOMAIN

# Restart Nginx with SSL configuration
cp nginx-app-ssl.conf nginx/conf/app.conf
docker-compose -f docker-compose.prod.yml up -d nginx

echo "SSL certificate has been obtained and Nginx has been configured for HTTPS."
