# Hostinger KVM1 Deployment Guide

## Prerequisites
- Hostinger KVM1 VPS purchased
- SSH access credentials (IP, username, password)
- Your domain name configured (DNS pointing to VPS IP)

---

## Step 1: Initial Server Setup

### Connect to your VPS via SSH
```bash
ssh root@your-vps-ip
# Or if using a username:
ssh username@your-vps-ip
```

### Update System
```bash
apt update && apt upgrade -y
```

### Install Basic Tools
```bash
apt install -y git curl wget nano ufw fail2ban
```

### Set Up Firewall
```bash
# Allow SSH (important - do this first!)
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Allow your backend port (if exposing directly)
ufw allow 5000/tcp

# Enable firewall
ufw --force enable
```

---

## Step 2: Install Node.js

Your app requires Node.js >=18.0.0

```bash
# Install Node.js 20.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify installation
node --version  # Should be v20.x.x
npm --version
```

---

## Step 3: Install Docker & Docker Compose

### Install Docker
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Start and enable Docker
systemctl start docker
systemctl enable docker

# Add your user to docker group (if not root)
usermod -aG docker $USER

# Verify Docker
docker --version
```

### Install Docker Compose
```bash
# Install Docker Compose v2
apt install -y docker-compose-plugin

# Verify
docker compose version
```

---

## Step 4: Install PostgreSQL (for production)

While Docker can run PostgreSQL, for production you might want a dedicated PostgreSQL service:

```bash
# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Start PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Set password for postgres user
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'your-strong-password-here';"

# Create database
sudo -u postgres psql -c "CREATE DATABASE edumapping_prod;"

# Create a new database user (recommended for production)
sudo -u postgres psql -c "CREATE USER edumapping_user WITH PASSWORD 'your-db-user-password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE edumapping_prod TO edumapping_user;"
```

---

## Step 5: Install Redis

```bash
# Install Redis
apt install -y redis-server

# Configure Redis (optional - for persistence)
nano /etc/redis/redis.conf
# Uncomment: save 900 1
# Uncomment: save 300 10
# Uncomment: save 60 10000

# Start Redis
systemctl start redis-server
systemctl enable redis-server

# Test Redis
redis-cli ping  # Should return PONG
```

---

## Step 6: Install MinIO (for file storage)

```bash
# Download MinIO
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
mv minio /usr/local/bin/

# Create MinIO directories
mkdir -p /mnt/minio/data
mkdir -p /mnt/minio/config

# Create MinIO service file
nano /etc/systemd/system/minio.service
```

Add this content to the service file:
```ini
[Unit]
Description=MinIO Object Storage
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/minio server /mnt/minio/data --console-address ":9001"
Restart=always
RestartSec=10

Environment="MINIO_ROOT_USER=admin"
Environment="MINIO_ROOT_PASSWORD=your-strong-minio-password"

[Install]
WantedBy=multi-user.target
```

```bash
# Reload systemd and start MinIO
systemctl daemon-reload
systemctl start minio
systemctl enable minio

# Check MinIO status
systemctl status minio
```

Access MinIO Console at: `http://your-vps-ip:9001`

---

## Step 7: Clone Your Project

```bash
# Create project directory
mkdir -p /var/www
cd /var/www

# Clone your repository (if using Git)
git clone https://github.com/yourusername/campusconnect.git
cd campusconnect

# OR: Upload your project using SCP/FTP
# scp -r ./campusconnect root@your-vps-ip:/var/www/
```

---

## Step 8: Configure Environment Variables

### Backend Environment (.env for production)
```bash
cd /var/www/campusconnect/server
nano .env
```

