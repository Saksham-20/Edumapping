#!/bin/bash

# Exit on error
set -e

echo "============================================================"
echo "    CampusConnect - Second Instance Deployment Script"
echo "============================================================"

# Configuration Variables
# Change these values before running the script
NEW_DOMAIN="colleges.globoniks.com"
NEW_DB_NAME="new_website_prod"
NEW_PORT=5001

# Advanced configurations (usually don't need changing)
SOURCE_DIR="/var/www/campusconnect"
DEST_DIR="/var/www/campusconnect2"
DB_USER="edumapping_user"
PM2_APP_NAME="new-website-api"

# 1. Ask for confirmation
echo "This script will deploy a second instance of CampusConnect to ${NEW_DOMAIN}."
echo "It will run on Port ${NEW_PORT} and use Database ${NEW_DB_NAME}."
read -p "Are you sure you want to proceed? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "Deployment cancelled."
    exit 1
fi

echo "🚀 Starting Deployment..."

# 2. Duplicate the Directory
echo "📁 Copying files to ${DEST_DIR}..."
if [ -d "$DEST_DIR" ]; then
    echo "Directory ${DEST_DIR} already exists. Backing it up..."
    mv "$DEST_DIR" "${DEST_DIR}_backup_$(date +%s)"
fi
cp -r "$SOURCE_DIR" "$DEST_DIR"

# 3. Create the Database
echo "🗄️ Creating new PostgreSQL database '${NEW_DB_NAME}'..."
sudo -u postgres psql -c "CREATE DATABASE ${NEW_DB_NAME};" || echo "Database may already exist, continuing..."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${NEW_DB_NAME} TO ${DB_USER};" || echo "Granting privileges failed, continuing..."

# 4. Update the Backend Environment Variables
echo "⚙️ Updating backend .env file..."
ENV_FILE="${DEST_DIR}/server/.env"

if [ -f "$ENV_FILE" ]; then
    # Use sed to replace the port, database name, and URLs
    sed -i "s/^PORT=.*/PORT=${NEW_PORT}/" "$ENV_FILE"
    sed -i "s/^DB_NAME=.*/DB_NAME=${NEW_DB_NAME}/" "$ENV_FILE"
    
    # Also attempt to update DATABASE_URL if it exists
    sed -i -E "s|^(DATABASE_URL=postgresql://.*:.*@.*:5432/).*|\1${NEW_DB_NAME}|" "$ENV_FILE"

    sed -i "s|^FRONTEND_URL=.*|FRONTEND_URL=https://${NEW_DOMAIN}|" "$ENV_FILE"
    sed -i "s|^API_PUBLIC_URL=.*|API_PUBLIC_URL=https://${NEW_DOMAIN}/api|" "$ENV_FILE"
else
    echo "⚠️ Warning: .env file not found in ${ENV_FILE}. You will need to configure it manually."
    exit 1
fi

# 5. Run Database Migrations and Seed
echo "🏗️ Running Database Migrations..."
cd "${DEST_DIR}/server"
npm run db:migrate:prod
echo "🌱 Running Database Seed..."
npm run db:seed:prod

# 6. Start the Backend with PM2
echo "🚀 Starting the backend with PM2..."
pm2 start src/server.js --name "$PM2_APP_NAME"
pm2 save

# 7. Build the Frontend
echo "🏗️ Building the Frontend..."
cd "${DEST_DIR}/client"
# Clean up old build
rm -rf build
# Set the new API URL for the build process
export REACT_APP_API_URL="https://${NEW_DOMAIN}/api"
npm run build

# 8. Configure Nginx
echo "🌐 Configuring Nginx for ${NEW_DOMAIN}..."
NGINX_CONF="/etc/nginx/sites-available/new-website"

cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name ${NEW_DOMAIN};

    root ${DEST_DIR}/client/build;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:${NEW_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /static {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable the Nginx site
ln -sf "$NGINX_CONF" "/etc/nginx/sites-enabled/"
rm -f /etc/nginx/sites-enabled/default

# Test Nginx and Restart
echo "🔄 Restarting Nginx..."
nginx -t
systemctl restart nginx

# 9. Set up SSL (Optional but recommended)
echo "🔒 Setting up SSL Certificate..."
read -p "Do you want to run Certbot to configure SSL for ${NEW_DOMAIN} now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    certbot --nginx -d "${NEW_DOMAIN}"
else
    echo "Skipping SSL setup. You can run 'certbot --nginx -d ${NEW_DOMAIN}' later."
fi

echo "============================================================"
echo "✅ Deployment Complete!"
echo "Your new instance is now running at: http://${NEW_DOMAIN}"
echo "Backend Port: ${NEW_PORT}"
echo "Database: ${NEW_DB_NAME}"
echo "PM2 App Name: ${PM2_APP_NAME}"
echo "============================================================"
