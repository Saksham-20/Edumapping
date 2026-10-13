// server/src/controllers/placementController.js
//
// The placement cell's own tools: the season's policy, the student roster with
// verification and outcomes, the annual NIRF/NAAC-style report, and the drive
// calendar every role reads.
const { Op } = require('sequelize');
const XLSX = require('xlsx');
const {
  sequelize,
  PlacementPolicy,
  User,
  StudentProfile,
  Application,
  Offer,
  Job,
  JobRound,
  RoundParticipant,
  Event,
  Organization,
  AuditLog
} = require('../models');
const notificationService = require('../services/notificationService');
const fileService = require('../services/fileService');
const logger = require('../utils/logger');
const { DEFAULT_POLICY, normaliseTiers, tierFor } = require('../utils/placementPolicy');
const { syncPlacementStatus } = require('../utils/placementStatus');
const models = require('../models');

const PROGRAMME_ALIASES = {
  btech: 'B.Tech', bacheloroftechnology: 'B.Tech',
  be: 'B.E.', bachelorofengineering: 'B.E.',
  mtech: 'M.Tech', masteroftechnology: 'M.Tech',
  me: 'M.E.', masterofengineering: 'M.E.',
  bca: 'BCA', bachelorofcomputerapplications: 'BCA',
  mca: 'MCA', masterofcomputerapplications: 'MCA',
  bsc: 'B.Sc', bachelorofscience: 'B.Sc',
  msc: 'M.Sc', masterofscience: 'M.Sc',
  bcom: 'B.Com', bachelorofcommerce: 'B.Com',
  bba: 'BBA', bachelorofbusinessadministration: 'BBA',
  mba: 'MBA', masterofbusinessadministration: 'MBA'
};
const programmeLabel = (course) => {
  const raw = (course || '').trim();
  if (!raw) return 'Unspecified';
  return PROGRAMME_ALIASES[raw.toLowerCase().replace(/[^a-z]/g, '')] || raw;
};

const fail = (res, status, error, message, extra = {}) => res.status(status).json({ error, message, ...extra });

const audit = (req, action, entityType, entityId, newValues) =>
  AuditLog.create({
    userId: req.user.id,
    action,
    entityType,
    entityId,
    newValues,
    ipAddress: req.ip,
    userAgent: req.get('user-agent')
  }).catch((err) => logger.error('Audit log failed', err));

/**
 * The institution a request acts for. TPOs act for their own; an admin must
 * name one. Anything else is refused by the routes before reaching here.
 */
const targetOrgId = (req) => {
  if (req.user.role === 'admin') return parseInt(req.query.organizationId || req.body?.organizationId, 10) || null;
  return req.user.organizationId || null;
};

