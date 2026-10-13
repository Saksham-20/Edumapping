// server/src/services/assistantService.js
//
// "Ask EduMapping" — a placement assistant on the Claude API.
//
// Students ask the cell the same questions all season: which drives can I
// apply to, why can't I apply to this one, what's my next round, what is my
// profile missing. The assistant answers from the student's own data through a
// small set of read-only tools, scoped to the signed-in user by construction —
// a tool never takes a user id from the model. Staff get platform how-to help
// without tools.
//
// Everything degrades to a 503 when ANTHROPIC_API_KEY is unset, the same way
// live classes degrade without LiveKit; the rest of the API is unaffected.
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const models = require('../models');
const { checkEligibility } = require('../utils/eligibility');
const { checkPolicyForStudent } = require('../utils/placementPolicy');

const { Job, Organization, Application, StudentProfile, JobRound, RoundParticipant, Offer } = models;

const MODEL = process.env.ASSISTANT_MODEL || 'claude-opus-5-5';
const MAX_TOOL_ROUNDS = 6;

let client = null;
const isConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);
const getClient = () => {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    const Ctor = Anthropic.default || Anthropic;
    client = new Ctor({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 60_000 });
  }
  return client;
};

const lpa = (v) => {
  const n = Number(v) || 0;
  if (!n) return null;
  if (n < 1000) return `${n} LPA`;
  if (n < 100000) return `₹${n.toLocaleString('en-IN')}/month`;
  return `${Math.round((n / 100000) * 10) / 10} LPA`;
};

/** A salary range in one unit, decided by its top end (as the client shows it). */
const payRange = (min, max) => {
  const lo = Number(min) || 0;
  const hi = Number(max) || 0;
  const top = Math.max(lo, hi);
  if (!top) return 'not disclosed';
  const fmt = (v) =>
    top >= 100000 ? `${Math.round((v / 100000) * 10) / 10}` : top >= 1000 ? `₹${v.toLocaleString('en-IN')}` : `${v}`;
  const unit = top >= 100000 || top < 1000 ? ' LPA' : '/month';
  return lo && hi && lo !== hi ? `${fmt(lo)}–${fmt(hi)}${unit}` : `${fmt(top)}${unit}`;
};

/* --------------------------------------------------------------- tools */

const STUDENT_TOOLS = [
  {
    name: 'search_jobs',
    description:
      'Search open job and internship postings the student can see. Returns id, title, company, type, location, CTC/stipend and application deadline. Use before answering any question about available roles.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to match in title, description or skills. Empty for all.' },
        jobType: { type: 'string', enum: ['any', 'full_time', 'internship', 'part_time'] }
      },
      required: ['query', 'jobType'],
      additionalProperties: false
    },
    strict: true
  },
  {
    name: 'check_eligibility',
    description:
      "Check whether the signed-in student may apply to one job: the job's academic criteria and the college's placement policy. Returns eligible plus the exact reasons when not.",
    input_schema: {
      type: 'object',
      properties: { jobId: { type: 'integer', description: 'Job id from search_jobs.' } },
      required: ['jobId'],
      additionalProperties: false
    },
    strict: true
  },
  {
    name: 'my_applications',
    description:
      "The signed-in student's applications with their status, every selection round they are in (time, place, result) and any offers.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false }
  },
  {
    name: 'my_profile',
    description:
      "The signed-in student's profile summary: academics, verification status, resume presence, and which required fields are missing.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false }
  }
];

const REQUIRED_FIELDS = ['course', 'branch', 'yearOfStudy', 'graduationYear', 'cgpa', 'skills', 'bio'];

