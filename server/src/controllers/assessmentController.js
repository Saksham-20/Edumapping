// server/src/controllers/assessmentController.js
const { Assessment, Job, User, AssessmentResult } = require('../models');

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

class AssessmentController {
  async createAssessment(req, res, next) {
    try {
      const assessmentData = {
        ...req.body,
        createdBy: req.user.id
      };

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
      const whereClause = {};

      if (jobId) whereClause.jobId = jobId;

      const assessments = await Assessment.findAll({
        where: whereClause,
        include: [
          { model: Job, as: 'job', attributes: ['id', 'title'] },
          { model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName'] }
        ],
        order: [['createdAt', 'DESC']]
      });

      // Students can call this endpoint, so the answer key has to come out
      // here too — listing an assessment was enough to reveal every answer.
      // Whoever authored the assessment still needs to see them.
      const canSeeAnswers = ['recruiter', 'tpo', 'admin'].includes(req.user.role);
      const payload = assessments.map((assessment) => {
        const data = assessment.toJSON();
        if (!canSeeAnswers) data.questions = withoutAnswers(data.questions);
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

      const assessment = await Assessment.findByPk(id);
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

      const assessment = await Assessment.findByPk(id);
      
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
        timeSpent,
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
