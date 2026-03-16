// client/src/utils/constants.js

// API Configuration
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
export const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:5000';

// User Roles
export const USER_ROLES = {
  STUDENT: 'student',
  RECRUITER: 'recruiter',
  TPO: 'tpo',
  ADMIN: 'admin'
};

// Approval Status
export const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

// Job Types
export const JOB_TYPES = {
  FULL_TIME: 'full_time',
  PART_TIME: 'part_time',
  INTERNSHIP: 'internship'
};

// Job Status
export const JOB_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
};

// Application Status
export const APPLICATION_STATUS = {
  APPLIED: 'applied',
  SCREENING: 'screening',
  SHORTLISTED: 'shortlisted',
  INTERVIEWED: 'interviewed',
  SELECTED: 'selected',
  REJECTED: 'rejected',
  WITHDRAWN: 'withdrawn'
};

// Event Types
export const EVENT_TYPES = {
  CAMPUS_DRIVE: 'campus_drive',
  INFO_SESSION: 'info_session',
  WORKSHOP: 'workshop',
  SEMINAR: 'seminar',
  JOB_FAIR: 'job_fair',
  OTHER: 'other'
};

// Event Status
export const EVENT_STATUS = {
  DRAFT: 'draft',
  SCHEDULED: 'scheduled',
  ONGOING: 'ongoing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
};

// Notification Types
export const NOTIFICATION_TYPES = {
  APPLICATION_UPDATE: 'application_update',
  JOB_ALERT: 'job_alert',
  EVENT_REMINDER: 'event_reminder',
  SYSTEM_ALERT: 'system_alert',
  GENERAL: 'general'
};

// Notification Priorities
export const NOTIFICATION_PRIORITIES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
};

// Achievement Types
export const ACHIEVEMENT_TYPES = {
  ACADEMIC: 'academic',
  PROJECT: 'project',
  CERTIFICATION: 'certification',
  COMPETITION: 'competition',
  PUBLICATION: 'publication',
  OTHER: 'other'
};

// File Types
export const FILE_TYPES = {
  RESUME: 'resume',
  PROFILE_PICTURE: 'profile_picture',
  DOCUMENT: 'document',
  OTHER: 'other'
};

// Gender Options
export const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' }
];

// Year of Study Options
export const YEAR_OF_STUDY_OPTIONS = [
  { value: 1, label: '1st Year' },
  { value: 2, label: '2nd Year' },
  { value: 3, label: '3rd Year' },
  { value: 4, label: '4th Year' },
  { value: 5, label: '5th Year' },
  { value: 6, label: '6th Year' }
];

// Graduation Year Options (generate dynamically)
export const getGraduationYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 2; i <= currentYear + 6; i++) {
    years.push({ value: i, label: i.toString() });
  }
  return years;
};

// Common Skills (for autocomplete)
export const COMMON_SKILLS = [
  // Programming Languages
  'JavaScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Swift', 'Kotlin',
  'TypeScript', 'Scala', 'R', 'MATLAB', 'Perl', 'Rust', 'Dart', 'Objective-C',
  
  // Web Technologies
  'HTML', 'CSS', 'React', 'Angular', 'Vue.js', 'Node.js', 'Express.js', 'Next.js',
  'Nuxt.js', 'jQuery', 'Bootstrap', 'Tailwind CSS', 'SASS', 'LESS', 'Webpack',
  'Babel', 'Redux', 'MobX', 'GraphQL', 'REST APIs', 'WebSocket',
  
  // Mobile Development
  'React Native', 'Flutter', 'iOS Development', 'Android Development', 'Xamarin',
  'Ionic', 'Cordova', 'Unity', 'Unreal Engine',
  
  // Backend & Databases
  'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Elasticsearch', 'Firebase',
  'SQLite', 'Oracle', 'Microsoft SQL Server', 'Cassandra', 'DynamoDB',
  
  // Cloud & DevOps
  'AWS', 'Azure', 'Google Cloud Platform', 'Docker', 'Kubernetes', 'Jenkins',
  'GitLab CI/CD', 'GitHub Actions', 'Terraform', 'Ansible', 'Chef', 'Puppet',
  'Nginx', 'Apache', 'Load Balancing', 'Microservices',
  
  // Data Science & ML
  'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'Scikit-learn',
  'Pandas', 'NumPy', 'Matplotlib', 'Seaborn', 'Jupyter', 'Apache Spark',
  'Hadoop', 'Tableau', 'Power BI', 'Data Analysis', 'Statistics',
  
  // Version Control & Tools
  'Git', 'GitHub', 'GitLab', 'Bitbucket', 'SVN', 'Mercurial',
  
  // Testing
  'Unit Testing', 'Integration Testing', 'Jest', 'Mocha', 'Chai', 'Selenium',
  'Cypress', 'Puppeteer', 'JUnit', 'TestNG', 'PyTest',
  
  // Design & UI/UX
  'UI/UX Design', 'Figma', 'Adobe XD', 'Sketch', 'Photoshop', 'Illustrator',
  'InVision', 'Principle', 'Framer', 'Wireframing', 'Prototyping',
  
  // Project Management & Soft Skills
  'Agile', 'Scrum', 'Kanban', 'Jira', 'Trello', 'Asana', 'Leadership',
  'Team Management', 'Communication', 'Problem Solving', 'Critical Thinking',
  'Time Management', 'Project Planning',
  
  // Other Technologies
  'Blockchain', 'Cryptocurrency', 'IoT', 'AR/VR', 'Game Development',
  'Cybersecurity', 'Network Security', 'Penetration Testing', 'Ethical Hacking'
];

