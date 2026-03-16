#!/bin/bash

#############################################################################
# College Placements - VPS Dual Instance Deployment Script
# 
# This script sets up College Placements on an existing VPS that already
# has CampusConnect running. It will:
# - Clone the College Placements repository
# - Create separate database
# - Configure environment variables
# - Install dependencies
# - Build frontend
# - Run migrations
# - Setup PM2
# - Configure Nginx
#
# Usage: bash deploy-vps-dual-setup.sh
#############################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration Variables
APPS_DIR="/home/$(whoami)/applications"
REPO_URL="https://github.com/your-org/collegeplacements.git"  # UPDATE THIS
DOMAIN="college-placements.globoniks.com"
API_PORT="5001"
DB_USER="collegeplacements"
DB_NAME="collegeplacements_db"
DB_PASSWORD=""  # Will be prompted
APP_NAME="college-placements-api"

# Functions
print_header() {
    echo -e "\n${BLUE}════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check if running as non-root with sudo
    if [[ $EUID -eq 0 ]]; then
        print_error "Please do not run this script as root. Run with sudo or from a regular user account."
        exit 1
    fi
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js installed: $NODE_VERSION"
    else
        print_error "Node.js not installed"
        exit 1
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        print_success "npm installed: $NPM_VERSION"
    else
        print_error "npm not installed"
        exit 1
    fi
    
    # Check PM2
    if command -v pm2 &> /dev/null; then
        print_success "PM2 installed"
    else
        print_warning "PM2 not installed. Installing globally..."
        sudo npm install -g pm2
        pm2 startup
    fi
    
    # Check PostgreSQL
    if command -v psql &> /dev/null; then
        print_success "PostgreSQL installed"
    else
        print_error "PostgreSQL not installed"
        exit 1
    fi
    
    # Check Nginx
    if command -v nginx &> /dev/null; then
        print_success "Nginx installed"
    else
        print_error "Nginx not installed"
        exit 1
    fi
    
    # Check Git
    if command -v git &> /dev/null; then
        print_success "Git installed"
    else
        print_error "Git not installed"
        exit 1
    fi
}

create_database() {
    print_header "Creating Database for College Placements"
    
    # Prompt for database password
    read -sp "Enter PostgreSQL password for ${DB_USER}: " DB_PASSWORD
    echo
    
    print_info "Creating database user and database..."
    
    sudo -u postgres psql << EOF
CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
CREATE DATABASE ${DB_NAME};
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
\q
EOF
    
    # Test connection
    print_info "Testing database connection..."
    if PGPASSWORD="${DB_PASSWORD}" psql -h localhost -U ${DB_USER} -d ${DB_NAME} -c "SELECT 1" > /dev/null 2>&1; then
        print_success "Database created and connection verified"
    else
        print_error "Failed to connect to database"
        exit 1
    fi
}

clone_repository() {
    print_header "Cloning Repository"
    
    # Create applications directory if it doesn't exist
    if [ ! -d "$APPS_DIR" ]; then
        print_info "Creating $APPS_DIR directory..."
        mkdir -p "$APPS_DIR"
    fi
    
    cd "$APPS_DIR"
    
    if [ -d "collegeplacements" ]; then
        print_warning "collegeplacements directory already exists. Skipping clone."
        cd collegeplacements
    else
        print_info "Cloning repository from $REPO_URL..."
        git clone "$REPO_URL" collegeplacements
        cd collegeplacements
        print_success "Repository cloned successfully"
    fi
}

configure_environment() {
    print_header "Configuring Environment Variables"
    
    # Backend .env
    print_info "Configuring backend .env..."
    cat > server/.env << EOF
NODE_ENV=production
PORT=${API_PORT}
HOST=0.0.0.0

# Database Configuration
DB_USERNAME=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
DB_HOST=localhost
DB_PORT=5432

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

# BCRYPT
BCRYPT_ROUNDS=12

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=noreply@${DOMAIN}

# MinIO/S3 Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=collegeplacements

# CORS Configuration
CORS_ORIGIN=https://${DOMAIN},http://localhost:3001

# URLs
BASE_URL=https://${DOMAIN}
API_URL=https://${DOMAIN}/api
WS_URL=wss://${DOMAIN}
EOF
    
    print_success "Backend .env created"
    
    # Frontend .env
    print_info "Configuring frontend .env..."
    cat > client/.env << EOF
REACT_APP_API_URL=https://${DOMAIN}/api
REACT_APP_WS_URL=wss://${DOMAIN}
REACT_APP_ENV=production
EOF
    
    print_success "Frontend .env created"
}

