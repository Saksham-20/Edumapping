// client/src/utils/helpers.js
import { STATUS_COLORS, DEFAULT_AVATAR_URL, ERROR_MESSAGES } from './constants';

/**
 * Format date to human-readable string
 */
export const formatDate = (date, options = {}) => {
  if (!date) return '';
  
  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  
  return new Date(date).toLocaleDateString('en-US', { ...defaultOptions, ...options });
};

/**
 * Format time to human-readable string
 */
export const formatTime = (date, options = {}) => {
  if (!date) return '';
  
  const defaultOptions = {
    hour: '2-digit',
    minute: '2-digit'
  };
  
  return new Date(date).toLocaleTimeString('en-US', { ...defaultOptions, ...options });
};

/**
 * Get relative time (e.g., "2 hours ago")
 */
export const getTimeAgo = (date) => {
  if (!date) return '';
  
  const now = new Date();
  const targetDate = new Date(date);
  const diffInSeconds = Math.floor((now - targetDate) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`;
  if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`;
  return `${Math.floor(diffInSeconds / 31536000)} years ago`;
};

/**
 * Format file size in human-readable format
 */
export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format salary range
 */
export const formatSalary = (min, max) => {
  if (!min && !max) return 'Not disclosed';
  if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
  if (min) return `$${min.toLocaleString()}+`;
  return `Up to $${max.toLocaleString()}`;
};

/**
 * Get status color classes
 */
export const getStatusColor = (status, type = 'application') => {
  return STATUS_COLORS[status] || 'text-gray-600 bg-gray-100';
};

/**
 * Generate avatar URL
 */
export const getAvatarUrl = (user, size = 128) => {
  if (user?.profilePicture) return user.profilePicture;
  
  const name = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'User';
  return DEFAULT_AVATAR_URL(name).replace('size=128', `size=${size}`);
};

/**
 * Capitalize first letter of each word
 */
export const toTitleCase = (str) => {
  if (!str) return '';
  return str.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
};

/**
 * Convert snake_case to Title Case
 */
export const formatEnumValue = (value) => {
  if (!value) return '';
  return value.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
};

/**
 * Validate email format
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number format
 */
export const isValidPhone = (phone) => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone);
};

/**
 * Validate URL format
 */
export const isValidURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate password strength
 */
export const validatePassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const errors = [];
  
  if (password.length < minLength) {
    errors.push(`Password must be at least ${minLength} characters long`);
  }
  if (!hasUpperCase) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!hasLowerCase) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!hasNumbers) {
    errors.push('Password must contain at least one number');
  }

  const strength = [
    password.length >= minLength,
    hasUpperCase,
    hasLowerCase,
    hasNumbers,
    hasSpecialChar
  ].filter(Boolean).length;

  return {
    isValid: errors.length === 0,
    errors,
    strength: strength < 3 ? 'weak' : strength < 4 ? 'medium' : 'strong'
  };
};

/**
 * Debounce function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Throttle function
 */
export const throttle = (func, limit) => {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

/**
 * Deep clone object
 */
export const deepClone = (obj) => {
  if (obj === null || typeof obj !== 'object') return obj;
  if (obj instanceof Date) return new Date(obj.getTime());
  if (obj instanceof Array) return obj.map(item => deepClone(item));
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
};

/**
 * Remove empty values from object
 */
export const removeEmptyValues = (obj) => {
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== '') {
      if (typeof value === 'object' && !Array.isArray(value)) {
        const cleanedNested = removeEmptyValues(value);
        if (Object.keys(cleanedNested).length > 0) {
          cleaned[key] = cleanedNested;
        }
      } else {
        cleaned[key] = value;
      }
    }
  }
  return cleaned;
};

/**
 * Generate pagination info
 */
export const getPaginationInfo = (currentPage, totalPages, totalItems, itemsPerPage) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);
  
  return {
    startItem,
    endItem,
    totalItems,
    hasNext: currentPage < totalPages,
    hasPrev: currentPage > 1,
    isFirstPage: currentPage === 1,
    isLastPage: currentPage === totalPages
  };
};

/**
 * Generate pagination range for display
 */
