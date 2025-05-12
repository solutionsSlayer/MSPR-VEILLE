#!/bin/bash
set -e

# Stop Nginx temporarily
echo "Stopping Nginx container..."
docker-compose -f docker-compose.prod.yml stop nginx

# Replace with your email
EMAIL="your@email.com"
DOMAIN="veille.pandemicplatform.org"

# Ensure certbot directories exist
echo "Creating required directories..."
mkdir -p nginx/certbot/conf
mkdir -p nginx/certbot/www

# Check if domain is accessible
echo "Checking if domain $DOMAIN is accessible..."
curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/ || {
  echo "WARNING: Unable to reach $DOMAIN. Make sure:"
  echo "1. DNS is properly configured to point to this server"
  echo "2. Port 80 is open in your firewall"
  echo "3. The domain is publicly accessible"
  echo ""
  echo "Continuing anyway, but certificate validation might fail..."
}

# Get SSL certificate
echo "Attempting to obtain SSL certificate for $DOMAIN..."
docker run --rm -it \
  -v "$(pwd)/nginx/certbot/conf:/etc/letsencrypt" \
  -v "$(pwd)/nginx/certbot/www:/var/www/certbot" \
  certbot/certbot \
  certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email $EMAIL \
  --agree-tos --no-eff-email \
  -d $DOMAIN || {
    echo ""
    echo "Certificate acquisition failed. Temporarily configuring Nginx for HTTP-only mode..."
    # Uncomment if needed to restart in HTTP mode
    docker-compose -f docker-compose.prod.yml up -d nginx
    exit 1
  }

# Enable the SSL configuration
echo "Certificate acquired successfully! Enabling HTTPS configuration..."
cp nginx-app-ssl.conf nginx/conf/app.conf

# Uncomment SSL block in nginx-app-ssl.conf
sed -i 's/# server {/server {/g' nginx-app-ssl.conf
sed -i 's/#     /    /g' nginx-app-ssl.conf

# Restart Nginx with SSL configuration
docker-compose -f docker-compose.prod.yml up -d nginx

echo "SSL certificate has been obtained and Nginx has been configured for HTTPS."
echo "Your application should now be available at https://$DOMAIN"
