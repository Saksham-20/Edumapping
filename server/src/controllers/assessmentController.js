// server/src/controllers/assessmentController.js
const { Assessment, Job, User, AssessmentResult, Application } = require('../models');
const { Op } = require('sequelize');

/**
 * The stored questions are authored with snake_case keys (`correct_answer`),
 * while the model layer elsewhere uses camelCase. Read both so scoring works
 * regardless of which shape a row was written in.
 */
const correctAnswerOf = (question) =>
  question?.correctAnswer !== undefined ? question.correctAnswer : question?.correct_answer;

/**
 * Strip the answer key before a question ever leaves the server for a student.
 * The full question objects were being serialised as-is, so anyone taking an
 * assessment could read the correct answers straight out of the response.
 */
const withoutAnswers = (questions = []) =>
  questions.map(({ correctAnswer, correct_answer: snakeCorrectAnswer, ...rest }) => rest);

// What an author may set on an assessment. `...req.body` used to be written
// straight to the row, so `createdBy` (and with it the right to read results)
// could be claimed for somebody else.
const ASSESSMENT_FIELDS = [
  'jobId',
  'title',
  'description',
  'assessmentType',
  'duration',
  'totalMarks',
  'passingMarks',
  'questions',
  'instructions',
  'isActive'
];

/**
 * Which assessments a user may see at all.
 *
 * This listing was global: every signed-in user got every assessment on the
 * platform — a school student was shown a company's coding test for a
 * graduate role, and every recruiter and TPO got every other company's answer
 * key. Now:
 *
 *   * admin: everything;
 *   * recruiter / TPO: assessments attached to their own organization's jobs,
 *     or ones they wrote — the people who set them;
 *   * student: assessments for jobs they have applied to — an assessment is a
 *     stage of an application, not a public catalogue;
 *   * anyone else: none.
 *
 * Returns a `where` for Assessment (with the `job` include required where
 * needed), or null for "nothing".
 */
async function visibleAssessmentScope(user) {
  if (user.role === 'admin') return { where: {}, jobWhere: null };
  if (user.role === 'recruiter' || user.role === 'tpo') {
    return {
      where: {
        [Op.or]: [
          { createdBy: user.id },
          { '$job.organization_id$': user.organizationId || -1 }
        ]
      },
      jobWhere: null
    };
  }
  if (user.role === 'student') {
    const applications = await Application.findAll({
      where: { studentId: user.id },
      attributes: ['jobId']
    });
    const jobIds = [...new Set(applications.map((a) => a.jobId))];
    if (jobIds.length === 0) return null;
    return { where: { jobId: { [Op.in]: jobIds }, isActive: true }, jobWhere: null };
  }
  return null;
}

/** May this user see the answer key? Only the setting organization and admins. */
const canSeeAnswerKey = (user, assessment) =>
  user.role === 'admin' ||
  assessment.createdBy === user.id ||
  (['recruiter', 'tpo'].includes(user.role) &&
    !!user.organizationId &&
    assessment.job?.organizationId === user.organizationId);

class AssessmentController {
  async createAssessment(req, res, next) {
    try {
      const assessmentData = { createdBy: req.user.id };
      for (const field of ASSESSMENT_FIELDS) {
        if (req.body[field] !== undefined) assessmentData[field] = req.body[field];
      }

      // An assessment attached to a job becomes part of that job's process,
      // so only the organization that owns the job may attach one.
      if (assessmentData.jobId) {
        const job = await Job.findByPk(assessmentData.jobId, { attributes: ['id', 'organizationId'] });
        if (!job || (req.user.role !== 'admin' && job.organizationId !== req.user.organizationId)) {
          return res.status(404).json({ error: 'Job Not Found', message: 'Job not found' });
        }
      }

      const assessment = await Assessment.create(assessmentData);

      res.status(201).json({
        message: 'Assessment created successfully',
        assessment
      });
    } catch (error) {
      next(error);
    }
  }