install_dependencies() {
    print_header "Installing Dependencies"
    
    # Backend dependencies
    print_info "Installing backend dependencies..."
    cd server
    npm install
    print_success "Backend dependencies installed"
    
    # Frontend dependencies
    print_info "Installing frontend dependencies..."
    cd ../client
    npm install
    print_success "Frontend dependencies installed"
    
    cd ..
}

build_frontend() {
    print_header "Building Frontend"
    
    cd client
    print_info "Building React application..."
    npm run build
    print_success "Frontend built successfully"
    
    cd ..
}

run_migrations() {
    print_header "Running Database Migrations"
    
    cd server
    
    if [ -f "package.json" ] && grep -q '"migrate"' package.json; then
        print_info "Running migrations..."
        npm run migrate
        print_success "Migrations completed"
    else
        print_warning "No migration script found in package.json"
    fi
    
    cd ..
}

setup_pm2() {
    print_header "Setting up PM2"
    
    # Create ecosystem configuration
    print_info "Creating PM2 ecosystem configuration..."
    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: '${APP_NAME}',
      script: './server/src/server.js',
      cwd: '${APPS_DIR}/collegeplacements',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: ${API_PORT}
      }
    }
  ]
};
EOF
    
    print_success "PM2 configuration created"
    
    # Create logs directory
    print_info "Creating logs directory..."
    mkdir -p logs
    chmod 755 logs
    
    # Start with PM2
    print_info "Starting application with PM2..."
    pm2 start ecosystem.config.js
    pm2 save
    
    print_success "Application started with PM2"
    
    # Display status
    pm2 status ${APP_NAME}
}

setup_nginx() {
    print_header "Setting up Nginx"
    
    # Create upstream and server block
    print_info "Creating Nginx configuration..."
    sudo tee /etc/nginx/sites-available/college-placements > /dev/null << 'EOF'
upstream college_placements_api {
  server 127.0.0.1:5001;
  server 127.0.0.1:5001;
  keepalive 64;
}

# HTTP to HTTPS redirect
server {
  listen 80;
  listen [::]:80;
  server_name college-placements.globoniks.com;
  
  location / {
    return 301 https://$server_name$request_uri;
  }

  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }
}

# HTTPS Server
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name college-placements.globoniks.com;

  # SSL Certificates (update paths after certbot)
  ssl_certificate /etc/letsencrypt/live/college-placements.globoniks.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/college-placements.globoniks.com/privkey.pem;
  
  # SSL Configuration
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;
  ssl_prefer_server_ciphers on;
  ssl_session_cache shared:SSL:10m;
  ssl_session_timeout 10m;

  # Security Headers
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;

  client_max_body_size 50M;

  # Compression
  gzip on;
  gzip_types text/plain text/css text/javascript application/javascript application/json;
  gzip_vary on;
  gzip_min_length 1000;

  # API Routes
  location /api/ {
    proxy_pass http://college_placements_api;
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
  }

  # WebSocket
  location /socket.io {
    proxy_pass http://college_placements_api/socket.io;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }

  # Static files
  location ~ ^/(static|public)/ {
    alias /home/$(whoami)/applications/collegeplacements/client/build/;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  # React SPA fallback
  location / {
    alias /home/$(whoami)/applications/collegeplacements/client/build/;
    try_files $uri /index.html;
  }

  # Deny access to sensitive files
  location ~ /\. {
    deny all;
  }
}
EOF
    
    # Enable configuration
    print_info "Enabling Nginx configuration..."
    sudo ln -sf /etc/nginx/sites-available/college-placements /etc/nginx/sites-enabled/college-placements
    
    # Test Nginx
    print_info "Testing Nginx configuration..."
    if sudo nginx -t > /dev/null 2>&1; then
        print_success "Nginx configuration is valid"
        sudo systemctl reload nginx
        print_success "Nginx reloaded"
    else
        print_error "Nginx configuration has errors"
        exit 1
    fi
}

setup_ssl() {
    print_header "Setting up SSL Certificate"
    
    if command -v certbot &> /dev/null; then
        print_info "Generating SSL certificate for ${DOMAIN}..."
        
        if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
            sudo certbot certonly --nginx -d ${DOMAIN} --agree-tos -n --email admin@${DOMAIN}
            print_success "SSL certificate generated"
            sudo systemctl reload nginx
        else
            print_warning "SSL certificate already exists for ${DOMAIN}"
        fi
    else
        print_warning "Certbot not installed. Skipping SSL setup."
        print_info "Install with: sudo apt install -y certbot python3-certbot-nginx"
    fi
}

