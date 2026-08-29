#!/usr/bin/env bash
# deploy/livekit/install-livekit.sh
#
# Installs the LiveKit SFU for EduMapping live classes.
#
# ⚠️  THIS RUNS ON A SHARED PRODUCTION VPS.
#     Other live sites on this box: tricitymatch, cityfreshkart,
#     college-placements, ecom, edumapping.com, school.globoniks.com,
#     tricitylifeinsurance.
#
#     This script is written to be safe alongside them. It will NEVER:
#       - stop, prune or restart docker or any container
#       - restart nginx (it only *reloads*, and only after `nginx -t` passes)
#       - touch any nginx file other than printing what YOU should paste
#       - bind a port that is already in use (it checks first and aborts)
#       - modify any other systemd unit
#
# Usage:  sudo bash install-livekit.sh
# Re-runnable: yes, it is idempotent.

set -euo pipefail

LIVEKIT_VERSION="${LIVEKIT_VERSION:-latest}"
CONF_DIR=/etc/livekit
LOG_DIR=/var/log/livekit
BIN=/usr/local/bin/livekit-server
DOMAIN="${DOMAIN:-edumapping.com}"
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ports this install will claim.
REQUIRED_PORTS_TCP=(7880 7881 5349)
REQUIRED_PORTS_UDP=(7882 3478)

say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[abort]\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Run as root (sudo bash install-livekit.sh)"

# ---------------------------------------------------------------------------
# 1. Refuse to collide with a co-tenant's port
# ---------------------------------------------------------------------------
say "Checking that our ports are free (shared host — a collision would break another site)"
for p in "${REQUIRED_PORTS_TCP[@]}"; do
  if ss -tlnH "sport = :$p" 2>/dev/null | grep -q .; then
    owner=$(ss -tlnpH "sport = :$p" 2>/dev/null | head -1 || true)
    # Our own service re-running is fine.
    if echo "$owner" | grep -q livekit; then
      warn "TCP $p already held by livekit (re-run) — continuing"
    else
      die "TCP port $p is in use by another service:
    $owner
  Pick a different port in livekit.yaml rather than killing that process."
    fi
  fi
done
for p in "${REQUIRED_PORTS_UDP[@]}"; do
  if ss -ulnH "sport = :$p" 2>/dev/null | grep -q .; then
    owner=$(ss -ulnpH "sport = :$p" 2>/dev/null | head -1 || true)
    echo "$owner" | grep -q livekit || die "UDP port $p is in use:
    $owner"
  fi
done
say "Ports are free."

# ---------------------------------------------------------------------------
# 2. Binary
# ---------------------------------------------------------------------------
if [[ -x "$BIN" ]]; then
  say "livekit-server already installed: $($BIN --version 2>/dev/null || echo unknown)"
else
  say "Installing livekit-server"
  # Official installer writes only to /usr/local/bin.
  curl -sSL https://get.livekit.io | bash
  [[ -x "$BIN" ]] || die "Install failed — $BIN not found"
fi

# ---------------------------------------------------------------------------
# 3. User, directories
# ---------------------------------------------------------------------------
if ! id -u livekit >/dev/null 2>&1; then
  say "Creating system user 'livekit'"
  useradd --system --no-create-home --shell /usr/sbin/nologin livekit
fi

mkdir -p "$CONF_DIR/certs" "$LOG_DIR"
chown -R livekit:livekit "$LOG_DIR"
chmod 750 "$CONF_DIR"

# ---------------------------------------------------------------------------
# 4. Keys — generated once, then reused on every re-run
# ---------------------------------------------------------------------------
KEYS_ENV="$CONF_DIR/keys.env"
if [[ -f "$KEYS_ENV" ]]; then
  say "Reusing existing API keys from $KEYS_ENV"
  # shellcheck disable=SC1090
  source "$KEYS_ENV"
else
  say "Generating API key/secret"
  LIVEKIT_API_KEY="API$(openssl rand -hex 6)"
  # LiveKit requires a secret of at least 32 characters.
  LIVEKIT_API_SECRET="$(openssl rand -base64 48 | tr -d '\n/+=' | head -c 48)"
  cat >"$KEYS_ENV" <<EOF
LIVEKIT_API_KEY=$LIVEKIT_API_KEY
LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET
EOF
  chmod 600 "$KEYS_ENV"
  chown root:root "$KEYS_ENV"
fi