Add these variables:
```env
NODE_ENV=production
PORT=5000

# Database (use your PostgreSQL setup from Step 4)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=edumapping_prod
DB_USERNAME=edumapping_user
DB_PASSWORD=your-db-user-password

# OR use DATABASE_URL format:
# DATABASE_URL=postgresql://edumapping_user:your-db-user-password@localhost:5432/edumapping_prod

# Redis
REDIS_URL=redis://localhost:6379

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=your-strong-minio-password
MINIO_BUCKET_NAME=edumapping-files

# JWT Secrets (generate strong random strings)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars

# Frontend URL (your domain)
FRONTEND_URL=https://yourdomain.com,https://www.yourdomain.com

# API Public URL
API_PUBLIC_URL=https://yourdomain.com/api

# Email Configuration (use a real SMTP service like SendGrid, AWS SES, etc.)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Other settings
PGSSLMODE=disable
DATABASE_SSL=false
```

### Generate JWT Secrets
```bash
# Generate random secrets
openssl rand -base64 32  # Use this for JWT_SECRET
openssl rand -base64 32  # Use this for JWT_REFRESH_SECRET
```

---

## Step 9: Build and Deploy Application

### Option A: Using Docker Compose (Recommended)

```bash
cd /var/www/campusconnect

# Modify docker-compose.yml for production
nano docker-compose.yml
```

Update the production docker-compose.yml:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: edumapping_postgres_prod
    environment:
      POSTGRES_DB: edumapping_prod
      POSTGRES_USER: edumapping_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - edumapping
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: edumapping_redis_prod
    volumes:
      - redis_data:/data
    networks:
      - edumapping
    restart: unless-stopped

  server:
    build:
      context: ./server
      dockerfile: Dockerfile
    container_name: edumapping_server_prod
    environment:
      NODE_ENV: production
      PORT: 5000
      DATABASE_URL: postgresql://${DB_USERNAME}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      REDIS_URL: redis://redis:6379
      # Add other env vars...
    ports:
      - "5000:5000"
    depends_on:
      - postgres
      - redis
    networks:
      - edumapping
    restart: unless-stopped

  client:
    build:
      context: ./client
      dockerfile: Dockerfile
    container_name: edumapping_client_prod
    environment:
      REACT_APP_API_URL: https://yourdomain.com/api
    ports:
      - "3000:80"
    depends_on:
      - server
    networks:
      - edumapping
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  edumapping:
    driver: bridge
```

Build and start:
```bash
# Build client
cd client
npm install
npm run build
cd ..

# Start services
docker compose up -d

# Check logs
docker compose logs -f
```

### Option B: Manual Installation (Without Docker)

#### Install Backend Dependencies
```bash
cd /var/www/campusconnect/server
npm install --production
```

#### Run Database Migrations
```bash
cd /var/www/campusconnect/server
npm run db:migrate:prod

# Optional: Seed initial data
# npm run db:seed:prod
```

#### Set Up PM2 (Process Manager)
```bash
# Install PM2 globally
npm install -g pm2

# Start your server
cd /var/www/campusconnect/server
pm2 start src/server.js --name edumapping-api

# Save PM2 configuration
pm2 save

# Set up PM2 to start on boot
pm2 startup
# Follow the command it outputs
```

#### Build Frontend
```bash
cd /var/www/campusconnect/client

# Install dependencies
npm install

# Set environment variable
export REACT_APP_API_URL=https://yourdomain.com/api

# Build
npm run build

# The build files will be in client/build/
```

#### Serve Frontend with Nginx
```bash
# Install Nginx
apt install -y nginx