create_backup_script() {
    print_header "Creating Backup Script"
    
    BACKUP_DIR="${APPS_DIR}/backups"
    mkdir -p "$BACKUP_DIR"
    
    cat > "$BACKUP_DIR/backup-collegeplacements.sh" << 'BACKUPEOF'
#!/bin/bash
BACKUP_DIR="$(dirname "$0")"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DB_NAME="collegeplacements_db"
DB_USER="collegeplacements"

# Create backup
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_$TIMESTAMP.sql"
pg_dump -U ${DB_USER} ${DB_NAME} > "$BACKUP_FILE"
gzip "$BACKUP_FILE"

# Keep only last 7 backups
find $BACKUP_DIR -name "${DB_NAME}_*.sql.gz" -mtime +7 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
BACKUPEOF
    
    chmod +x "$BACKUP_DIR/backup-collegeplacements.sh"
    print_success "Backup script created at $BACKUP_DIR/backup-collegeplacements.sh"
    
    # Setup cron for daily backups
    print_info "Setting up daily backup via cron (2 AM)..."
    (crontab -l 2>/dev/null || true; echo "0 2 * * * $BACKUP_DIR/backup-collegeplacements.sh") | crontab -
    print_success "Cron backup scheduled"
}

verify_deployment() {
    print_header "Verifying Deployment"
    
    # Check PM2 status
    print_info "Checking PM2 status..."
    if pm2 status ${APP_NAME} | grep -q "online"; then
        print_success "Application is running in PM2"
    else
        print_error "Application is not running"
        exit 1
    fi
    
    # Check port
    print_info "Checking if port ${API_PORT} is listening..."
    if sudo lsof -i :${API_PORT} > /dev/null 2>&1; then
        print_success "Port ${API_PORT} is listening"
    else
        print_error "Port ${API_PORT} is not listening"
        exit 1
    fi
    
    # Check database
    print_info "Checking database connection..."
    if PGPASSWORD="${DB_PASSWORD}" psql -h localhost -U ${DB_USER} -d ${DB_NAME} -c "SELECT 1" > /dev/null 2>&1; then
        print_success "Database connection successful"
    else
        print_error "Database connection failed"
        exit 1
    fi
    
    print_success "All verifications passed!"
}

display_summary() {
    print_header "Deployment Complete!"
    
    echo -e "${GREEN}College Placements has been successfully deployed on your VPS!${NC}\n"
    
    echo "📋 Deployment Summary:"
    echo "  Domain:           ${DOMAIN}"
    echo "  Backend Port:     ${API_PORT}"
    echo "  Database:         ${DB_NAME}"
    echo "  App Directory:    ${APPS_DIR}/collegeplacements"
    echo "  PM2 App Name:     ${APP_NAME}"
    echo ""
    
    echo "🔧 Useful Commands:"
    echo "  • View status:         pm2 status ${APP_NAME}"
    echo "  • View logs:           pm2 logs ${APP_NAME}"
    echo "  • Restart:             pm2 restart ${APP_NAME}"
    echo "  • Stop:                pm2 stop ${APP_NAME}"
    echo "  • Monitor:             pm2 monit"
    echo ""
    
    echo "🔗 Access Your Application:"
    echo "  • Website:             https://${DOMAIN}"
    echo "  • API:                 https://${DOMAIN}/api"
    echo ""
    
    echo "📝 Next Steps:"
    echo "  1. Update DNS records to point to this VPS IP"
    echo "  2. Verify SSL certificate is valid: sudo certbot certificates"
    echo "  3. Configure email settings in .env file"
    echo "  4. Create admin account and verify login"
    echo "  5. Monitor logs: pm2 logs ${APP_NAME}"
    echo ""
    
    echo "💾 Backups:"
    echo "  • Location:            ${APPS_DIR}/backups"
    echo "  • Daily backup:        2:00 AM (via cron)"
    echo "  • Manual backup:       ${APPS_DIR}/backups/backup-collegeplacements.sh"
    echo ""
    
    echo -e "${BLUE}Thank you for using College Placements!${NC}\n"
}

# Main execution
main() {
    print_header "College Placements - VPS Dual Instance Setup"
    
    echo "This script will deploy College Placements alongside CampusConnect"
    echo "Configuration Details:"
    echo "  Domain:            ${DOMAIN}"
    echo "  Backend Port:      ${API_PORT}"
    echo "  Database User:     ${DB_USER}"
    echo "  Repository:        ${REPO_URL}"
    echo ""
    
    read -p "Continue with deployment? (yes/no) " -n 3 -r
    echo
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        print_warning "Deployment cancelled"
        exit 1
    fi
    
    check_prerequisites
    create_database
    clone_repository
    configure_environment
    install_dependencies
    build_frontend
    run_migrations
    setup_pm2
    setup_nginx
    setup_ssl
    create_backup_script
    verify_deployment
    display_summary
}

# Run main function
main
