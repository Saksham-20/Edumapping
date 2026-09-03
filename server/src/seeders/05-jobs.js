// server/src/seeders/05-jobs.js
'use strict';

/**
 * Deadlines are relative to seed time, not hardcoded calendar dates.
 *
 * These were fixed 2024 strings, so every seeded job was already past its
 * application deadline the moment anyone ran the seeders — the API refuses the
 * application with "Deadline Passed", and a freshly seeded install had no job
 * a student could apply to at all.
 */
const daysFromNow = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 59, 0);
  return d;
};

/** Graduating batches that are still ahead of us, so criteria stay plausible. */
const upcomingBatches = (count = 2, offset = 0) => {
  const year = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => year + offset + i);
};

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.bulkInsert('jobs', [
      {
        id: 1,
        organization_id: 2, // TechCorp Industries
        title: 'Software Engineer - Full Stack',
        description: 'We are looking for a talented Full Stack Developer to join our engineering team. You will be responsible for developing and maintaining web applications using modern technologies.',
        requirements: 'Strong knowledge of JavaScript, React, Node.js, and databases. Experience with cloud platforms (AWS/Azure) is a plus.',
        job_type: 'full_time',
        location: 'San Francisco, CA',
        salary_min: 80000,
        salary_max: 120000,
        experience_required: 2,
        skills_required: JSON.stringify(['JavaScript', 'React', 'Node.js', 'SQL', 'Git']),
        total_positions: 3,
        application_deadline: daysFromNow(45),
        status: 'active',
        eligibility_criteria: JSON.stringify({
          min_cgpa: 7.5,
          graduation_year: upcomingBatches(2),
          allowed_branches: ['Computer Science', 'Information Technology']
        }),
        created_by: 3, // Michael Johnson
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 2,
        organization_id: 2, // TechCorp Industries
        title: 'Data Scientist Intern',
        description: 'Join our data science team for a summer internship. Work on real-world machine learning projects and gain hands-on experience.',
        requirements: 'Currently pursuing Computer Science, Statistics, or related field. Knowledge of Python, R, and basic ML concepts.',
        job_type: 'internship',
        location: 'Remote',
        salary_min: 25,
        salary_max: 35,
        experience_required: 0,
        skills_required: JSON.stringify(['Python', 'R', 'Machine Learning', 'Statistics']),
        total_positions: 5,
        application_deadline: daysFromNow(30),
        status: 'active',
        eligibility_criteria: JSON.stringify({
          min_cgpa: 8.0,
          graduation_year: upcomingBatches(2),
          allowed_branches: ['Computer Science', 'Data Science', 'Statistics']
        }),
        created_by: 3, // Michael Johnson
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 3,
        organization_id: 3, // StartupXYZ
        title: 'Frontend Developer',
        description: 'Join our fast-growing startup as a Frontend Developer. Help us build beautiful, responsive user interfaces for our innovative products.',
        requirements: 'Expert in HTML, CSS, JavaScript. Experience with React, Vue.js, or similar frameworks. Understanding of responsive design principles.',
        job_type: 'full_time',
        location: 'New York, NY',
        salary_min: 70000,
        salary_max: 100000,
        experience_required: 1,
        skills_required: JSON.stringify(['HTML', 'CSS', 'JavaScript', 'React', 'Responsive Design']),
        total_positions: 2,
        application_deadline: daysFromNow(60),
        status: 'active',
        eligibility_criteria: JSON.stringify({
          min_cgpa: 7.0,
          graduation_year: upcomingBatches(3, -1),
          allowed_branches: ['Computer Science', 'Web Development', 'Design']
        }),
        created_by: 4, // Sarah Williams
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 4,
        organization_id: 3, // StartupXYZ
        title: 'Product Manager Intern',
        description: 'Gain hands-on experience in product management. Work closely with our product team to define features, gather requirements, and analyze user feedback.',
        requirements: 'Strong analytical and communication skills. Interest in technology and product development. Currently pursuing Business, Engineering, or related field.',
        job_type: 'internship',
        location: 'New York, NY',
        salary_min: 20,
        salary_max: 30,
        experience_required: 0,
        skills_required: JSON.stringify(['Analytics', 'Communication', 'Product Strategy', 'User Research']),
        total_positions: 3,
        application_deadline: daysFromNow(21),
        status: 'active',
        eligibility_criteria: JSON.stringify({
          min_cgpa: 7.5,
          graduation_year: upcomingBatches(2),
          allowed_branches: ['Business', 'Engineering', 'Computer Science']
        }),
        created_by: 4, // Sarah Williams
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('jobs', null, {});
  }
};