  async getAssessments(req, res, next) {
    try {
      const { jobId } = req.query;

      const scope = await visibleAssessmentScope(req.user);
      if (!scope) {
        return res.json({ message: 'Assessments retrieved successfully', assessments: [] });
      }
      const whereClause = { ...scope.where };
      if (jobId) {
        whereClause[Op.and] = [...(whereClause[Op.and] || []), { jobId }];
      }

      const assessments = await Assessment.findAll({
        where: whereClause,
        include: [
          { model: Job, as: 'job', attributes: ['id', 'title', 'organizationId'] },
          { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] }
        ],
        order: [['createdAt', 'DESC']]
      });

      // The answer key goes only to the organization that set the test (and
      // admins). Role alone used to decide it, so every recruiter and TPO on
      // the platform could read every other company's answers.
      const payload = assessments.map((assessment) => {
        const data = assessment.toJSON();
        if (!canSeeAnswerKey(req.user, assessment)) data.questions = withoutAnswers(data.questions);
        return data;
      });

      res.json({
        message: 'Assessments retrieved successfully',
        assessments: payload
      });
    } catch (error) {
      next(error);
    }
  }

  async takeAssessment(req, res, next) {
    try {
      const { id } = req.params;
      const studentId = req.user.id;

      // Only an assessment the student can see — one for a job they applied
      // to — can be started. Any id used to work, so a student could sit (and
      // be recorded against) another institution's test.
      const scope = await visibleAssessmentScope(req.user);
      const assessment = scope
        ? await Assessment.findOne({
            where: { [Op.and]: [{ id }, scope.where] },
            include: [{ model: Job, as: 'job', attributes: ['id', 'organizationId'] }]
          })
        : null;
      if (!assessment) {
        return res.status(404).json({
          error: 'Assessment Not Found',
          message: 'Assessment not found'
        });
      }

      // Check if student already took the assessment
      const existingResult = await AssessmentResult.findOne({
        where: { assessmentId: id, studentId }
      });

      if (existingResult) {
        return res.status(409).json({
          error: 'Already Taken',
          message: 'You have already taken this assessment'
        });
      }

      // Create assessment result
      const result = await AssessmentResult.create({
        assessmentId: id,
        studentId,
        status: 'in_progress'
      });

      res.json({
        message: 'Assessment started successfully',
        assessment: {
          id: assessment.id,
          title: assessment.title,
          duration: assessment.duration,
          instructions: assessment.instructions,
          questions: withoutAnswers(assessment.questions)
        },
        resultId: result.id
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Results for an assessment, for the person who set it.
   *
   * `AssessmentResult` rows have always been written and never read back —
   * there was no endpoint at all that returned a score to the recruiter or TPO
   * who created the test. A test whose results are invisible to its author is
   * not a feature.
   */
  async getAssessmentResults(req, res, next) {
    try {
      const { id } = req.params;

      const assessment = await Assessment.findByPk(id);
      if (!assessment) {
        return res.status(404).json({
          error: 'Assessment Not Found',
          message: 'Assessment not found'
        });
      }

      // Its author, or an admin. A recruiter must not be able to read the
      // scores on a test somebody else set.
      const canView = req.user.role === 'admin' || assessment.createdBy === req.user.id;
      if (!canView) {
        return res.status(403).json({
          error: 'Access Forbidden',
          message: 'You can only view results for assessments you created'
        });
      }

      const results = await AssessmentResult.findAll({
        where: { assessmentId: id },
        include: [
          {
            model: User,
            as: 'student',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ],
        order: [['percentage', 'DESC']]
      });

      const completed = results.filter((r) => r.status === 'completed');
      const passed = completed.filter((r) => Number(r.percentage) >= assessment.passingMarks);

      res.json({
        message: 'Assessment results retrieved successfully',
        assessment: {
          id: assessment.id,
          title: assessment.title,
          totalMarks: assessment.totalMarks,
          passingMarks: assessment.passingMarks,
          duration: assessment.duration
        },
        results,
        summary: {
          attempts: results.length,
          completed: completed.length,
          passed: passed.length,
          averagePercentage: completed.length
            ? Math.round(
                (completed.reduce((sum, r) => sum + Number(r.percentage || 0), 0) /
                  completed.length) * 10
              ) / 10
            : 0
        }
      });
    } catch (error) {
      next(error);
    }
  }

  async submitAssessment(req, res, next) {
    try {
      const { id } = req.params;
      const { answers, timeSpent } = req.body;
      const studentId = req.user.id;

      const result = await AssessmentResult.findOne({
        where: { assessmentId: id, studentId }
      });

      if (!result) {
        return res.status(404).json({
          error: 'Assessment Not Started',
          message: 'Please start the assessment first'
        });
      }

      // A completed attempt must not be overwritten. Nothing stopped a student
      // re-POSTing this endpoint with better answers and replacing their score.
      if (result.status === 'completed') {
        return res.status(409).json({
          error: 'Already Submitted',
          message: 'You have already submitted this assessment'
        });
      }

      const assessment = await Assessment.findByPk(id);

      // Enforce the time limit against the server's own clock. `duration` was
      // stored and shown to the student but never checked, and the elapsed time
      // recorded was whatever `timeSpent` the client chose to send — so the
      // timer was decorative.
      const startedAt = result.startedAt ? new Date(result.startedAt) : null;
      const elapsedMinutes = startedAt ? (Date.now() - startedAt.getTime()) / 60000 : 0;
      // One minute of slack for the round trip, so a submission sent just
      // inside the limit is not rejected by network latency.
      if (assessment.duration && startedAt && elapsedMinutes > assessment.duration + 1) {
        await result.update({ status: 'expired', submittedAt: new Date() });
        return res.status(400).json({
          error: 'Time Expired',
          message: `This assessment allowed ${assessment.duration} minutes and was started ${Math.round(elapsedMinutes)} minutes ago.`
        });
      }
      
      // Calculate score
      let score = 0;
      const questions = assessment.questions || [];
      
      answers.forEach((answer, index) => {
        const question = questions[index];
        if (question && correctAnswerOf(question) === answer) {
          score += question.marks || 1;
        }
      });

      const percentage = (score / assessment.totalMarks) * 100;

      await result.update({
        answers,
        score,
        percentage,
        // Measured server-side. `timeSpent` arrives from the browser and a
        // student can send any number they like.
        timeSpent: startedAt ? Math.round(elapsedMinutes) : timeSpent,
        status: 'completed',
        submittedAt: new Date()
      });

      res.json({
        message: 'Assessment submitted successfully',
        result: {
          score,
          percentage,
          passed: percentage >= assessment.passingMarks
        }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AssessmentController();