export const getPaginationRange = (currentPage, totalPages, delta = 2) => {
  const range = [];
  const rangeWithDots = [];

  for (
    let i = Math.max(2, currentPage - delta);
    i <= Math.min(totalPages - 1, currentPage + delta);
    i++
  ) {
    range.push(i);
  }

  if (currentPage - delta > 2) {
    rangeWithDots.push(1, '...');
  } else {
    rangeWithDots.push(1);
  }

  rangeWithDots.push(...range);

  if (currentPage + delta < totalPages - 1) {
    rangeWithDots.push('...', totalPages);
  } else {
    rangeWithDots.push(totalPages);
  }

  return rangeWithDots.filter((v, i, arr) => arr.indexOf(v) === i);
};

/**
 * Calculate profile completion percentage
 */
export const calculateProfileCompletion = (profile, userRole = 'student') => {
  if (!profile) return 0;

  // Use weighted scoring system for better accuracy
  // Basic info (40% weight)
  const basicFields = ['firstName', 'lastName', 'email', 'phone'];
  let score = 0;
  let totalFields = 0;

  basicFields.forEach(field => {
    totalFields += 10;
    if (profile[field]) score += 10;
  });

  // Profile info (40% weight) - for students
  if (userRole === 'student' && profile.studentProfile) {
    const profileFields = [
      'course', 'branch', 'yearOfStudy', 'graduationYear',
      'cgpa', 'skills', 'bio', 'linkedinUrl'
    ];
    profileFields.forEach(field => {
      totalFields += 5;
      const value = profile.studentProfile[field];
      if (value && (Array.isArray(value) ? value.length > 0 : true)) {
        score += 5;
      }
    });
  }

  // Achievements (20% weight) - for students
  if (userRole === 'student' && profile.achievements) {
    totalFields += 20;
    if (Array.isArray(profile.achievements) && profile.achievements.length > 0) {
      score += Math.min(20, profile.achievements.length * 5);
    }
  }

  return totalFields > 0 ? Math.round((score / totalFields) * 100) : 0;
};

/**
 * Calculate job match score
 */
export const calculateJobMatchScore = (job, userProfile) => {
  if (!userProfile) return 0;

  let score = 0;
  let maxScore = 0;

  // Skills matching (40% weight)
  if (job.skillsRequired && userProfile.skills) {
    const jobSkills = job.skillsRequired.map(skill => skill.toLowerCase());
    const userSkills = userProfile.skills.map(skill => skill.toLowerCase());
    
    const matchingSkills = userSkills.filter(skill => 
      jobSkills.some(jobSkill => jobSkill.includes(skill))
    );
    
    score += (matchingSkills.length / jobSkills.length) * 40;
    maxScore += 40;
  }

  // CGPA requirement (30% weight)
  if (job.eligibilityCriteria?.minCGPA && userProfile.cgpa) {
    if (userProfile.cgpa >= job.eligibilityCriteria.minCGPA) {
      score += 30;
    }
    maxScore += 30;
  }

  // Branch requirement (20% weight)
  if (job.eligibilityCriteria?.allowedBranches && userProfile.branch) {
    if (job.eligibilityCriteria.allowedBranches.includes(userProfile.branch)) {
      score += 20;
    }
    maxScore += 20;
  }

  // Experience requirement (10% weight)
  if (job.experienceRequired === 0) {
    score += 10; // Prefer entry-level for students
  }
  maxScore += 10;

  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
};

/**
 * Handle API errors
 */
export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    const { status, data } = error.response;
    
    switch (status) {
      case 400:
        return data.message || ERROR_MESSAGES.VALIDATION_ERROR;
      case 401:
        return ERROR_MESSAGES.UNAUTHORIZED;
      case 403:
        return ERROR_MESSAGES.FORBIDDEN;
      case 404:
        return ERROR_MESSAGES.NOT_FOUND;
      case 500:
        return ERROR_MESSAGES.SERVER_ERROR;
      default:
        return data.message || ERROR_MESSAGES.SERVER_ERROR;
    }
  } else if (error.request) {
    // Network error
    return ERROR_MESSAGES.NETWORK_ERROR;
  } else {
    // Something else happened
    return error.message || ERROR_MESSAGES.SERVER_ERROR;
  }
};

/**
 * Download file from URL
 */
export const downloadFile = (url, filename) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  }
};

/**
 * Generate random string
 */
