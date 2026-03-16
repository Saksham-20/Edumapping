# How to Run Deploy Script on VPS

This guide explains how to execute the `deploy-vps-dual-setup.sh` script on your VPS to automatically set up College Placements alongside CampusConnect.

## Prerequisites

✅ VPS with root/sudo access (Ubuntu 20.04 LTS or 22.04 LTS)
✅ CampusConnect already running on port 5000
✅ PostgreSQL installed
✅ Node.js v16+ installed
✅ Nginx installed
✅ PM2 installed globally
✅ SSH access to VPS
✅ Git installed

## Step 1: Transfer Script to VPS

### Option A: Using SSH (Recommended)

On your **local machine** (Windows):

```powershell
# Copy script to VPS
scp D:\globoniks projects\collegeplacements\deploy-vps-dual-setup.sh your_user@your_vps_ip:/home/your_user/
```

### Option B: Clone Repository

If you have the script in your Git repository:

```bash
# On VPS
cd /home/your_user
git clone https://github.com/your-org/collegeplacements.git
cd collegeplacements
```

### Option C: Create Script on VPS

Create the script directly on VPS:

```bash
nano /home/your_user/deploy-vps-dual-setup.sh
# Paste the entire script content
# Press Ctrl+X, then Y, then Enter to save
```

## Step 2: Make Script Executable

```bash
chmod +x /home/your_user/deploy-vps-dual-setup.sh
```

## Step 3: Update Script Configuration

Edit the script with your specific details:

```bash
nano /home/your_user/deploy-vps-dual-setup.sh
```

Find and update these variables (around line 30):

```bash
# Line 31: Update repository URL
REPO_URL="https://github.com/YOUR_ORG/collegeplacements.git"

# Line 32: Confirm domain
DOMAIN="college-placements.globoniks.com"

# Line 33: API port (keep as 5001)
API_PORT="5001"

# Line 34-36: Database credentials
DB_USER="collegeplacements"
DB_NAME="collegeplacements_db"
DB_PASSWORD=""  # Will be prompted during execution
```

**Save the file:**
- Press `Ctrl+X`
- Press `Y`
- Press `Enter`

## Step 4: Run the Script

### Option A: Basic Execution

```bash
cd /home/your_user
./deploy-vps-dual-setup.sh
```

### Option B: Run with Output Logging

```bash
cd /home/your_user
./deploy-vps-dual-setup.sh 2>&1 | tee college-placements-deployment.log
```

This saves all output to `college-placements-deployment.log` for later review.

### Option C: Run in Background (Recommended for Large Deployments)

```bash
cd /home/your_user
nohup ./deploy-vps-dual-setup.sh > deployment.log 2>&1 &
echo $!  # Save the process ID
tail -f deployment.log  # Watch progress
```

## Step 5: Follow Interactive Prompts

The script will ask for:

1. **Database Password**
   ```
   Enter password for PostgreSQL user 'collegeplacements': 
   ```
   - Enter a strong password
   - Confirm it

2. **JWT Secret**
   ```
   Enter JWT_SECRET (or press Enter for auto-generated): 
   ```
   - Press Enter for auto-generated (recommended)
   - Or enter your own secret key

3. **Email Configuration** (Optional)
   ```
   Enter EMAIL_USER (Gmail address, or skip): 
   ```
   - Provide Gmail account or skip
   - Provide app password if using Gmail

4. **Proceed Confirmation**
   ```
   Proceed with deployment? (yes/no)
   ```
   - Type `yes` to continue

## Step 6: Monitor Deployment Progress

The script will show progress like:

```
════════════════════════════════════════
Step 1: Checking Prerequisites
════════════════════════════════════════

✓ Checking Node.js version
✓ Checking PostgreSQL installation
✓ Checking Nginx installation
✓ Checking PM2 installation

════════════════════════════════════════
Step 2: Creating Database
════════════════════════════════════════

✓ Database 'collegeplacements_db' created successfully
✓ User 'collegeplacements' created successfully

... (continues)
```

## Step 7: Verify Deployment Success

Once the script completes, verify everything is running:

```bash
# Check PM2 processes
pm2 list

# You should see both:
# - campusconnect-api    (port 5000)
# - college-placements-api (port 5001)

# Check if ports are listening
sudo netstat -tlnp | grep -E ':(5000|5001)'

# Test College Placements API
curl https://college-placements.globoniks.com/api/health

# View logs
pm2 logs college-placements-api
```

## Step 8: DNS Configuration (if not already done)

Make sure your DNS records point to the VPS IP:

```
college-placements.globoniks.com  A  <YOUR_VPS_IP>
```

Verify DNS:
```bash
dig college-placements.globoniks.com
```

## What the Script Does Automatically

✅ Checks system prerequisites (Node.js, PostgreSQL, Nginx, PM2)
✅ Creates separate PostgreSQL database for College Placements
✅ Clones repository from GitHub
✅ Creates `.env` file with proper configuration
✅ Installs npm dependencies for backend and frontend
✅ Builds React frontend
✅ Runs database migrations
✅ Creates PM2 ecosystem configuration
✅ Starts application with PM2 (2 instances for load balancing)
✅ Creates/updates Nginx configuration
✅ Reloads Nginx to route traffic
✅ Sets up SSL certificate (if not exists)
✅ Saves PM2 configuration for auto-startup

