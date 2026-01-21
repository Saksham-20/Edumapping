// server/src/middleware/rbac.js
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication Required',
        message: 'Please login to access this resource'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access Forbidden',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

// Deny access to specific roles (useful for "all except X" policies)
const requireNotRole = (...deniedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication Required',
        message: 'Please login to access this resource'
      });
    }

    if (deniedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access Forbidden',
        message: `This action is not allowed for the following roles: ${deniedRoles.join(', ')}`
      });
    }

    next();
  };
};

const requireOrganization = (req, res, next) => {
  if (!req.user.organizationId) {
    return res.status(403).json({
      error: 'Organization Required',
      message: 'You must be associated with an organization'
    });
  }
  next();
};

const requireVerifiedUser = (req, res, next) => {
  if (!req.user.isVerified) {
    return res.status(403).json({
      error: 'Account Not Verified',
      message: 'Please verify your account to access this resource'
    });
  }
  next();
};

const requireVerifiedOrganization = (req, res, next) => {
  if (!req.user.organization || !req.user.organization.isVerified) {
    return res.status(403).json({
      error: 'Organization Not Verified',
      message: 'Your organization must be verified to access this resource'
    });
  }
  next();
};

const requireSameOrganization = (req, res, next) => {
  const targetOrgId = req.params.organizationId || req.body.organizationId;
  
  if (req.user.role === 'admin') {
    return next(); // Admin can access any organization
  }

  if (targetOrgId && parseInt(targetOrgId) !== req.user.organizationId) {
    return res.status(403).json({
      error: 'Access Forbidden',
      message: 'You can only access resources from your own organization'
    });
  }
  
  next();
};

const requireOwnership = (resourceUserIdField = 'userId') => {
  return (req, res, next) => {
    const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
    
    if (req.user.role === 'admin') {
      return next(); // Admin can access any resource
    }

    if (resourceUserId && parseInt(resourceUserId) !== req.user.id) {
      return res.status(403).json({
        error: 'Access Forbidden',
        message: 'You can only access your own resources'
      });
    }
    
    next();
  };
};

// Combine multiple RBAC checks
const checkPermissions = (...permissions) => {
  return (req, res, next) => {
    const errors = [];
    
    for (const permission of permissions) {
      try {
        permission(req, res, () => {});
      } catch (error) {
        errors.push(error.message);
      }
    }
    
    if (errors.length > 0) {
      return res.status(403).json({
        error: 'Permission Denied',
        messages: errors
      });
    }
    
    next();
  };
};

module.exports = {
  requireRole,
  requireNotRole,
  requireOrganization,
  requireVerifiedUser,
  requireVerifiedOrganization,
  requireSameOrganization,
  requireOwnership,
  checkPermissions
};