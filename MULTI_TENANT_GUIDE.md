# Hosting a Second Instance on the Same VPS

This guide explains how to host a completely new instance of CampusConnect on your existing Hostinger VPS. This second instance will have a fresh, isolated database and run alongside the existing `edumapping.com` app.

---

## 1. Prepare the New Directory

1. SSH into your VPS:
   ```bash
   ssh root@your-vps-ip
   ```

2. Create a new directory for the second website and copy your code over:
   ```bash
   # We'll call the new folder 'campusconnect2'
   mkdir -p /var/www/campusconnect2
   
   # You can either clone the repo again:
   cd /var/www
   git clone <your-repo-url> campusconnect2
   
   # OR if your existing folder doesn't have local Git changes, 
   # just duplicate the existing folder (faster):
   cp -r /var/www/campusconnect /var/www/campusconnect2
   ```

---

## 2. Create a New Database

Instead of modifying `.env` to point to a new server, we keep the database on `localhost` but create a completely isolated database name.

1. Log into your PostgreSQL instance:
   ```bash
   sudo -u postgres psql
   ```

2. Inside the PostgreSQL shell, create the new database and give the existing user access (replace `new_website_prod` with whatever name you prefer):
   ```sql
   CREATE DATABASE new_website_prod;
   GRANT ALL PRIVILEGES ON DATABASE new_website_prod TO edumapping_user;
   \q
   ```
   *(Assuming your existing user is `edumapping_user` as per your deployment script).*

---

## 3. Configure the Second Backend

The second instance must run on a **different port** to avoid conflicting with the first one. Let's use `PORT=5001`.

1. Edit the `.env` file for the new instance:
   ```bash
   nano /var/www/campusconnect2/server/.env
   ```

2. Change these specific lines while keeping everything else (like SMTP or JWT secrets):
   ```env
   # Change Port
   PORT=5001
   
   # Point to the new database
   DB_NAME=new_website_prod
   # Or if using URL format:
   DATABASE_URL=postgresql://edumapping_user:your-db-pass@localhost:5432/new_website_prod
   
   # Update URLs
   FRONTEND_URL=https://your-new-website.com,https://www.your-new-website.com
   API_PUBLIC_URL=https://your-new-website.com/api
   ```

3. Run migrations on the new database to create the empty tables:
   ```bash
   cd /var/www/campusconnect2/server
   npm install --production
   npm run db:migrate:prod
   npm run db:seed:prod
   ```

4. Start the new instance concurrently using PM2:
   ```bash
   # We give it a different PM2 name (e.g., new-website-api)
   pm2 start src/server.js --name new-website-api
   pm2 save
   ```

---

## 4. Build the Second Frontend

1. Navigate to the new client folder:
   ```bash
   cd /var/www/campusconnect2/client
   npm install
   ```

2. Export the correct new API URL before building:
   ```bash
   export REACT_APP_API_URL=https://your-new-website.com/api
   npm run build
   ```

---

## 5. Configure Nginx to Route Traffic

Now we tell Nginx to serve the second folder and the second port when someone visits the new domain.

1. Create a new Nginx block:
   ```bash
   nano /etc/nginx/sites-available/new-website
   ```

2. Add this configuration (notice it points to `campusconnect2` and `localhost:5001`):
   ```nginx
   server {
       listen 80;
       server_name your-new-website.com www.your-new-website.com;

       root /var/www/campusconnect2/client/build;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }

       location /api {
           proxy_pass http://localhost:5001; # NOTE THE CHANGED PORT!
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

3. Enable the site and restart Nginx:
   ```bash
   ln -s /etc/nginx/sites-available/new-website /etc/nginx/sites-enabled/
   nginx -t
   systemctl restart nginx
   ```

---

## 6. Secure the New Site

Finally, get an SSL certificate for the new domain:
```bash
certbot --nginx -d your-new-website.com -d www.your-new-website.com
```

### Done!
You now have `edumapping.com` running on Port 5000 pointing to DB `edumapping_prod`, and `your-new-website.com` running entirely separately on Port 5001 pointing to DB `new_website_prod`!