# ---------------------------------------------------------------------------
# 5. Config
# ---------------------------------------------------------------------------
say "Writing $CONF_DIR/livekit.yaml"
sed -e "s|EDUMAPPING_API_KEY_PLACEHOLDER|$LIVEKIT_API_KEY|g" \
    -e "s|EDUMAPPING_API_SECRET_PLACEHOLDER|$LIVEKIT_API_SECRET|g" \
    -e "s|domain: edumapping.com|domain: $DOMAIN|" \
    "$REPO_DIR/livekit.yaml" >"$CONF_DIR/livekit.yaml"
chown root:livekit "$CONF_DIR/livekit.yaml"
chmod 640 "$CONF_DIR/livekit.yaml"

# ---------------------------------------------------------------------------
# 6. TLS material for the embedded TURN server
# ---------------------------------------------------------------------------
LE_DIR="/etc/letsencrypt/live/$DOMAIN"
if [[ -d "$LE_DIR" ]]; then
  say "Linking Let's Encrypt certs for TURN/TLS"
  # Copy rather than symlink: the unit runs with ProtectSystem=strict and the
  # livekit user cannot traverse /etc/letsencrypt/archive.
  install -o livekit -g livekit -m 640 "$LE_DIR/fullchain.pem" "$CONF_DIR/certs/fullchain.pem"
  install -o livekit -g livekit -m 640 "$LE_DIR/privkey.pem"  "$CONF_DIR/certs/privkey.pem"
  cat >/etc/cron.weekly/livekit-cert-sync <<EOF
#!/bin/sh
# Keep LiveKit's TURN certs in step with certbot renewals.
install -o livekit -g livekit -m 640 $LE_DIR/fullchain.pem $CONF_DIR/certs/fullchain.pem
install -o livekit -g livekit -m 640 $LE_DIR/privkey.pem  $CONF_DIR/certs/privkey.pem
systemctl try-restart livekit
EOF
  chmod +x /etc/cron.weekly/livekit-cert-sync
else
  warn "No certs at $LE_DIR — disabling TURN/TLS in the config."
  warn "TURN/UDP on 3478 still works; users on UDP-blocked networks may fail."
  sed -i 's|^  tls_port: 5349|  # tls_port disabled — no certificate found|' "$CONF_DIR/livekit.yaml"
  sed -i 's|^  cert_file:|  # cert_file:|; s|^  key_file:|  # key_file:|' "$CONF_DIR/livekit.yaml"
fi

# ---------------------------------------------------------------------------
# 7. systemd
# ---------------------------------------------------------------------------
say "Installing systemd unit"
cp "$REPO_DIR/livekit.service" /etc/systemd/system/livekit.service
systemctl daemon-reload
systemctl enable livekit >/dev/null 2>&1 || true
# try-restart only touches OUR unit.
systemctl restart livekit
sleep 2
systemctl is-active --quiet livekit \
  && say "livekit.service is running" \
  || die "livekit failed to start — check: journalctl -u livekit -n 50"

# ---------------------------------------------------------------------------
# 8. Firewall (only if ufw is already active — never enable it ourselves,
#    that could lock out the other sites' admins)
# ---------------------------------------------------------------------------
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  say "Opening LiveKit ports in ufw"
  ufw allow 7881/tcp comment 'livekit ice-tcp' >/dev/null
  ufw allow 7882/udp comment 'livekit media'   >/dev/null
  ufw allow 3478/udp comment 'livekit turn'    >/dev/null
  ufw allow 5349/tcp comment 'livekit turn-tls'>/dev/null
else
  warn "ufw not active — open these yourself if a firewall sits in front:"
  warn "  7881/tcp, 7882/udp, 3478/udp, 5349/tcp"
fi

# ---------------------------------------------------------------------------
# 9. What the operator still has to do by hand
# ---------------------------------------------------------------------------
cat <<EOF

────────────────────────────────────────────────────────────────────────────
 LiveKit is installed and running.

 1. Add these to the EduMapping API env file (server/.env), then
    restart ONLY the api:  pm2 restart edumapping

      LIVEKIT_URL=http://127.0.0.1:7880
      LIVEKIT_PUBLIC_URL=wss://$DOMAIN/livekit
      LIVEKIT_API_KEY=$LIVEKIT_API_KEY
      LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET

 2. Add the WebSocket proxy to the edumapping nginx SITE file only
    (contents in $REPO_DIR/nginx-livekit-location.conf), then:

      nginx -t && systemctl reload nginx

    Do NOT restart nginx and do NOT edit any other site file —
    seven other production sites share this box.

 3. Run the database migrations for the conference tables:

      cd /var/www/campusconnect/server && npm run db:migrate:prod

 4. Verify:
      curl -s http://127.0.0.1:7880/         # LiveKit responds
      curl -s https://$DOMAIN/api/health     # API still healthy
────────────────────────────────────────────────────────────────────────────
EOF