export const generateRandomString = (length = 10) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

/**
 * Check if user has permission
 */
export const hasPermission = (user, requiredRoles) => {
  if (!user || !requiredRoles) return false;
  if (Array.isArray(requiredRoles)) {
    return requiredRoles.includes(user.role);
  }
  return user.role === requiredRoles;
};

/**
 * Get initials from name
 */
export const getInitials = (firstName, lastName) => {
  const first = firstName?.charAt(0)?.toUpperCase() || '';
  const last = lastName?.charAt(0)?.toUpperCase() || '';
  return first + last;
};

/**
 * Scroll to element
 */
export const scrollToElement = (elementId, behavior = 'smooth') => {
  const element = document.getElementById(elementId);
  if (element) {
    element.scrollIntoView({ behavior, block: 'start' });
  }
};

/**
 * Check if element is in viewport
 */
export const isInViewport = (element) => {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
};

/**
 * Format job type for display
 */
export const formatJobType = (type) => {
  const types = {
    'full_time': 'Full Time',
    'part_time': 'Part Time',
    'internship': 'Internship'
  };
  return types[type] || type;
};

/**
 * Get days until deadline
 */
export const getDaysUntilDeadline = (deadline) => {
  if (!deadline) return null;
  
  const now = new Date();
  const deadlineDate = new Date(deadline);
  const diffTime = deadlineDate - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

/**
 * Check if deadline is approaching (within 7 days)
 */
export const isDeadlineApproaching = (deadline, days = 7) => {
  const daysUntil = getDaysUntilDeadline(deadline);
  return daysUntil !== null && daysUntil <= days && daysUntil > 0;
};

/**
 * Check if deadline has passed
 */
export const isDeadlinePassed = (deadline) => {
  const daysUntil = getDaysUntilDeadline(deadline);
  return daysUntil !== null && daysUntil < 0;
};

/**
 * Format large numbers (e.g., 1000 -> 1K)
 */
export const formatNumber = (num) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

/**
 * Get color for CGPA
 */
export const getCGPAColor = (cgpa) => {
  if (cgpa >= 9) return 'text-green-600';
  if (cgpa >= 8) return 'text-blue-600';
  if (cgpa >= 7) return 'text-yellow-600';
  if (cgpa >= 6) return 'text-orange-600';
  return 'text-red-600';
};

/**
 * Format CGPA for display
 */
export const formatCGPA = (cgpa) => {
  if (!cgpa) return 'N/A';
  return parseFloat(cgpa).toFixed(2);
};

/**
 * Get notification icon based on type
 */
export const getNotificationIcon = (type) => {
  const icons = {
    application_update: '📄',
    job_alert: '💼',
    event_reminder: '📅',
    system_alert: '⚠️',
    general: '🔔'
  };
  return icons[type] || '🔔';
};

/**
 * Format notification time
 */
export const formatNotificationTime = (timestamp) => {
  const now = new Date();
  const notificationTime = new Date(timestamp);
  const diffInHours = (now - notificationTime) / (1000 * 60 * 60);
  
  if (diffInHours < 24) {
    return getTimeAgo(timestamp);
  } else {
    return formatDate(timestamp, { month: 'short', day: 'numeric' });
  }
};

/**
 * Sort array by multiple criteria
 */
export const multiSort = (array, sortBy) => {
  return array.sort((a, b) => {
    for (let i = 0; i < sortBy.length; i++) {
      const { key, direction = 'asc' } = sortBy[i];
      const aVal = getNestedValue(a, key);
      const bVal = getNestedValue(b, key);
      
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    }
    return 0;
  });
};

/**
 * Get nested object value by string path
 */
export const getNestedValue = (obj, path) => {
  return path.split('.').reduce((current, key) => current?.[key], obj);
};

/**
 * Group array by property
 */
export const groupBy = (array, key) => {
  return array.reduce((groups, item) => {
    const group = getNestedValue(item, key);
    if (!groups[group]) {
      groups[group] = [];
    }
    groups[group].push(item);
    return groups;
  }, {});
};

/**
 * Filter array by search term
 */
export const filterBySearch = (array, searchTerm, searchFields) => {
  if (!searchTerm) return array;
  
  const term = searchTerm.toLowerCase();
  return array.filter(item => 
    searchFields.some(field => {
      const value = getNestedValue(item, field);
      return value && value.toString().toLowerCase().includes(term);
    })
  );
};

/**
 * Generate URL slug from text
 */
export const generateSlug = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Parse URL parameters
 */
export const parseUrlParams = (search) => {
  const params = new URLSearchParams(search);
  const result = {};
  for (const [key, value] of params) {
    result[key] = value;
  }
  return result;
};

/**
 * Build URL with parameters
 */
export const buildUrlWithParams = (baseUrl, params) => {
  const cleanParams = removeEmptyValues(params);
  const searchParams = new URLSearchParams(cleanParams);
  return `${baseUrl}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
};

/**
 * Escape HTML to prevent XSS
 */
export const escapeHtml = (text) => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

/**
 * Truncate text with ellipsis
 */
export const truncateText = (text, maxLength = 100, suffix = '...') => {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + suffix;
};

/**
 * Check if string contains only numbers
 */
export const isNumeric = (str) => {
  return /^\d+$/.test(str);
};

/**
 * Format phone number for display
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  
  // Remove all non-digits
  const cleaned = phone.replace(/\D/g, '');
  
  // Format based on length
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  } else if (cleaned.length === 11 && cleaned[0] === '1') {
    return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  
  return phone; // Return original if can't format
};

/**
 * Validate file type and size
 */
export const validateFile = (file, allowedTypes, maxSize) => {
  const errors = [];
  
  if (allowedTypes && !allowedTypes.includes(file.type)) {
    errors.push(`Invalid file type. Allowed types: ${allowedTypes.join(', ')}`);
  }
  
  if (maxSize && file.size > maxSize) {
    errors.push(`File too large. Maximum size: ${formatFileSize(maxSize)}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Convert file to base64
 */
export const fileToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
};

/**
 * Retry function with exponential backoff
 */
export const retry = async (fn, maxAttempts = 3, delay = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts) break;
      
      const backoffDelay = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  throw lastError;
};

