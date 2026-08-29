# Live classes — LiveKit deployment

Self-hosted Zoom-style conferencing for EduMapping. Free, open source
(Apache-2.0), no per-minute billing.

---

## Why LiveKit

The product rule is: **the teacher publishes video and screen share; students
may only speak, raise a hand, and mute/unmute themselves.** That has to hold
even if a student edits the JavaScript in their browser.

LiveKit expresses exactly that in one signed token claim:

```js
canPublishSources: [TrackSource.MICROPHONE]   // student
```

The SFU refuses a publish request for any source not in that list
(`ParticipantImpl.AddTrack` → `RequestResponse_NOT_ALLOWED`) *before* a track
is allocated. There is no publish-then-mute window, and the browser is never
trusted.

The alternatives were evaluated and rejected:

| Option | Why not |
|---|---|
| **Jitsi Meet** | Has **no camera/video flag in the JWT at all**. The only server-enforced non-publishing tier is "visitors", which is receive-only — it would also stop students *speaking*, breaking the requirement. The other route (room-wide AV moderation) is a mode, not a per-identity permission. Also wants 4 cores / 8 GB documented minimum. |
| **mediasoup** | Equally solid enforcement, but no React SDK and ~400–800 lines of signalling to write and maintain. Now requires Node ≥ 22; this repo targets 18. |
| **Janus** | Browsers talk to it directly; permission model is reactive, not preventive. GPL-3.0 server. |
| **BigBlueButton** | Best permission model of all, but needs a dedicated 16 GB / 8-core box and wants to own :80 and :443 — impossible on a shared host. |
| **P2P mesh** | Teacher uplink is `N × ~4 Mbps` and needs `2N` hardware encoders. Breaks around **N≈5**, and cannot be secured against a modified client. |

---

## ⚠️ This is a shared VPS

`178.16.138.82` also runs tricitymatch, cityfreshkart, college-placements,
ecom, school.globoniks.com and tricitylifeinsurance.

* **Never** `docker stop/rm/prune`, `docker compose down`, or
  `systemctl restart docker`.
* **Never** restart nginx. Edit only the edumapping site file, run
  `nginx -t`, then `systemctl reload nginx`.
* Ports already taken: `80, 443, 3000, 3001, 3002, 5000, 5001, 5002, 5003,
  5006, 9000, 9001`. LiveKit deliberately uses the free `78xx` range.

`install-livekit.sh` refuses to start if any port it wants is already held by
someone else, rather than stealing it.

---

## Ports

| Port | Proto | Exposed? | Purpose |
|---|---|---|---|
| 7880 | TCP | **loopback only** | HTTP + WebSocket signalling; nginx proxies `/livekit` to it |
| 7881 | TCP | public | WebRTC ICE/TCP fallback (cannot sit behind TLS) |
| 7882 | UDP | public | WebRTC media, multiplexed onto one port |
| 3478 | UDP | public | Embedded TURN |
| 5349 | TCP | public | Embedded TURN over TLS |

### The TURN-on-443 trade-off (read this)

LiveKit's docs recommend TURN/TLS on **443**, because some school and
corporate networks block everything else. **We cannot do that** — nginx owns
443 for seven other sites, and taking it would break them.

TURN/TLS runs on **5349** instead. Roughly **15–25% of users need TURN at all**
(published measurements range 9–30%), and only the subset of those behind a
"443-only" firewall will fail to connect. If that turns out to hurt in
practice, the options are, in order of preference:

1. Give LiveKit its own small VPS with its own IP, and put TURN on 443 there.
2. Add an nginx `stream {}` block with SNI multiplexing on 443 — **this edits
   global nginx config and risks every site on the box.** Do not do this
   casually.

---

## Install

```bash
scp -r deploy/livekit root@178.16.138.82:/root/livekit-deploy
ssh tricityshadi-vps
sudo bash /root/livekit-deploy/install-livekit.sh
```

The script is idempotent and re-runnable. It creates a `livekit` system user,
installs the binary, generates and persists API keys in `/etc/livekit/keys.env`,
copies the domain's Let's Encrypt certs for TURN/TLS (with a weekly cron to
keep them fresh), and installs a resource-capped systemd unit.

Then, as the script's closing message repeats:

1. Put `LIVEKIT_*` into `server/.env` → `pm2 restart edumapping`
2. Paste `nginx-livekit-location.conf` into the **edumapping** site file →
   `nginx -t && systemctl reload nginx`