## Troubleshooting Script Execution

### Script Permission Denied
```bash
chmod +x deploy-vps-dual-setup.sh
./deploy-vps-dual-setup.sh
```

### Script Not Found
```bash
# Make sure you're in correct directory
cd /home/your_user
ls -la deploy-vps-dual-setup.sh

# Or use full path
/home/your_user/deploy-vps-dual-setup.sh
```

### Script Exits on Error

If the script fails, check the error message:

```bash
# Run again with error output
./deploy-vps-dual-setup.sh

# Or check logs
cat deployment.log | grep -i error
```

Common issues:

| Error | Solution |
|-------|----------|
| `Port 5001 already in use` | Kill existing process: `sudo lsof -i :5001` then `sudo kill -9 <PID>` |
| `Database already exists` | Drop old DB: `sudo -u postgres dropdb collegeplacements_db` |
| `npm install fails` | Check Node.js version: `node --version` |
| `Nginx config fails` | Check syntax: `sudo nginx -t` |
| `Git clone fails` | Check repo URL and SSH keys |

### Re-run Specific Steps

If you need to re-run only certain parts:

```bash
# Just install dependencies
cd /home/your_user/applications/collegeplacements
npm install  # backend
cd client && npm install  # frontend

# Just run migrations
cd /home/your_user/applications/collegeplacements/server
npm run migrate

# Just start with PM2
pm2 start college-placements-ecosystem.config.js

# Just reload Nginx
sudo systemctl reload nginx
```

## Post-Deployment Steps

### 1. Create Admin User (if needed)

```bash
cd /home/your_user/applications/collegeplacements/server
npm run create-admin
# Follow prompts to create admin account
```

### 2. Seed Sample Data (Optional)

```bash
npm run seed
```

### 3. Test Application

```bash
# Test API
curl https://college-placements.globoniks.com/api/health

# Test frontend (open in browser)
https://college-placements.globoniks.com

# Test login
- Go to https://college-placements.globoniks.com
- Click "Register"
- Create test student account
```

### 4. Backup Configuration

```bash
# Backup script and configuration
cp /home/your_user/deploy-vps-dual-setup.sh /home/your_user/backups/
cp /home/your_user/applications/collegeplacements/server/.env /home/your_user/backups/
```

### 5. Enable Auto-startup

```bash
pm2 startup
pm2 save
```

This ensures College Placements restarts automatically after VPS reboot.

## Monitoring After Deployment

```bash
# Real-time monitoring
pm2 monit

# View logs
pm2 logs college-placements-api

# Check resource usage
pm2 describe college-placements-api

# View last 100 lines
pm2 logs college-placements-api --lines 100

# View only errors
pm2 logs college-placements-api | grep -i error
```

## Rolling Back Deployment

If something goes wrong:

```bash
# Stop College Placements
pm2 stop college-placements-api

# Remove from PM2
pm2 delete college-placements-api

# Optionally remove directory
rm -rf /home/your_user/applications/collegeplacements

# Drop database
sudo -u postgres dropdb collegeplacements_db

# Remove Nginx config
sudo rm /etc/nginx/sites-enabled/college-placements
sudo systemctl reload nginx
```

## Re-running the Script

You can safely re-run the script if needed:

```bash
./deploy-vps-dual-setup.sh
```

The script will:
- Skip existing steps (databases won't be recreated)
- Update configuration files
- Reinstall dependencies
- Rebuild frontend
- Restart services

## Updating Deployed Application

To update College Placements after deployment:

```bash
cd /home/your_user/applications/collegeplacements
git pull origin main
cd server && npm install
npm run migrate
cd ../client && npm install && npm run build
pm2 restart college-placements-api
```

## Useful Commands After Deployment

```bash
# Check both instances status
pm2 list

# Restart College Placements
pm2 restart college-placements-api

# Restart all
pm2 restart all

# Stop CampusConnect only (don't affect College Placements)
pm2 stop campusconnect-api

# View College Placements specific logs
pm2 logs college-placements-api

# Check ports
sudo netstat -tlnp | grep -E ':(5000|5001|80|443)'

# Check Nginx
sudo nginx -t
sudo systemctl status nginx

# Check PostgreSQL
sudo systemctl status postgresql
```

## Script Execution Checklist

Before running the script:

- [ ] SSH access to VPS confirmed
- [ ] Script transferred to VPS
- [ ] Script permissions set (chmod +x)
- [ ] Repository URL updated in script
- [ ] Domain name confirmed (college-placements.globoniks.com)
- [ ] CampusConnect running on port 5000
- [ ] PostgreSQL installed and running
- [ ] Nginx installed and running
- [ ] PM2 installed globally
- [ ] Database password ready (or will generate)
- [ ] Email credentials ready (optional)

During execution:

- [ ] Watch for any error messages
- [ ] Note down database password if auto-generated
- [ ] Confirm JWT secrets
- [ ] Verify DNS is pointing to VPS IP

After execution:

- [ ] Verify PM2 shows both instances
- [ ] Check ports are listening
- [ ] Test API endpoint
- [ ] Test frontend load
- [ ] Check logs for errors
- [ ] Save auto-generated secrets to secure location

---

**Last Updated**: March 15, 2026
**Script Version**: 1.0
**Compatibility**: Ubuntu 20.04 LTS, 22.04 LTS