/**
 * Check if object is empty
 */
export const isEmpty = (obj) => {
  if (obj === null || obj === undefined) return true;
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  if (typeof obj === 'string') return obj.trim().length === 0;
  return false;
};

/**
 * Get browser info
 */
export const getBrowserInfo = () => {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  
  if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari')) browser = 'Safari';
  else if (ua.includes('Edge')) browser = 'Edge';
  else if (ua.includes('Opera')) browser = 'Opera';
  
  return {
    browser,
    userAgent: ua,
    language: navigator.language,
    platform: navigator.platform
  };
};

/**
 * Check if device is mobile
 */
export const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Local storage helper with error handling
 */
export const storage = {
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Error reading from localStorage:', error);
      return defaultValue;
    }
  },
  
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('Error writing to localStorage:', error);
      return false;
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Error removing from localStorage:', error);
      return false;
    }
  },
  
  clear: () => {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing localStorage:', error);
      return false;
    }
  }
};

export default {
  formatDate,
  formatTime,
  getTimeAgo,
  formatFileSize,
  formatSalary,
  getStatusColor,
  getAvatarUrl,
  toTitleCase,
  formatEnumValue,
  isValidEmail,
  isValidPhone,
  isValidURL,
  validatePassword,
  debounce,
  throttle,
  deepClone,
  removeEmptyValues,
  getPaginationInfo,
  getPaginationRange,
  calculateProfileCompletion,
  calculateJobMatchScore,
  handleApiError,
  downloadFile,
  copyToClipboard,
  generateRandomString,
  hasPermission,
  getInitials,
  scrollToElement,
  isInViewport,
  formatJobType,
  getDaysUntilDeadline,
  isDeadlineApproaching,
  isDeadlinePassed,
  formatNumber,
  getCGPAColor,
  formatCGPA,
  getNotificationIcon,
  formatNotificationTime,
  multiSort,
  getNestedValue,
  groupBy,
  filterBySearch,
  generateSlug,
  parseUrlParams,
  buildUrlWithParams,
  escapeHtml,
  truncateText,
  isNumeric,
  formatPhoneNumber,
  validateFile,
  fileToBase64,
  retry,
  isEmpty,
  getBrowserInfo,
  isMobile,
  storage
};