// Common Course Names
export const COMMON_COURSES = [
  'Bachelor of Technology (B.Tech)',
  'Bachelor of Engineering (B.E.)',
  'Bachelor of Computer Applications (BCA)',
  'Bachelor of Science (B.Sc)',
  'Bachelor of Business Administration (BBA)',
  'Bachelor of Commerce (B.Com)',
  'Bachelor of Arts (B.A.)',
  'Master of Technology (M.Tech)',
  'Master of Engineering (M.E.)',
  'Master of Computer Applications (MCA)',
  'Master of Science (M.Sc)',
  'Master of Business Administration (MBA)',
  'Master of Commerce (M.Com)',
  'Master of Arts (M.A.)',
  'Doctor of Philosophy (Ph.D.)',
  'Diploma in Engineering',
  'Certificate Course'
];

// Common Branch Names
export const COMMON_BRANCHES = [
  'Computer Science Engineering',
  'Information Technology',
  'Electronics and Communication Engineering',
  'Electrical Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Chemical Engineering',
  'Aerospace Engineering',
  'Biotechnology',
  'Automobile Engineering',
  'Industrial Engineering',
  'Environmental Engineering',
  'Petroleum Engineering',
  'Mining Engineering',
  'Metallurgical Engineering',
  'Textile Engineering',
  'Agricultural Engineering',
  'Food Technology',
  'Software Engineering',
  'Data Science',
  'Artificial Intelligence',
  'Cybersecurity',
  'Robotics Engineering'
];

// File Size Limits
export const FILE_SIZE_LIMITS = {
  RESUME: 10 * 1024 * 1024, // 10MB
  PROFILE_PICTURE: 5 * 1024 * 1024, // 5MB
  DOCUMENT: 15 * 1024 * 1024 // 15MB
};

// Allowed File Types
export const ALLOWED_FILE_TYPES = {
  RESUME: ['application/pdf'],
  PROFILE_PICTURE: ['image/jpeg', 'image/png', 'image/gif'],
  DOCUMENT: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 100
};

// Form Validation
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  NAME_MIN_LENGTH: 1,
  NAME_MAX_LENGTH: 100,
  EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE_REGEX: /^[\+]?[1-9][\d]{0,15}$/,
  URL_REGEX: /^https?:\/\/.+/,
  MIN_CGPA: 0,
  MAX_CGPA: 10,
  MIN_PERCENTAGE: 0,
  MAX_PERCENTAGE: 100
};

// Status Colors
export const STATUS_COLORS = {
  // Application Status Colors
  [APPLICATION_STATUS.APPLIED]: 'text-blue-600 bg-blue-100',
  [APPLICATION_STATUS.SCREENING]: 'text-yellow-600 bg-yellow-100',
  [APPLICATION_STATUS.SHORTLISTED]: 'text-purple-600 bg-purple-100',
  [APPLICATION_STATUS.INTERVIEWED]: 'text-orange-600 bg-orange-100',
  [APPLICATION_STATUS.SELECTED]: 'text-green-600 bg-green-100',
  [APPLICATION_STATUS.REJECTED]: 'text-red-600 bg-red-100',
  [APPLICATION_STATUS.WITHDRAWN]: 'text-gray-600 bg-gray-100',
  
  // Job Status Colors
  [JOB_STATUS.DRAFT]: 'text-gray-600 bg-gray-100',
  [JOB_STATUS.ACTIVE]: 'text-green-600 bg-green-100',
  [JOB_STATUS.CLOSED]: 'text-red-600 bg-red-100',
  [JOB_STATUS.CANCELLED]: 'text-red-600 bg-red-100',
  
  // Job Type Colors
  [JOB_TYPES.FULL_TIME]: 'text-green-600 bg-green-100',
  [JOB_TYPES.PART_TIME]: 'text-yellow-600 bg-yellow-100',
  [JOB_TYPES.INTERNSHIP]: 'text-blue-600 bg-blue-100',
  
  // Event Type Colors
  [EVENT_TYPES.CAMPUS_DRIVE]: 'text-blue-600 bg-blue-100',
  [EVENT_TYPES.INFO_SESSION]: 'text-green-600 bg-green-100',
  [EVENT_TYPES.WORKSHOP]: 'text-purple-600 bg-purple-100',
  [EVENT_TYPES.SEMINAR]: 'text-yellow-600 bg-yellow-100',
  [EVENT_TYPES.JOB_FAIR]: 'text-red-600 bg-red-100',
  [EVENT_TYPES.OTHER]: 'text-gray-600 bg-gray-100',
  
  // Achievement Type Colors
  [ACHIEVEMENT_TYPES.ACADEMIC]: 'text-blue-600 bg-blue-100',
  [ACHIEVEMENT_TYPES.PROJECT]: 'text-green-600 bg-green-100',
  [ACHIEVEMENT_TYPES.CERTIFICATION]: 'text-purple-600 bg-purple-100',
  [ACHIEVEMENT_TYPES.COMPETITION]: 'text-yellow-600 bg-yellow-100',
  [ACHIEVEMENT_TYPES.PUBLICATION]: 'text-red-600 bg-red-100',
  [ACHIEVEMENT_TYPES.OTHER]: 'text-gray-600 bg-gray-100'
};

