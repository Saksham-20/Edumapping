// server/src/controllers/authController.js
const authService = require('../services/authService');
const { validationResult } = require('express-validator');

class AuthController {
  async register(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array().map(({ path, msg }) => ({ field: path, message: msg }))
        });
      }

      const result = await authService.register(req.body);
      
      res.status(201).json({
        message: 'User registered successfully',
        user: result.user,
        tokens: result.tokens
      });
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          details: errors.array().map(({ path, msg }) => ({ field: path, message: msg }))
        });
      }

      const { email, password } = req.body;
      const result = await authService.login(email, password);
      
      res.json({
        message: 'Login successful',
        user: result.user,
        tokens: result.tokens
      });
    } catch (error) {
      next(error);
    }
  }

  async refreshTokens(req, res, next) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(401).json({
          error: 'Refresh Token Required',
          message: 'Refresh token is required'
        });
      }

      const tokens = await authService.refreshTokens(refreshToken);
      
      res.json({
        message: 'Tokens refreshed successfully',
        tokens
      });
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      await authService.logout(req.user.id);
      
      res.json({
        message: 'Logout successful'
      });
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req, res) {
    res.json({
      user: req.user
    });
  }

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      const result = await authService.forgotPassword(email);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, password } = req.body;
      const result = await authService.resetPassword(token, password);
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await authService.changePassword(
        req.user.id, 
        currentPassword, 
        newPassword
      );
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const { token } = req.params;
      // Implementation for email verification
      res.json({
        message: 'Email verified successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();