3. `cd /var/www/campusconnect/server && npm run db:migrate:prod`

---

## Capacity on this box — the honest numbers

The VPS is a **Hostinger KVM1: 1 vCPU, 4 GB RAM, ~4 TB/month transfer**, and
that single core already runs PostgreSQL, the Node API and nginx.

**Egress is `N × per-subscriber`** — this is the whole cost. Ingress from the
teacher (~5 Mbps) is irrelevant.

| Profile | Per subscriber | 30 students | 100 students |
|---|---|---|---|
| Screen share + audio, teacher camera off | ~1.3 Mbps | 39 Mbps | 130 Mbps |
| 360p camera + 720p15 screen share | ~2.1 Mbps | 63 Mbps | 210 Mbps |
| 720p camera + 1080p15 screen share | ~4.4 Mbps | 131 Mbps | 436 Mbps |

**The monthly transfer cap binds before CPU does.** 4 TB spread over 6
class-hours a day funds about **67 Mbps sustained** — roughly **32 students** at
the middle profile. Halve the class hours and you can double the students.

The `livekit.service` unit caps LiveKit at `CPUQuota=70%` and `MemoryMax=1200M`
deliberately: if a class gets busy, video should degrade rather than take
edumapping.com and six other sites down with it.

### Recommendation

**Plan for ~25–30 concurrent participants in one class at a time.** That is
comfortable. Beyond that:

* Tell teachers to keep their camera off while screen sharing (the single
  biggest saving — cuts per-student cost roughly in half).
* Move LiveKit to its own VPS. A 2 vCPU box with a 20 TB allowance (Hetzner
  CX-class, ~€4.50/mo) supports ~165 concurrent students and costs less than
  the bandwidth overage would.

⚠️ Watch metered transfer. On a metered provider, 100 students at the middle
profile for 400 class-hours is ~370 GB/hour-of-class-time territory — cheap on
a generous allowance, ruinous at ~$10/TB overage.

---

## Recording

**Not enabled, deliberately.** LiveKit Egress is free and Apache-2.0, but
RoomComposite recording runs a headless Chrome and transcodes: it needs its own
**4 CPU / 4 GB** instance plus Redis, and records one room at a time. It cannot
share this box.

If recording becomes a requirement: use **Track egress** (raw per-track, no
transcode, many jobs per instance) and mux with ffmpeg offline, or put Egress
on a separate machine.

---

## Operating

```bash
systemctl status livekit
journalctl -u livekit -n 100 --no-pager
tail -f /var/log/livekit/livekit.log

systemctl restart livekit        # safe: touches only this unit
curl -s http://127.0.0.1:6789/metrics | head   # Prometheus metrics
```

**Health check after any change — confirm the co-tenants are still up:**

```bash
nginx -t
for h in edumapping.com tricityshadi.com school.globoniks.com; do
  printf '%-28s %s\n' "$h" "$(curl -s -o /dev/null -w '%{http_code}' -m 10 "https://$h/")"
done
```

### Troubleshooting

| Symptom | Cause |
|---|---|
| Client connects then drops after ~60s | `proxy_read_timeout` missing from the nginx location block |
| "Could not connect" on some networks only | TURN not reachable — check 3478/udp and 5349/tcp are open |
| API returns 503 on `/api/conferences/*` | `LIVEKIT_*` env vars not set, or the API wasn't restarted |
| Students can turn their camera on | Should be impossible. Decode the token at jwt.io and confirm `video.canPublishSources` is `["microphone"]` |
| Webhooks not arriving | LiveKit posts to `127.0.0.1:5001`; confirm the API listens there and the path is exempt from rate limiting |

---

## Security model

* **Publish rights** are enforced by the SFU from the signed token. The UI
  reads the granted permissions rather than assuming them, so it stays correct
  if a host changes room policy mid-session.
* **Kick** calls `removeParticipant({ revokeTokenTs })`, which invalidates the
  token the user is holding. That alone is not enough — nothing stops them
  asking our API for a new one. So the ban is **written to Postgres first**
  (`conference_participants.is_banned`) and the token endpoint refuses to mint
  a replacement. Same for hard mute.
* **Moderation endpoints** re-derive host/co-host status from the database on
  every call. A student cannot mute or kick anyone even with a crafted request.
* **Webhooks** are verified against the raw request body with
  `WebhookReceiver`, and the route is mounted before `express.json()` so the
  signature still matches.