// Default Profile Pictures
export const DEFAULT_AVATAR_URL = (name) => 
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=156395&color=fff&size=128`;

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKENS: 'collegeplacements_tokens',
  USER_PREFERENCES: 'collegeplacements_preferences',
  THEME: 'collegeplacements_theme',
  LANGUAGE: 'collegeplacements_language'
};

// Date Formats
export const DATE_FORMATS = {
  SHORT: 'MM/DD/YYYY',
  LONG: 'MMMM DD, YYYY',
  ISO: 'YYYY-MM-DD',
  TIME: 'HH:mm',
  DATETIME: 'MMMM DD, YYYY HH:mm'
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied. You do not have permission to access this resource.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  FILE_TOO_LARGE: 'File size exceeds the maximum limit.',
  INVALID_FILE_TYPE: 'Invalid file type. Please select a supported file format.',
  REQUIRED_FIELD: 'This field is required.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  WEAK_PASSWORD: 'Password must be at least 8 characters with uppercase, lowercase, and numbers.',
  PASSWORDS_DONT_MATCH: 'Passwords do not match.'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  PROFILE_UPDATED: 'Profile updated successfully!',
  APPLICATION_SUBMITTED: 'Application submitted successfully!',
  RESUME_GENERATED: 'Resume generated successfully!',
  FILE_UPLOADED: 'File uploaded successfully!',
  LOGIN_SUCCESS: 'Login successful!',
  LOGOUT_SUCCESS: 'Logout successful!',
  REGISTRATION_SUCCESS: 'Registration successful!',
  PASSWORD_CHANGED: 'Password changed successfully!',
  EMAIL_SENT: 'Email sent successfully!',
  SETTINGS_SAVED: 'Settings saved successfully!'
};

// Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/',
  JOBS: '/jobs',
  JOB_DETAIL: '/jobs/:id',
  JOB_POST: '/jobs/new',
  APPLICATIONS: '/applications',
  APPLICATION_DETAIL: '/applications/:id',
  PROFILE: '/profile',
  RESUME: '/resume',
  EVENTS: '/events',
  EVENT_DETAIL: '/events/:id',
  NOTIFICATIONS: '/notifications',
  SETTINGS: '/settings'
};

// Feature Flags
export const FEATURES = {
  NOTIFICATIONS: true,
  RESUME_BUILDER: true,
  VIDEO_INTERVIEWS: false,
  CHAT_SUPPORT: false,
  ANALYTICS_DASHBOARD: true,
  BULK_OPERATIONS: true,
  ADVANCED_SEARCH: true,
  DARK_MODE: false
};

// App Configuration
export const APP_CONFIG = {
  NAME: 'College Placements',
  VERSION: '1.0.0',
  COMPANY: 'Globoniks',
  SUPPORT_EMAIL: 'support@college-placements.globoniks.com',
  PRIVACY_POLICY_URL: '/privacy',
  TERMS_OF_SERVICE_URL: '/terms',
  GITHUB_URL: 'https://github.com/globoniks',
  DOCUMENTATION_URL: 'https://college-placements.globoniks.com/docs'
};

export default {
  API_BASE_URL,
  WS_URL,
  USER_ROLES,
  APPROVAL_STATUS,
  JOB_TYPES,
  JOB_STATUS,
  APPLICATION_STATUS,
  EVENT_TYPES,
  EVENT_STATUS,
  NOTIFICATION_TYPES,
  NOTIFICATION_PRIORITIES,
  ACHIEVEMENT_TYPES,
  FILE_TYPES,
  GENDER_OPTIONS,
  YEAR_OF_STUDY_OPTIONS,
  getGraduationYearOptions,
  COMMON_SKILLS,
  COMMON_COURSES,
  COMMON_BRANCHES,
  FILE_SIZE_LIMITS,
  ALLOWED_FILE_TYPES,
  PAGINATION,
  VALIDATION,
  STATUS_COLORS,
  DEFAULT_AVATAR_URL,
  STORAGE_KEYS,
  DATE_FORMATS,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  ROUTES,
  FEATURES,
  APP_CONFIG
};