const runTool = async (name, input, user) => {
  switch (name) {
    case 'search_jobs': {
      // Past-deadline postings can still be 'active' until someone closes them,
      // but nobody can apply, so they are not "open".
      const where = {
        status: 'active',
        [Op.and]: [{ [Op.or]: [{ applicationDeadline: null }, { applicationDeadline: { [Op.gte]: new Date().toISOString().slice(0, 10) } }] }]
      };
      if (input.jobType && input.jobType !== 'any') where.jobType = input.jobType;
      if (input.query && input.query.trim()) {
        const term = `%${input.query.trim().slice(0, 80)}%`;
        where[Op.or] = [{ title: { [Op.iLike]: term } }, { description: { [Op.iLike]: term } }];
      }
      const jobs = await Job.findAll({
        where,
        include: [{ model: Organization, as: 'organization', attributes: ['name'] }],
        attributes: ['id', 'title', 'jobType', 'location', 'salaryMin', 'salaryMax', 'applicationDeadline'],
        order: [['applicationDeadline', 'ASC NULLS LAST']],
        limit: 15
      });
      return jobs.map((j) => ({
        id: j.id,
        title: j.title,
        company: j.organization?.name,
        type: j.jobType,
        location: j.location,
        pay: payRange(j.salaryMin, j.salaryMax),
        applyBy: j.applicationDeadline,
        link: `/jobs/${j.id}`
      }));
    }
    case 'check_eligibility': {
      const job = await Job.findByPk(input.jobId);
      if (!job || job.status !== 'active') return { error: 'No open job with that id.' };
      const profile = await StudentProfile.findOne({ where: { userId: user.id } });
      const criteria = checkEligibility(job.eligibilityCriteria, profile);
      const policy = await checkPolicyForStudent(models, {
        studentId: user.id,
        organizationId: user.organizationId,
        job,
        profile
      });
      const existing = await Application.findOne({ where: { jobId: job.id, studentId: user.id }, attributes: ['status'] });
      return {
        job: job.title,
        eligible: criteria.eligible && policy.allowed && !profile?.isBarredFromApplying?.(),
        reasons: [
          ...(profile?.isBarredFromApplying?.() ? ['Your placement cell has blocked you from applying to new drives.'] : []),
          ...policy.reasons,
          ...criteria.reasons
        ],
        companyTier: policy.tier?.name || null,
        alreadyApplied: existing ? existing.status : false,
        deadline: job.applicationDeadline,
        link: `/jobs/${job.id}`
      };
    }
    case 'my_applications': {
      const apps = await Application.findAll({
        where: { studentId: user.id },
        attributes: ['id', 'status', 'appliedAt', 'jobId'],
        include: [{ model: Job, as: 'job', attributes: ['title'], include: [{ model: Organization, as: 'organization', attributes: ['name'] }] }],
        order: [['appliedAt', 'DESC']],
        limit: 25
      });
      const parts = await RoundParticipant.findAll({
        where: { applicationId: { [Op.in]: apps.map((a) => a.id) } },
        include: [{ model: JobRound, as: 'round' }]
      });
      const offers = await Offer.findAll({ where: { studentId: user.id }, attributes: ['jobId', 'ctc', 'status', 'roleTitle'] });
      return apps.map((a) => ({
        job: a.job?.title,
        company: a.job?.organization?.name,
        status: a.status,
        appliedAt: a.appliedAt,
        rounds: parts
          .filter((p) => p.applicationId === a.id && p.round)
          .map((p) => ({
            round: p.round.name,
            when: p.slotAt || p.round.scheduledAt,
            where: p.round.mode === 'online' ? 'online' : p.round.venue,
            result: p.result,
            status: p.round.status
          })),
        offer: offers
          .filter((o) => o.jobId === a.jobId)
          .map((o) => ({ ctc: lpa(o.ctc), status: o.status }))[0] || null,
        link: `/applications/${a.id}`
      }));
    }
    case 'my_profile': {
      const p = await StudentProfile.findOne({ where: { userId: user.id } });
      if (!p) return { exists: false, hint: 'The student has not filled in a profile yet — send them to /profile.' };
      return {
        exists: true,
        rollNumber: p.studentId,
        course: p.course,
        branch: p.branch,
        graduationYear: p.graduationYear,
        cgpa: p.cgpa,
        activeBacklogs: p.activeBacklogs,
        class10Percentage: p.class10Percentage,
        class12Percentage: p.class12Percentage,
        skills: p.skills,
        verificationStatus: p.verificationStatus,
        verificationNotes: p.verificationNotes,
        hasResume: Boolean(p.resumeUrl),
        placementStatus: p.placementStatus,
        missingRequiredFields: REQUIRED_FIELDS.filter((f) => !p[f] || (Array.isArray(p[f]) && !p[f].length))
      };
    }
    default:
      return { error: `Unknown tool ${name}` };
  }
};

