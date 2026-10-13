// server/src/services/fileAccessService.js
/**
 * Who may download a stored upload.
 *
 * Uploads are named by fileService as `<ts>-<random>-<kind>_<id>_…`, where
 * `kind` says what the file is and `id` whose it is:
 *
 *   profile_<userId>_      profile picture        public
 *   logo_<orgId>_          organization logo      public
 *   resume_<userId>_       resume                 private
 *   marksheet_<userId>_    marksheet              private
 *   offerletter_<offerId>_ offer letter           private
 *   upload_<userId>_       generic /files/upload  private
 *
 * Older files lack the random segment and generic uploads used to keep the
 * browser's original name; those are resolved through the `files` table.
 *
 * A private file is visible to whoever may see its owner (accessService:
 * self, admin, same-institution staff, scoped recruiter, recruiter the student
 * applied to). An offer letter is additionally visible to the organization
 * that made the offer. Anything that cannot be attributed to an owner is
 * treated as nobody's but an admin's.
 */
const path = require('path');
const { Op } = require('sequelize');
const { File, Offer, User, AuditLog } = require('../models');
const accessService = require('./accessService');

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
const PUBLIC_KINDS = ['profile', 'logo'];

// Served Content-Type by extension. Anything not listed is sent as an opaque
// download; nothing is ever served as text/html, script or SVG.
const CONTENT_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp'
};

const NAME_PATTERN = /^\d+-(?:[0-9a-f]{16}-)?([a-z]+)_(\d+)_/i;

function parseUploadName(name) {
  const match = NAME_PATTERN.exec(name || '');
  if (!match) return null;
  return { kind: match[1].toLowerCase(), id: parseInt(match[2], 10) };
}

/** Public /uploads mount: profile pictures and logos only, and only as images. */
function isPublicUploadName(name) {
  if (!name || name.startsWith('.')) return false;
  if (!IMAGE_EXTENSIONS.includes(path.extname(name).toLowerCase())) return false;
  const parsed = parseUploadName(name);
  return !!parsed && PUBLIC_KINDS.includes(parsed.kind);
}

/**
 * Reduce whatever the client holds — '/uploads/x.pdf', 'uploads/x.pdf' (a
 * MinIO object name), a full URL, or an absolute server path from older rows —
 * to the bare stored file name. Returns null for anything that is not a plain
 * name once reduced, so `..` and friends never reach the filesystem.
 */
function storedNameFromPath(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let p = raw.trim();
  try {
    if (/^https?:\/\//i.test(p)) p = new URL(p).pathname;
    p = decodeURIComponent(p);
  } catch (e) {
    return null;
  }
  const idx = p.lastIndexOf('/uploads/');
  if (idx !== -1) p = p.slice(idx + '/uploads/'.length);
  else if (p.startsWith('uploads/')) p = p.slice('uploads/'.length);
  else if (p.includes('/')) p = path.basename(p);
  if (!p || p.includes('/') || p.includes('\\') || p.startsWith('.') || p.includes('\0')) return null;
  return p;
}

function contentTypeFor(name) {
  return CONTENT_TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream';
}

function isImageName(name) {
  return IMAGE_EXTENSIONS.includes(path.extname(name).toLowerCase());
}

/** The `files` row for a stored name, matched on the exact basename. */
async function findFileRow(name) {
  const escaped = name.replace(/[\\%_]/g, (c) => `\\${c}`);
  const rows = await File.findAll({
    where: { filePath: { [Op.like]: `%${escaped}` } },
    limit: 5
  });
  return rows.find((r) => path.basename(r.filePath) === name) || null;
}

/**
 * Decide whether `viewer` may read the stored file `name`.
 * Returns { allowed, name, downloadName, ownerId, kind } — `allowed` false
 * covers both "no such file" and "not yours", so callers answer 404 for both.
 */
async function checkFileAccess(viewer, name, { fileRow } = {}) {
  const result = { allowed: false, name, downloadName: name, ownerId: null, kind: null };
  if (!viewer || !name) return result;

  // The files table is consulted first: its rows are written by the server
  // with the uploader's id, whereas a name prefix on a generic upload once
  // came from the browser.
  const row = fileRow || (await findFileRow(name));
  const parsed = parseUploadName(name);
  let offer = null;

  if (row) {
    result.ownerId = row.userId;
    result.kind = row.fileType;
    result.downloadName = row.originalName || name;
    if (row.isPublic) {
      result.allowed = true;
      return result;
    }
  } else if (parsed) {
    result.kind = parsed.kind;
    if (PUBLIC_KINDS.includes(parsed.kind)) {
      result.allowed = true;
      return result;
    }
    if (parsed.kind === 'offerletter') {
      offer = await Offer.findByPk(parsed.id, { attributes: ['id', 'studentId', 'organizationId'] });
      result.ownerId = offer ? offer.studentId : null;
    } else {
      result.ownerId = parsed.id;
    }
  }

  if (viewer.role === 'admin') {
    result.allowed = true;
    return result;
  }
  if (!result.ownerId) return result;

  // The company that issued an offer can read the letter it uploaded.
  if (offer && viewer.role === 'recruiter' && viewer.organizationId === offer.organizationId) {
    result.allowed = true;
    return result;
  }

  const owner = await User.findByPk(result.ownerId, { attributes: ['id', 'role', 'organizationId'] });
  result.allowed = await accessService.canViewUser(viewer, owner);

  // A student can always see who looked at their documents.
  if (result.allowed && viewer.role === 'recruiter') {
    AuditLog.create({
      userId: viewer.id,
      action: 'recruiter_file_access',
      entityType: 'file',
      entityId: row ? row.id : null,
      newValues: { file: name, ownerId: result.ownerId, kind: result.kind }
    }).catch(() => {});
  }
  return result;
}

module.exports = {
  parseUploadName,
  isPublicUploadName,
  storedNameFromPath,
  contentTypeFor,
  isImageName,
  findFileRow,
  checkFileAccess
};
