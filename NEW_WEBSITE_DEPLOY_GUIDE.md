# Quick Deployment Guide for Hostinger KVM1

## 🚀 One-Command Deployment

### Step 1: Edit the Script
Before running, update these variables in `deploy-hostinger.sh`:

```bash
DOMAIN_NAME="yourdomain.com"  # Change to your actual domain
```

### Step 2: Upload Script to Server
```bash
# From your local machine
scp deploy-hostinger.sh root@your-vps-ip:/root/
```

### Step 3: Run the Deployment Script
```bash
# SSH into your server
ssh root@your-vps-ip

# Make executable (if not already)
chmod +x deploy-hostinger.sh

# Run the script
sudo bash deploy-hostinger.sh
```

## 📋 What the Script Does

✅ Updates system packages  
✅ Installs Node.js 20.x  
✅ Sets up PostgreSQL database  
✅ Installs and configures Redis  
✅ Installs and configures MinIO  
✅ Clones/prepares your project  
✅ Runs database migrations  
✅ Sets up PM2 process manager  
✅ Builds React frontend  
✅ Configures Nginx  
✅ Creates environment variables  
✅ Saves all credentials to `~/edumapping-credentials.txt`  

## ⚙️ Before Running

1. **Update Domain Name**: Edit `DOMAIN_NAME` in the script
2. **Have Your Project Ready**: 
   - Either upload your project to `/var/www/campusconnect`
   - Or the script will prompt you to clone it
3. **DNS Setup**: Point your domain to your VPS IP address

## 🔧 After Deployment

### Enable SSL (HTTPS)
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Check Application Status
```bash
# Backend status
pm2 status
pm2 logs edumapping-api

# Nginx status
sudo systemctl status nginx

# Database status
sudo systemctl status postgresql

# Redis status
sudo systemctl status redis-server

# MinIO status
sudo systemctl status minio
```

### Restart Services
```bash
# Restart backend
pm2 restart edumapping-api

# Restart Nginx
sudo systemctl restart nginx

# Restart database
sudo systemctl restart postgresql
```

### View Logs
```bash
# Application logs
pm2 logs edumapping-api

# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

## 🔑 Credentials Location

All credentials are saved to:
```
~/edumapping-credentials.txt
```

**⚠️ IMPORTANT**: Save this file securely and delete it from the server after noting credentials!

## 📝 Manual Configuration After Deployment

1. **Update Email Settings** in `server/.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   ```

2. **Create MinIO Bucket**:
   - Visit: `http://your-vps-ip:9001`
   - Login with MinIO credentials (saved in credentials file)
   - Create bucket: `edumapping-files`

3. **Configure Frontend**:
   - Frontend build is at: `/var/www/campusconnect/client/build`
   - API URL is set to: `https://yourdomain.com/api`

## 🐛 Troubleshooting

### Backend Not Starting
```bash
pm2 logs edumapping-api
# Check for database connection errors
# Verify .env file exists and has correct values
```

### Database Connection Issues
```bash
# Test PostgreSQL connection
sudo -u postgres psql -d edumapping_prod

# Check if database exists
sudo -u postgres psql -l | grep edumapping
```

### Nginx Not Serving Frontend
```bash
# Check Nginx config
sudo nginx -t

# Check file permissions
ls -la /var/www/campusconnect/client/build

# Restart Nginx
sudo systemctl restart nginx
```

### Port Already in Use
```bash
# Check what's using port 5000
sudo lsof -i :5000

# Kill process if needed
sudo kill -9 <PID>
```

## 📊 Resource Monitoring

```bash
# Install htop for monitoring
sudo apt install -y htop

# View resources
htop

# Check disk usage
df -h

# Check memory
free -h
```

## 🔒 Security Checklist

- [ ] Firewall is enabled (UFW)
- [ ] Strong passwords set
- [ ] SSL certificate installed
- [ ] SSH keys configured (disable password auth)
- [ ] Fail2ban installed and configured
- [ ] Regular backups scheduled
- [ ] Credentials file removed from server

## 🎯 Project Structure After Deployment

```
/var/www/campusconnect/
├── server/
│   ├── .env              # Production environment variables
│   ├── src/
│   └── node_modules/
├── client/
│   ├── build/            # Production build (served by Nginx)
│   └── node_modules/
└── ...
```

## 📞 Quick Commands Reference

```bash
# PM2 Commands
pm2 list                  # List all apps
pm2 restart edumapping-api
pm2 stop edumapping-api
pm2 logs edumapping-api
pm2 monit                 # Monitor dashboard

# Service Commands
sudo systemctl status nginx
sudo systemctl restart nginx
sudo systemctl status postgresql
sudo systemctl restart postgresql
sudo systemctl status redis-server
sudo systemctl status minio

# Database Commands
sudo -u postgres psql -d edumapping_prod
sudo -u postgres pg_dump edumapping_prod > backup.sql

# Nginx Commands
sudo nginx -t             # Test configuration
sudo nginx -s reload      # Reload configuration
sudo tail -f /var/log/nginx/error.log
```

---

**Need Help?** Check the full deployment guide: `DEPLOYMENT_HOSTINGER.md`