/* -------------------------------------------------------------- prompt */

const PLATFORM_GUIDE = `EduMapping is a campus placement platform used by Indian colleges and schools.
Pages (link them as markdown paths, e.g. [Jobs](/jobs)):
- /dashboard — overview; /jobs — open drives, each shows eligibility and an Apply button
- /applications — a student's applications and their selection rounds; /offers — offers to accept or decline and the signed offer letter upload
- /profile — personal and academic details, marksheet upload, "Submit for verification" to the placement cell; verified academic fields are locked
- /resume — build and download a PDF resume (required before applying)
- /calendar — rounds, events and deadlines, downloadable to Google/Outlook
- /events — workshops and drives; /conferences — live classes
- Placement officers (TPO): /tpo/students (verify records, set outcomes, import students), /tpo/policy (dream tiers, offer caps), /tpo/reports (NIRF/NAAC report, Excel), /tpo/analytics, /approvals, /audit
- Recruiters: post jobs (reviewed by the placement cell before students see them), run selection rounds from the job page, shortlist by pasting roll numbers, make offers.`;

const systemPrompt = (user) => `You are "Ask EduMapping", the placement assistant inside EduMapping.

${PLATFORM_GUIDE}

You are talking to ${user.firstName} (${user.role}${user.organization?.name ? ` at ${user.organization.name}` : ''}).
${
  user.role === 'student'
    ? 'Use the tools to answer from their real data — never guess at jobs, eligibility, statuses, dates or offers. When a tool returns nothing relevant, say so.'
    : 'You have no data tools for this role; explain how to do things in EduMapping and point to the right page.'
}

Style: short, warm, specific. Plain sentences and short lists; Indian context (CTC in LPA, CGPA, Class X/XII, TPO). Give the link to the page they need. You cannot take actions (apply, accept, edit) — tell them where to do it. For questions about the college's own rules beyond what the data shows, suggest they ask their placement cell. Do not discuss other students' data.`;

/* ---------------------------------------------------------------- chat */

/**
 * One assistant turn. `history` is [{ role: 'user'|'assistant', content: string }]
 * from the client, text only — earlier turns are not replayed with their tool
 * calls, which keeps requests small and the history append-only.
 */
const chat = async (user, history) => {
  const anthropic = getClient();
  const tools = user.role === 'student' ? STUDENT_TOOLS : [];
  const messages = history
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  // The API requires the conversation to start with the user.
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length) throw Object.assign(new Error('Ask a question'), { status: 400 });

  const links = new Set();
  for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
    const response = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      // Chat answers do well at low effort; it keeps replies quick.
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: systemPrompt(user), cache_control: { type: 'ephemeral' } }],
      ...(tools.length ? { tools } : {}),
      messages
    });

    if (response.stop_reason === 'refusal') {
      return { reply: "I can't help with that one. For anything about your placement, try rephrasing, or ask your placement cell.", links: [] };
    }

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });
      const calls = response.content.filter((b) => b.type === 'tool_use');
      const results = await Promise.all(
        calls.map(async (call) => {
          try {
            const out = await runTool(call.name, call.input || {}, user);
            (Array.isArray(out) ? out : [out]).forEach((o) => o?.link && links.add(o.link));
            return { type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(out).slice(0, 20000) };
          } catch (err) {
            logger.error('Assistant tool failed', err, { tool: call.name });
            return { type: 'tool_result', tool_use_id: call.id, content: 'The lookup failed. Tell the user to try again shortly.', is_error: true };
          }
        })
      );
      messages.push({ role: 'user', content: results });
      continue;
    }

    if (response.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }

    const reply = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    return { reply: reply || 'Sorry, I could not come up with an answer. Try asking another way.', links: [...links] };
  }
  return { reply: 'That took more steps than I can manage at once. Try a narrower question.', links: [...links] };
};

module.exports = { isConfigured, chat, MODEL, runTool, STUDENT_TOOLS };