# Create Nginx configuration
nano /etc/nginx/sites-available/edumapping
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Redirect HTTP to HTTPS (after SSL setup)
    # return 301 https://$server_name$request_uri;

    # Serve React app
    root /var/www/campusconnect/client/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests to backend (avoid 502: increase timeouts and buffers)
    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        proxy_buffering off;
    }

    # Static assets caching
    location /static {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Enable site
ln -s /etc/nginx/sites-available/edumapping /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx
systemctl enable nginx
```

---

## Step 10: Set Up SSL with Let's Encrypt

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Follow the prompts and enter your email

# Auto-renewal (should be automatic, but verify)
certbot renew --dry-run
```

After SSL setup, update your Nginx config to redirect HTTP to HTTPS (uncomment the redirect line).

---

## Step 11: Configure Domain DNS

In your domain registrar's DNS settings, add:

```
Type: A
Name: @
Value: your-vps-ip-address
TTL: 3600

Type: A
Name: www
Value: your-vps-ip-address
TTL: 3600
```

---

## Step 12: Monitor Your Application

### Check PM2 Status (if using manual setup)
```bash
pm2 status
pm2 logs edumapping-api
pm2 monit
```

### Check Docker Containers (if using Docker)
```bash
docker ps
docker compose logs -f
```

### Check System Resources
```bash
htop  # Install with: apt install -y htop
df -h  # Check disk usage
free -h  # Check memory
```

### Set Up Log Rotation
```bash
# For PM2 logs
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## Step 13: Backup Strategy

### Database Backup
```bash
# Create backup script
nano /usr/local/bin/backup-db.sh
```

Add:
```bash
#!/bin/bash
BACKUP_DIR="/var/backups/edumapping"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
sudo -u postgres pg_dump edumapping_prod > $BACKUP_DIR/db_backup_$DATE.sql

# Keep only last 7 days of backups
find $BACKUP_DIR -name "db_backup_*.sql" -mtime +7 -delete

echo "Backup completed: db_backup_$DATE.sql"
```

```bash
# Make executable
chmod +x /usr/local/bin/backup-db.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-db.sh
```

---

## Troubleshooting

### Check Backend Logs
```bash
# Docker
docker compose logs server

# PM2
pm2 logs edumapping-api
```

### Check Database Connection
```bash
sudo -u postgres psql -d edumapping_prod -c "SELECT version();"
```

### Check if Ports are Listening
```bash
netstat -tlnp | grep -E ':(5000|5432|6379|80|443)'
```

### Restart Services
```bash
# PM2
pm2 restart edumapping-api

# Docker
docker compose restart

# Nginx
systemctl restart nginx

# PostgreSQL
systemctl restart postgresql

# Redis
systemctl restart redis-server
```

---

## Performance Optimization

### Enable Gzip in Nginx
Add to your Nginx config:
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
```

### Optimize PostgreSQL
Edit `/etc/postgresql/15/main/postgresql.conf`:
```conf
shared_buffers = 1GB
effective_cache_size = 3GB
maintenance_work_mem = 256MB
```

Restart: `systemctl restart postgresql`

---

## Security Checklist

- [x] Firewall configured (UFW)
- [x] SSH keys instead of passwords
- [x] Strong passwords for all services
- [x] SSL certificate installed
- [x] Regular system updates
- [x] Fail2ban installed and configured
- [x] Database backups automated
- [ ] Regular security audits

---

## Useful Commands Cheat Sheet

```bash
# System
apt update && apt upgrade -y          # Update system
systemctl status nginx                # Check Nginx status
systemctl restart nginx               # Restart Nginx

# Docker
docker ps                             # List running containers
docker compose logs -f                # Follow logs
docker compose restart                # Restart services
docker compose down                   # Stop services

# PM2
pm2 status                           # Check app status
pm2 logs                            # View logs
pm2 restart edumapping-api          # Restart app
pm2 stop edumapping-api             # Stop app

# Database
sudo -u postgres psql -d edumapping_prod  # Connect to DB
pg_dump edumapping_prod > backup.sql      # Backup DB

# Redis
redis-cli ping                        # Test Redis
redis-cli info                        # Redis info

# Logs
tail -f /var/log/nginx/error.log     # Nginx error log
journalctl -u nginx -f               # Nginx system log
```

---

## Support

If you encounter issues:
1. Check application logs
2. Check system resources (CPU, RAM, disk)
3. Verify environment variables
4. Check database connectivity
5. Verify firewall rules

Good luck with your deployment! 🚀

