#!/usr/bin/env bash
# deploy/triage-api-down.sh
#
# Diagnose (and optionally fix) "site loads but nothing works" — every /api/*
# request returning the HTML page instead of JSON.
#
# ⚠️  SHARED PRODUCTION VPS. Also hosts tricitymatch, cityfreshkart,
#     college-placements, ecom, school.globoniks.com, tricitylifeinsurance.
#     This script is READ-ONLY by default. It never restarts nginx, never
#     touches another site's config, and never runs a docker command.
#
# Usage:
#   bash triage-api-down.sh          # diagnose only, changes nothing
#   bash triage-api-down.sh --fix    # additionally restore the /api proxy
#                                    # (backs up first, nginx -t, then reload)

set -uo pipefail

FIX=0
[[ "${1:-}" == "--fix" ]] && FIX=1

API_PORT="${API_PORT:-5001}"
SITE_GLOB="/etc/nginx/sites-enabled/*"

hr()   { printf '%s\n' "────────────────────────────────────────────────────────"; }
say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ok\033[0m  %s\n' "$*"; }
bad()  { printf '\033[1;31m  !!\033[0m  %s\n' "$*"; }
info() { printf '      %s\n' "$*"; }

hr; say "1. Is the Node API process running?"
if command -v pm2 >/dev/null 2>&1; then
  pm2 list 2>/dev/null | sed 's/^/      /'
else
  info "pm2 not found on PATH"
fi
info "systemd units mentioning edumapping:"
systemctl list-units --type=service --no-pager 2>/dev/null \
  | grep -i -E 'edumapping|campusconnect' | sed 's/^/      /' || info "(none)"

hr; say "2. Does the API answer directly on 127.0.0.1:$API_PORT?"
DIRECT=$(curl -s -m 8 -o /dev/null -w '%{http_code}' "http://127.0.0.1:$API_PORT/api/health" 2>/dev/null || echo 000)
DIRECT_BODY=$(curl -s -m 8 "http://127.0.0.1:$API_PORT/api/health" 2>/dev/null | head -c 200)
info "HTTP $DIRECT"
info "body: ${DIRECT_BODY:-<empty>}"
if [[ "$DIRECT" == "000" ]]; then
  bad "Nothing is listening on $API_PORT — the Node app is DOWN."
  info "=> This is the root cause. Fix with:  pm2 restart edumapping"
  info "   Then read why it died:            pm2 logs edumapping --lines 80"
  NODE_UP=0
elif echo "$DIRECT_BODY" | grep -q '^{'; then
  ok "Node is UP and returning JSON. The problem is in nginx, not the app."
  NODE_UP=1
else
  bad "Port $API_PORT answered but did not return JSON."
  NODE_UP=1
fi

hr; say "3. What is listening on the relevant ports?"
ss -tlnp 2>/dev/null | grep -E ":(80|443|$API_PORT)\b" | sed 's/^/      /' || info "(ss unavailable)"

hr; say "4. Which nginx site serves edumapping.com, and does it proxy /api?"
SITE_FILE=""
for f in $SITE_GLOB; do
  [[ -e "$f" ]] || continue
  if grep -qs 'edumapping' "$f"; then
    SITE_FILE="$f"
    ok "matched: $f"
  fi
done

if [[ -z "$SITE_FILE" ]]; then
  bad "No enabled nginx site mentions edumapping.com."
  info "Enabled sites:"
  ls -1 /etc/nginx/sites-enabled/ 2>/dev/null | sed 's/^/        /'
  info "=> The domain is being served by some other/default server block,"
  info "   which is why /api is not proxied."
else
  if grep -qE 'location\s+/api' "$SITE_FILE"; then
    ok "'location /api' IS present in $SITE_FILE"
    grep -nE -A6 'location\s+/api' "$SITE_FILE" | sed 's/^/      /'
  else
    bad "'location /api' is MISSING from $SITE_FILE"
    info "=> This is the bug. /api/* falls through to try_files -> index.html,"
    info "   which returns 200 text/html instead of JSON."
  fi
fi

hr; say "5. Is nginx config currently valid?"
nginx -t 2>&1 | sed 's/^/      /'

hr; say "6. Is this network/IP being blocked (why SSH times out)?"
if command -v fail2ban-client >/dev/null 2>&1; then
  fail2ban-client status 2>/dev/null | sed 's/^/      /'
  for jail in sshd recidive; do
    fail2ban-client status "$jail" 2>/dev/null | grep -iE 'banned' | sed "s/^/      [$jail] /"
  done
else
  info "fail2ban not installed"
fi
if command -v ufw >/dev/null 2>&1; then
  info "ufw:"; ufw status numbered 2>/dev/null | head -25 | sed 's/^/      /'
fi
info "iptables DROP/REJECT rules (first 20):"
iptables -L INPUT -n --line-numbers 2>/dev/null | grep -iE 'DROP|REJECT' | head -20 | sed 's/^/      /' || info "(none / unavailable)"

# ---------------------------------------------------------------------------
hr
if [[ $FIX -eq 0 ]]; then
  say "Diagnosis complete. Nothing was changed."
  say "Re-run with --fix to restore the /api proxy block if step 4 flagged it."
  exit 0
fi

say "FIX MODE"

if [[ -z "$SITE_FILE" ]]; then
  bad "Cannot auto-fix: no edumapping site file found. Create one from"
  bad "DEPLOYMENT_HOSTINGER.md and enable it manually."
  exit 1
fi

if grep -qE 'location\s+/api' "$SITE_FILE"; then
  say "'location /api' already present — nothing to change in nginx."
  say "If the API is still wrong, the problem is the Node process (step 2)."
  exit 0
fi

BACKUP="$SITE_FILE.bak.$(date +%Y%m%d-%H%M%S)"
cp -a "$SITE_FILE" "$BACKUP"
ok "backed up -> $BACKUP"

# Insert the proxy block immediately after the first `location / {` block's
# closing brace. Written with awk so we do not disturb anything else.
TMP=$(mktemp)
awk -v port="$API_PORT" '
  BEGIN { inserted=0; depth=0; inloc=0 }
  {
    print $0
    if (!inserted && $0 ~ /location[[:space:]]+\/[[:space:]]*\{/) { inloc=1; depth=1; next }
    if (inloc) {
      n=gsub(/\{/,"{"); m=gsub(/\}/,"}")
      depth += n - m
      if (depth <= 0) {
        print ""
        print "    # Proxy API requests to the Node backend."
        print "    # Restored by triage-api-down.sh — without this, /api/* falls"
        print "    # through to try_files and returns index.html as 200 text/html."
        print "    location /api {"
        print "        proxy_pass http://127.0.0.1:" port ";"
        print "        proxy_http_version 1.1;"
        print "        proxy_set_header Upgrade $http_upgrade;"
        print "        proxy_set_header Connection \"upgrade\";"
        print "        proxy_set_header Host $host;"
        print "        proxy_set_header X-Real-IP $remote_addr;"
        print "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;"
        print "        proxy_set_header X-Forwarded-Proto $scheme;"
        print "        proxy_cache_bypass $http_upgrade;"
        print "        proxy_connect_timeout 60s;"
        print "        proxy_send_timeout 60s;"
        print "        proxy_read_timeout 60s;"
        print "        proxy_buffering off;"
        print "    }"
        inserted=1; inloc=0
      }
    }
  }
' "$SITE_FILE" >"$TMP"

if ! grep -qE 'location\s+/api' "$TMP"; then
  bad "Could not place the block automatically. File untouched."
  rm -f "$TMP"
  exit 1
fi

cp "$TMP" "$SITE_FILE"; rm -f "$TMP"
ok "inserted 'location /api' into $SITE_FILE"

say "Validating nginx config (this checks EVERY site on the box)"
if nginx -t 2>&1 | sed 's/^/      /'; then
  say "Reloading nginx (graceful — existing connections finish, other sites unaffected)"
  systemctl reload nginx
  sleep 1
  RES=$(curl -s -m 8 -o /dev/null -w '%{http_code}' http://127.0.0.1/api/health -H 'Host: edumapping.com' 2>/dev/null || echo 000)
  CT=$(curl -s -m 8 -o /dev/null -w '%{content_type}' http://127.0.0.1/api/health -H 'Host: edumapping.com' 2>/dev/null || echo '?')
  info "/api/health via nginx -> HTTP $RES, content-type: $CT"
  if echo "$CT" | grep -qi json; then
    ok "FIXED — the API now returns JSON through nginx."
  else
    bad "Still not JSON. If step 2 said the Node app is DOWN, fix that next:"
    info "  pm2 restart edumapping && pm2 logs edumapping --lines 80"
  fi
else
  bad "nginx -t FAILED. Rolling back so no site is affected."
  cp -a "$BACKUP" "$SITE_FILE"
  nginx -t 2>&1 | sed 's/^/      /'
  bad "Restored from $BACKUP. nginx was NOT reloaded."
  exit 1
fi

hr
say "Confirm the other sites on this box are still healthy:"
for h in edumapping.com tricityshadi.com school.globoniks.com; do
  printf '      %-26s %s\n' "$h" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 "https://$h/" 2>/dev/null || echo FAIL)"
done
