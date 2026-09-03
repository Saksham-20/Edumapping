// server/src/seeders/06-applications.js
'use strict';

/**
 * Timestamps are relative to seed time.
 *
 * These were fixed January 2024 dates, which put every seeded application
 * outside any "this week / this month / this year" window — so the dashboards'
 * recent-activity panels and the date-ranged analytics were empty on a fresh
 * install even though the rows existed.
 */
const daysAgo = (days) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('applications', [
      {
        id: 1,
        job_id: 1, // Software Engineer at TechCorp
        student_id: 5, // John Doe
        resume_url: 'https://example.com/resumes/john_doe_resume.pdf',
        cover_letter: 'I am excited to apply for the Software Engineer position at TechCorp. With my strong foundation in full-stack development and passion for creating innovative solutions, I believe I would be a valuable addition to your engineering team.',
        status: 'shortlisted',
        applied_at: daysAgo(20),
        shortlisted_at: daysAgo(15),
        feedback: 'Strong technical skills, good communication. Proceed to technical interview.',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        job_id: 1, // Software Engineer at TechCorp
        student_id: 6, // Alice Wilson
        resume_url: 'https://example.com/resumes/alice_wilson_resume.pdf',
        cover_letter: 'As a computer science student with a focus on data science, I am excited to apply for the Software Engineer position. I believe my analytical skills and programming experience would be valuable for your team.',
        status: 'applied',
        applied_at: daysAgo(19),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 3,
        job_id: 2, // Data Scientist Intern at TechCorp
        student_id: 6, // Alice Wilson
        resume_url: 'https://example.com/resumes/alice_wilson_resume.pdf',
        cover_letter: 'I am very interested in the Data Scientist Intern position. My coursework in machine learning and statistics, combined with my Python and R programming skills, make me an ideal candidate for this role.',
        status: 'screening',
        applied_at: daysAgo(25),
        feedback: 'Good academic background, proceed to technical assessment.',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 4,
        job_id: 3, // Frontend Developer at StartupXYZ
        student_id: 5, // John Doe
        resume_url: 'https://example.com/resumes/john_doe_resume.pdf',
        cover_letter: 'I am excited to apply for the Frontend Developer position. My experience with React and modern web technologies, combined with my passion for creating user-friendly interfaces, would be a great fit for your team.',
        status: 'applied',
        applied_at: daysAgo(17),
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 5,
        job_id: 4, // Product Manager Intern at StartupXYZ
        student_id: 8, // Emma Davis
        resume_url: 'https://example.com/resumes/emma_davis_resume.pdf',
        cover_letter: 'I am interested in the Product Manager Intern position. My background in AI and machine learning, combined with my analytical skills, would help me understand user needs and contribute to product strategy.',
        status: 'interviewed',
        applied_at: daysAgo(23),
        interviewed_at: daysAgo(10),
        feedback: 'Good technical background, strong analytical thinking. Consider for next round.',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('applications', null, {});
  }
};