const csvCell = (value) => {
  let v = value === null || value === undefined ? '' : String(value);
  // Spreadsheet formula injection: a cell starting with = + - @ is executed.
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

const median = (values) => {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

const LOCKED_LABELS = {
  course: 'Course',
  branch: 'Branch',
  graduationYear: 'Graduation year',
  cgpa: 'CGPA',
  activeBacklogs: 'Active backlogs',
  class10Percentage: 'Class X %',
  class12Percentage: 'Class XII %',
  diplomaPercentage: 'Diploma %',
  studentId: 'Roll number'
};

class PlacementController {
  /* ------------------------------------------------------------- policy */

  async getPolicy(req, res, next) {
    try {
      const organizationId = targetOrgId(req);
      if (!organizationId) return fail(res, 400, 'Validation Error', 'organizationId is required');
      const policy = await PlacementPolicy.findOne({ where: { organizationId } });
      res.json({
        message: 'Placement policy',
        policy: policy ? policy.toJSON() : { ...DEFAULT_POLICY, organizationId, isDefault: true }
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePolicy(req, res, next) {
    try {
      const organizationId = targetOrgId(req);
      if (!organizationId) return fail(res, 400, 'Validation Error', 'organizationId is required');
      const b = req.body;
      const tiers = normaliseTiers(b.tiers);
      if (b.placedRule === 'higher_tier' && b.enabled && tiers.length < 2) {
        return fail(res, 400, 'Validation Error', 'The higher-tier rule needs at least two tiers.');
      }
      if (b.placedRule === 'ctc_multiplier' && !(Number(b.ctcMultiplier) >= 1)) {
        return fail(res, 400, 'Validation Error', 'Set a CTC multiplier of at least 1 for the multiplier rule.');
      }
      const data = {
        enabled: Boolean(b.enabled),
        tiers,
        maxOffers: b.maxOffers ? Math.max(1, parseInt(b.maxOffers, 10)) : null,
        placedRule: ['none', 'higher_tier', 'ctc_multiplier'].includes(b.placedRule) ? b.placedRule : 'higher_tier',
        ctcMultiplier: b.ctcMultiplier ? Number(b.ctcMultiplier) : null,
        blockAfterAcceptance: Boolean(b.blockAfterAcceptance),
        requireVerifiedProfile: Boolean(b.requireVerifiedProfile),
        exemptJobIds: (Array.isArray(b.exemptJobIds) ? b.exemptJobIds : []).map(Number).filter(Boolean),
        updatedBy: req.user.id
      };
      const [policy] = await PlacementPolicy.findOrCreate({ where: { organizationId }, defaults: { ...data, organizationId } });
      await policy.update(data);
      audit(req, 'placement_policy_updated', 'organization', organizationId, data);
      res.json({ message: 'Placement policy saved', policy });
    } catch (error) {
      next(error);
    }
  }

  /* ------------------------------------------------------------- roster */

  async listStudents(req, res, next) {
    try {
      const organizationId = targetOrgId(req);
      if (!organizationId) return fail(res, 400, 'Validation Error', 'organizationId is required');
      const {
        search,
        branch,
        graduationYear,
        verificationStatus,
        placementStatus,
        page = 1,
        limit = 25,
        sort = 'name'
      } = req.query;
      const lim = Math.min(Math.max(parseInt(limit, 10) || 25, 1), 200);
      const offset = (Math.max(parseInt(page, 10) || 1, 1) - 1) * lim;

      const userWhere = { role: 'student', organizationId };
      if (search) {
        const term = `%${search.trim()}%`;
        userWhere[Op.or] = [
          { firstName: { [Op.iLike]: term } },
          { lastName: { [Op.iLike]: term } },
          { email: { [Op.iLike]: term } },
          { '$studentProfile.student_id$': { [Op.iLike]: term } }
        ];
      }
      const profileWhere = {};
      if (branch) profileWhere.branch = { [Op.iLike]: `%${branch}%` };
      if (graduationYear) profileWhere.graduationYear = parseInt(graduationYear, 10);
      if (verificationStatus) profileWhere.verificationStatus = verificationStatus;
      if (placementStatus) profileWhere.placementStatus = placementStatus;
      const hasProfileFilter = Object.keys(profileWhere).length > 0;

      const order =
        sort === 'cgpa'
          ? [[{ model: StudentProfile, as: 'studentProfile' }, 'cgpa', 'DESC NULLS LAST']]
          : sort === 'recent'
            ? [['createdAt', 'DESC']]
            : [['firstName', 'ASC'], ['lastName', 'ASC']];

      const { count, rows } = await User.findAndCountAll({
        where: userWhere,
        attributes: ['id', 'firstName', 'lastName', 'email', 'phone', 'isActive', 'createdAt'],
        include: [
          {
            model: StudentProfile,
            as: 'studentProfile',
            required: hasProfileFilter,
            where: hasProfileFilter ? profileWhere : undefined
          }
        ],
        order,
        limit: lim,
        offset,
        distinct: true,
        subQuery: false
      });

      const ids = rows.map((r) => r.id);
      const [appCounts, offerRows] = await Promise.all([
        Application.findAll({
          where: { studentId: { [Op.in]: ids }, status: { [Op.ne]: 'withdrawn' } },
          attributes: ['studentId', [sequelize.fn('COUNT', sequelize.col('id')), 'n']],
          group: ['studentId'],
          raw: true
        }),
        Offer.findAll({
          where: { studentId: { [Op.in]: ids }, status: { [Op.in]: Offer.LIVE_STATUSES } },
          attributes: ['studentId', 'ctc', 'status'],
          raw: true
        })
      ]);
      const apps = new Map(appCounts.map((r) => [r.studentId, Number(r.n)]));
      const offers = new Map();
      offerRows.forEach((o) => {
        const list = offers.get(o.studentId) || [];
        list.push(o);
        offers.set(o.studentId, list);
      });

      // Summary counts for the filter chips, over the whole institution.
      const summary = await StudentProfile.findAll({
        attributes: ['verificationStatus', [sequelize.fn('COUNT', sequelize.col('StudentProfile.id')), 'n']],
        include: [{ model: User, as: 'user', attributes: [], where: { organizationId, role: 'student' } }],
        group: ['verificationStatus'],
        raw: true
      });

      res.json({
        message: 'Students retrieved',
        students: rows.map((u) => {
          const p = u.studentProfile;
          const held = offers.get(u.id) || [];
          return {
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            phone: u.phone,
            isActive: u.isActive,
            rollNumber: p?.studentId || null,
            course: p?.course || null,
            branch: p?.branch || null,
            graduationYear: p?.graduationYear || null,
            cgpa: p?.cgpa !== undefined && p?.cgpa !== null ? Number(p.cgpa) : null,
            activeBacklogs: p?.activeBacklogs ?? null,
            class10Percentage: p?.class10Percentage ?? null,
            class12Percentage: p?.class12Percentage ?? null,
            placementStatus: p?.placementStatus || 'unplaced',
            placementSanction: p?.placementSanction || 'none',
            verificationStatus: p?.verificationStatus || 'unverified',
            verificationNotes: p?.verificationNotes || null,
            verificationRequestedAt: p?.verificationRequestedAt || null,
            hasMarksheet: Boolean(p?.marksheetUrl),
            marksheetUrl: p?.marksheetUrl || null,
            hasResume: Boolean(p?.resumeUrl),
            hasProfile: Boolean(p),
            applications: apps.get(u.id) || 0,
            liveOffers: held.length,
            bestOfferCtc: held.length ? Math.max(...held.map((o) => Number(o.ctc) || 0)) : null
          };
        }),
        verificationSummary: summary.reduce((acc, r) => ({ ...acc, [r.verificationStatus]: Number(r.n) }), {}),
        pagination: {
          currentPage: Math.floor(offset / lim) + 1,
          totalPages: Math.ceil(count / lim),
          totalItems: count,
          itemsPerPage: lim
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/placement/students/:userId/verification
   * { action: 'verify' | 'reject' | 'unlock', notes }
   */
  async reviewVerification(req, res, next) {
    try {
      const { action, notes } = req.body;
      if (!['verify', 'reject', 'unlock'].includes(action)) {
        return fail(res, 400, 'Validation Error', 'action must be verify, reject or unlock');
      }
      if (action === 'reject' && !String(notes || '').trim()) {
        return fail(res, 400, 'Validation Error', 'Tell the student what to fix when sending their details back.');
      }
      const student = await User.findOne({
        where: { id: req.params.userId, role: 'student' },
        include: [{ model: StudentProfile, as: 'studentProfile' }]
      });
      if (!student || (req.user.role !== 'admin' && student.organizationId !== req.user.organizationId)) {
        return fail(res, 404, 'Student Not Found', 'Student not found');
      }
      if (!student.studentProfile) {
        return fail(res, 400, 'Profile Incomplete', 'This student has not filled in a profile yet.');
      }
      const status = { verify: 'verified', reject: 'rejected', unlock: 'unverified' }[action];
      await student.studentProfile.update({
        verificationStatus: status,
        verificationNotes: notes || null,
        verifiedBy: action === 'verify' ? req.user.id : null,
        verifiedAt: action === 'verify' ? new Date() : null
      });

      const messages = {
        verify: 'Your placement cell verified your academic details. They are now locked; ask the cell if anything needs to change.',
        reject: `Your placement cell sent your academic details back: ${notes}`,
        unlock: 'Your placement cell unlocked your academic details for editing. Submit them for verification again when done.'
      };
      notificationService
        .createNotification(student.id, 'Profile verification', messages[action], 'system_alert', { link: '/profile' }, action === 'reject' ? 'high' : 'medium')
        .catch((err) => logger.error('Verification notification failed', err));
      audit(req, `student_verification_${action}`, 'user', student.id, { status, notes });
      res.json({ message: `Profile ${status}`, verificationStatus: status });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/placement/students/verify-bulk { userIds: [] } */
  async bulkVerify(req, res, next) {
    try {
      const ids = (req.body.userIds || []).map(Number).filter(Boolean);
      if (!ids.length) return fail(res, 400, 'Validation Error', 'Choose at least one student');
      const students = await User.findAll({
        where: {
          id: { [Op.in]: ids },
          role: 'student',
          ...(req.user.role === 'admin' ? {} : { organizationId: req.user.organizationId })
        },
        attributes: ['id']
      });
      const scoped = students.map((s) => s.id);
      const [count] = await StudentProfile.update(
        { verificationStatus: 'verified', verifiedBy: req.user.id, verifiedAt: new Date(), verificationNotes: null },
        { where: { userId: { [Op.in]: scoped } } }
      );
      await Promise.allSettled(
        scoped.map((id) =>
          notificationService.createNotification(id, 'Profile verification', 'Your placement cell verified your academic details. They are now locked.', 'system_alert', { link: '/profile' })
        )
      );
      audit(req, 'student_verification_bulk', 'organization', req.user.organizationId, { userIds: scoped });
      res.json({ message: `${count} profile(s) verified`, verified: count });
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/placement/students/:userId/outcome { placementStatus, note } */
  async setOutcome(req, res, next) {
    try {
      const { placementStatus } = req.body;
      const allowed = ['higher_studies', 'opted_out', 'deferred', 'auto'];
      if (!allowed.includes(placementStatus)) {
        return fail(res, 400, 'Validation Error', `placementStatus must be one of ${allowed.join(', ')}`);
      }
      const student = await User.findOne({
        where: { id: req.params.userId, role: 'student' },
        include: [{ model: StudentProfile, as: 'studentProfile' }]
      });
      if (!student || (req.user.role !== 'admin' && student.organizationId !== req.user.organizationId)) {
        return fail(res, 404, 'Student Not Found', 'Student not found');
      }
      if (!student.studentProfile) return fail(res, 400, 'Profile Incomplete', 'This student has no profile yet.');

      if (placementStatus === 'auto') {
        // Hand the status back to the offers and applications.
        await student.studentProfile.update({ placementStatus: 'unplaced' });
        await syncPlacementStatus(student.id, models);
      } else {
        await student.studentProfile.update({ placementStatus });
      }
      await student.studentProfile.reload();
      audit(req, 'student_outcome_set', 'user', student.id, { placementStatus });
      res.json({ message: 'Outcome recorded', placementStatus: student.studentProfile.placementStatus });
    } catch (error) {
      next(error);
    }
  }

  /** GET /api/placement/students/export — the roster as CSV. */
  async exportStudents(req, res, next) {
    try {
      const organizationId = targetOrgId(req);
      if (!organizationId) return fail(res, 400, 'Validation Error', 'organizationId is required');
      const users = await User.findAll({
        where: { role: 'student', organizationId },
        attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
        include: [{ model: StudentProfile, as: 'studentProfile' }],
        order: [['firstName', 'ASC']]
      });
      const header = ['Roll number', 'Name', 'Email', 'Phone', 'Course', 'Branch', 'Batch', 'CGPA', 'Active backlogs', 'Class X %', 'Class XII %', 'Verification', 'Placement status', 'Sanction'];
      const lines = [header.join(',')];
      users.forEach((u) => {
        const p = u.studentProfile || {};
        lines.push(
          [p.studentId, `${u.firstName} ${u.lastName}`, u.email, u.phone, p.course, p.branch, p.graduationYear, p.cgpa, p.activeBacklogs, p.class10Percentage, p.class12Percentage, p.verificationStatus || 'unverified', p.placementStatus || 'unplaced', p.placementSanction || 'none']
            .map(csvCell)
            .join(',')
        );
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="students-${organizationId}.csv"`);
      res.send(`﻿${lines.join('\n')}`);
    } catch (error) {
      next(error);
    }
  }

  /* ------------------------------------------------- student verification */

  /** POST /api/placement/verification/request — student submits for review. */
  async requestVerification(req, res, next) {
    try {
      const profile = await StudentProfile.findOne({ where: { userId: req.user.id } });
      if (!profile) return fail(res, 400, 'Profile Incomplete', 'Fill in your profile before submitting it for verification.');
      if (profile.verificationStatus === 'verified') {
        return fail(res, 409, 'Already Verified', 'Your academic details are already verified.');
      }
      const missing = ['studentId', 'branch', 'graduationYear', 'cgpa'].filter(
        (k) => profile[k] === null || profile[k] === undefined || profile[k] === ''
      );
      if (missing.length) {
        return fail(res, 400, 'Profile Incomplete', `Fill in ${missing.map((k) => LOCKED_LABELS[k] || k).join(', ')} first.`, { missing });
      }
      await profile.update({ verificationStatus: 'pending', verificationRequestedAt: new Date(), verificationNotes: null });

      // Tell the institution's placement officers.
      const tpos = await User.findAll({
        where: { role: 'tpo', organizationId: req.user.organizationId, isActive: true },
        attributes: ['id']
      });
      await Promise.allSettled(
        tpos.map((t) =>
          notificationService.createNotification(
            t.id,
            'Profile awaiting verification',
            `${req.user.firstName} ${req.user.lastName}${profile.studentId ? ` (${profile.studentId})` : ''} submitted their academic details for verification.`,
            'system_alert',
            { link: '/tpo/students?verificationStatus=pending', studentId: req.user.id }
          )
        )
      );
      res.json({ message: 'Submitted to your placement cell for verification', verificationStatus: 'pending' });
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/placement/verification/marksheet — combined marksheets PDF. */
  async uploadMarksheet(req, res, next) {
    try {
      if (!req.file) return fail(res, 400, 'No File', 'Attach your marksheets as one PDF');
      if (req.file.mimetype !== 'application/pdf' || req.file.buffer.slice(0, 4).toString() !== '%PDF') {
        return fail(res, 400, 'Invalid File Type', 'Marksheets must be a single PDF file');
      }
      const profile = await StudentProfile.findOne({ where: { userId: req.user.id } });
      if (!profile) return fail(res, 400, 'Profile Incomplete', 'Fill in your profile first.');
      if (profile.verificationStatus === 'verified') {
        return fail(res, 423, 'Profile Locked', 'Your details are verified. Ask your placement cell to unlock them to replace documents.');
      }
      const fileName = `marksheet_${req.user.id}_${Date.now()}.pdf`;
      const filePath = await fileService.saveFile(req.file.buffer, fileName, req.file.mimetype);
      const previous = profile.marksheetUrl;
      await profile.update({ marksheetUrl: filePath });
      if (previous) fileService.deleteFile(previous).catch(() => {});
      res.json({ message: 'Marksheets uploaded', marksheetUrl: filePath });
    } catch (error) {
      next(error);
    }
  }

  /* ------------------------------------------------------------- report */

  /**
   * GET /api/placement/report?graduationYear=2026[&format=xlsx]
   *
   * The numbers NIRF's "Graduation Outcomes" and NAAC criterion 5.2 ask for:
   * per programme/branch, students in the batch, placed, higher studies, opted
   * out, and median / average / highest / lowest CTC of placed students; plus
   * the recruiters who made offers. Only live offers count, and each student
   * counts once at their best offer.
   */
  async report(req, res, next) {
    try {
      const organizationId = targetOrgId(req);
      if (!organizationId) return fail(res, 400, 'Validation Error', 'organizationId is required');
      const graduationYear = parseInt(req.query.graduationYear, 10) || null;

      const org = await Organization.findByPk(organizationId, { attributes: ['id', 'name', 'type'] });
      const profiles = await StudentProfile.findAll({
        where: graduationYear ? { graduationYear } : {},
        include: [{ model: User, as: 'user', attributes: ['id', 'firstName', 'lastName', 'email'], where: { organizationId, role: 'student' } }]
      });
      const studentIds = profiles.map((p) => p.userId);
      const offers = await Offer.findAll({
        where: { studentId: { [Op.in]: studentIds.length ? studentIds : [-1] }, status: { [Op.in]: Offer.LIVE_STATUSES } },
        include: [
          { model: Organization, as: 'organization', attributes: ['id', 'name'] },
          { model: Job, as: 'job', attributes: ['id', 'title', 'jobType'] }
        ]
      });

      const best = new Map();
      offers.forEach((o) => {
        const cur = best.get(o.studentId);
        if (!cur || Number(o.ctc) > Number(cur.ctc)) best.set(o.studentId, o);
      });

      // Imported batches spell the same programme several ways ("B.Tech", "BTech",
      // "Bachelor of Technology"), which would split one programme across rows.
      const groupKey = (p) => `${programmeLabel(p.course)} — ${(p.branch || '').trim() || 'Unspecified'}`;
      const groups = new Map();
      const blank = () => ({ students: 0, placed: 0, higherStudies: 0, optedOut: 0, deferred: 0, unplaced: 0, ctcs: [], offers: 0, ppos: 0, verifiedLetters: 0 });
      const total = blank();
      profiles.forEach((p) => {
        const g = groups.get(groupKey(p)) || blank();
        [g, total].forEach((t) => {
          t.students += 1;
          const offer = best.get(p.userId);
          if (offer) {
            t.placed += 1;
            t.ctcs.push(Number(offer.ctc) || 0);
            if (offer.isPPO) t.ppos += 1;
            if (offer.letterVerified) t.verifiedLetters += 1;
          } else if (p.placementStatus === 'placed') t.placed += 1;
          else if (p.placementStatus === 'higher_studies') t.higherStudies += 1;
          else if (p.placementStatus === 'opted_out') t.optedOut += 1;
          else if (p.placementStatus === 'deferred') t.deferred += 1;
          else t.unplaced += 1;
        });
        groups.set(groupKey(p), g);
      });
      offers.forEach((o) => {
        const p = profiles.find((x) => x.userId === o.studentId);
        if (p) groups.get(groupKey(p)).offers += 1;
        total.offers += 1;
      });

      const finish = (label, t) => {
        // NIRF's denominator excludes students who opted out of placement.
        const eligible = t.students - t.optedOut;
        return {
          label,
          students: t.students,
          optedOut: t.optedOut,
          eligible,
          placed: t.placed,
          higherStudies: t.higherStudies,
          deferred: t.deferred,
          unplaced: t.unplaced,
          totalOffers: t.offers,
          ppos: t.ppos,
          offerLettersVerified: t.verifiedLetters,
          placementRate: eligible > 0 ? Math.round((t.placed / eligible) * 1000) / 10 : 0,
          outcomeRate: eligible > 0 ? Math.round(((t.placed + t.higherStudies) / eligible) * 1000) / 10 : 0,
          medianCtc: median(t.ctcs),
          averageCtc: t.ctcs.length ? Math.round(t.ctcs.reduce((a, b) => a + b, 0) / t.ctcs.length) : null,
          highestCtc: t.ctcs.length ? Math.max(...t.ctcs) : null,
          lowestCtc: t.ctcs.length ? Math.min(...t.ctcs) : null
        };
      };

      const recruiters = new Map();
      offers.forEach((o) => {
        const name = o.organization?.name || 'Unknown';
        const r = recruiters.get(name) || { company: name, offers: 0, highestCtc: 0 };
        r.offers += 1;
        r.highestCtc = Math.max(r.highestCtc, Number(o.ctc) || 0);
        recruiters.set(name, r);
      });

      const policy = await PlacementPolicy.findOne({ where: { organizationId } });
      const tierCounts = {};
      if (policy?.tiers?.length) {
        [...best.values()].forEach((o) => {
          const t = tierFor(Number(o.ctc) || 0, policy.tiers);
          if (t) tierCounts[t.name] = (tierCounts[t.name] || 0) + 1;
        });
      }

      const data = {
        institution: org?.name,
        graduationYear,
        generatedAt: new Date().toISOString(),
        summary: finish('All programmes', total),
        byProgramme: [...groups.entries()].map(([k, g]) => finish(k, g)).sort((a, b) => b.students - a.students),
        recruiters: [...recruiters.values()].sort((a, b) => b.offers - a.offers),
        tiers: tierCounts,
        students: profiles.map((p) => {
          const o = best.get(p.userId);
          return {
            rollNumber: p.studentId,
            name: `${p.user.firstName} ${p.user.lastName}`,
            programme: programmeLabel(p.course),
            branch: p.branch,
            batch: p.graduationYear,
            outcome: o ? 'placed' : p.placementStatus,
            company: o?.organization?.name || null,
            role: o?.roleTitle || o?.job?.title || null,
            ctc: o ? Number(o.ctc) : null,
            ppo: o ? Boolean(o.isPPO) : null,
            offerLetterVerified: o ? Boolean(o.letterVerified) : null
          };
        })
      };

      if (req.query.format === 'xlsx') {
        const wb = XLSX.utils.book_new();
        const lakh = (v) => (v === null || v === undefined ? '' : Math.round((v / 100000) * 100) / 100);
        const summaryRows = [data.summary, ...data.byProgramme].map((r) => ({
          'Programme — Branch': r.label,
          'Students in batch': r.students,
          'Opted out': r.optedOut,
          'Eligible for placement': r.eligible,
          Placed: r.placed,
          'Higher studies': r.higherStudies,
          'Placement %': r.placementRate,
          'Placed + higher studies %': r.outcomeRate,
          'Median CTC (LPA)': lakh(r.medianCtc),
          'Average CTC (LPA)': lakh(r.averageCtc),
          'Highest CTC (LPA)': lakh(r.highestCtc),
          'Lowest CTC (LPA)': lakh(r.lowestCtc),
          'Total offers': r.totalOffers,
          PPOs: r.ppos,
          'Offer letters verified': r.offerLettersVerified
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(
            data.students.map((s) => ({
              'Roll number': s.rollNumber,
              Name: s.name,
              Programme: s.programme,
              Branch: s.branch,
              Batch: s.batch,
              Outcome: s.outcome,
              Company: s.company,
              Role: s.role,
              'CTC (LPA)': lakh(s.ctc),
              PPO: s.ppo === null ? '' : s.ppo ? 'Yes' : 'No',
              'Offer letter verified': s.offerLetterVerified === null ? '' : s.offerLetterVerified ? 'Yes' : 'No'
            }))
          ),
          'Students'
        );
        XLSX.utils.book_append_sheet(
          wb,
          XLSX.utils.json_to_sheet(data.recruiters.map((r) => ({ Company: r.company, Offers: r.offers, 'Highest CTC (LPA)': lakh(r.highestCtc) }))),
          'Recruiters'
        );
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="placement-report-${graduationYear || 'all'}.xlsx"`
        );
        return res.send(buffer);
      }

      res.json({ message: 'Placement report', report: data });
    } catch (error) {
      next(error);
    }
  }

  /* ----------------------------------------------------------- calendar */

  /**
   * GET /api/placement/calendar?from=&to=[&format=ics]
   *
   * Everything with a date a user should plan around: events they can see,
   * selection rounds that concern them, and application deadlines.
   */
  async calendar(req, res, next) {
    try {
      const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 31 * 864e5);
      const to = req.query.to ? new Date(req.query.to) : new Date(Date.now() + 92 * 864e5);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to - from > 400 * 864e5) {
        return fail(res, 400, 'Validation Error', 'Give a valid range of at most a year');
      }
      const { role, organizationId, id: userId } = req.user;
      const items = [];

      // Events — own institution's plus the platform-wide ones.
      const global = await Organization.findOne({ where: { name: 'EduMapping' }, attributes: ['id'] });
      const eventOrgs = [organizationId, global?.id].filter(Boolean);
      const events = await Event.findAll({
        where: {
          startTime: { [Op.between]: [from, to] },
          status: { [Op.ne]: 'cancelled' },
          ...(role === 'admin' ? {} : { organizationId: { [Op.in]: eventOrgs.length ? eventOrgs : [-1] } })
        },
        include: [{ model: Organization, as: 'organization', attributes: ['id', 'name'] }],
        attributes: ['id', 'title', 'eventType', 'startTime', 'endTime', 'location', 'virtualLink']
      });
      events.forEach((e) =>
        items.push({
          id: `event-${e.id}`,
          kind: 'event',
          title: e.title,
          subtitle: e.organization?.name,
          category: e.eventType,
          start: e.startTime,
          end: e.endTime,
          location: e.location || (e.virtualLink ? 'Online' : null),
          link: `/events/${e.id}`
        })
      );

      // Selection rounds.
      const roundWhere = { scheduledAt: { [Op.between]: [from, to] }, status: { [Op.ne]: 'cancelled' } };
      let rounds = [];
      if (role === 'student') {
        const apps = await Application.findAll({ where: { studentId: userId, status: { [Op.ne]: 'withdrawn' } }, attributes: ['id', 'jobId'] });
        const parts = await RoundParticipant.findAll({ where: { applicationId: { [Op.in]: apps.map((a) => a.id) } }, attributes: ['roundId', 'slotAt'] });
        const slot = new Map(parts.map((p) => [p.roundId, p.slotAt]));
        rounds = await JobRound.findAll({
          where: { ...roundWhere, id: { [Op.in]: [...slot.keys()] } },
          include: [{ model: Job, as: 'job', attributes: ['id', 'title'], include: [{ model: Organization, as: 'organization', attributes: ['name'] }] }]
        });
        rounds.forEach((r) => (r.dataValues.slotAt = slot.get(r.id)));
      } else if (role === 'recruiter') {
        rounds = await JobRound.findAll({
          where: roundWhere,
          include: [{ model: Job, as: 'job', attributes: ['id', 'title'], where: { organizationId }, include: [{ model: Organization, as: 'organization', attributes: ['name'] }] }]
        });
      } else if (role === 'tpo') {
        rounds = await JobRound.findAll({
          where: { ...roundWhere, [Op.or]: [{ organizationId }, { organizationId: null }] },
          include: [{ model: Job, as: 'job', attributes: ['id', 'title'], include: [{ model: Organization, as: 'organization', attributes: ['name'] }] }]
        });
      } else if (role === 'admin') {
        rounds = await JobRound.findAll({
          where: roundWhere,
          include: [{ model: Job, as: 'job', attributes: ['id', 'title'], include: [{ model: Organization, as: 'organization', attributes: ['name'] }] }]
        });
      }
      rounds.forEach((r) =>
        items.push({
          id: `round-${r.id}`,
          kind: 'round',
          title: `${r.job?.organization?.name ? `${r.job.organization.name}: ` : ''}${r.name}`,
          subtitle: r.job?.title,
          category: r.roundType,
          start: r.dataValues.slotAt || r.scheduledAt,
          end: r.endsAt,
          location: r.mode === 'online' ? 'Online' : r.venue,
          link: role === 'student' ? '/applications' : `/jobs/${r.jobId}`
        })
      );

      // Application deadlines.
      if (role !== 'recruiter' || organizationId) {
        const jobWhere = {
          applicationDeadline: { [Op.between]: [from.toISOString().slice(0, 10), to.toISOString().slice(0, 10)] },
          status: 'active',
          ...(role === 'recruiter' ? { organizationId } : {})
        };
        const jobs = await Job.findAll({
          where: jobWhere,
          attributes: ['id', 'title', 'applicationDeadline'],
          include: [{ model: Organization, as: 'organization', attributes: ['name'] }]
        });
        jobs.forEach((j) =>
          items.push({
            id: `deadline-${j.id}`,
            kind: 'deadline',
            title: `Apply by: ${j.title}`,
            subtitle: j.organization?.name,
            category: 'deadline',
            start: `${j.applicationDeadline}T23:59:00+05:30`,
            allDay: true,
            link: `/jobs/${j.id}`
          })
        );
      }

      items.sort((a, b) => new Date(a.start) - new Date(b.start));

      // Two drives for the same campus on one day is the clash a cell most
      // needs to see; flag days with more than one round.
      const roundsByDay = {};
      items
        .filter((i) => i.kind === 'round')
        .forEach((i) => {
          const d = new Date(i.start).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
          roundsByDay[d] = (roundsByDay[d] || 0) + 1;
        });
      const clashes = Object.entries(roundsByDay)
        .filter(([, n]) => n > 1)
        .map(([date, count]) => ({ date, count }));

      if (req.query.format === 'ics') {
        const stamp = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        const esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
        const origin = process.env.CLIENT_URL || 'https://edumapping.com';
        const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EduMapping//Placement Calendar//EN', 'CALSCALE:GREGORIAN'];
        items.forEach((i) => {
          lines.push(
            'BEGIN:VEVENT',
            `UID:${i.id}@edumapping.com`,
            `DTSTAMP:${stamp(Date.now())}`,
            `DTSTART:${stamp(i.start)}`,
            `DTEND:${stamp(i.end || new Date(new Date(i.start).getTime() + 3600e3))}`,
            `SUMMARY:${esc(i.title)}`,
            `DESCRIPTION:${esc([i.subtitle, `${origin}${i.link}`].filter(Boolean).join('\n'))}`,
            ...(i.location ? [`LOCATION:${esc(i.location)}`] : []),
            'END:VEVENT'
          );
        });
        lines.push('END:VCALENDAR');
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="edumapping-calendar.ics"');
        return res.send(lines.join('\r\n'));
      }

      res.json({ message: 'Calendar', from, to, items, clashes });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PlacementController();
