// client/src/services/auth.js
import api from './api';

const TOKEN_KEY = 'campusconnect_tokens';

/** Whether a just-registered account may use the app right away. */
export const isSignedInOnRegister = (user) =>
  Boolean(user) && user.approvalStatus !== 'pending' && user.approvalStatus !== 'rejected' && user.isActive !== false;

class AuthService {
  login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      
      if (!response || !response.tokens) {
        console.error('Login response missing tokens:', response);
        throw new Error('Invalid response from server. Please try again.');
      }
      
      this.setTokens(response.tokens);
      return response;
    } catch (error) {
      console.error('Auth service login error:', error);
      throw error;
    }
  };

  register = async (userData) => {
    const response = await api.post('/auth/register', userData);
    // A pending account cannot use its tokens yet — every request would be
    // refused and the refresh would bounce the person to a bare sign-in page.
    // Only an approved account is signed in straight away.
    if (isSignedInOnRegister(response.user)) this.setTokens(response.tokens);
    return response;
  };

  logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      this.clearTokens();
    }
  };

  getCurrentUser = async () => {
    const response = await api.get('/auth/me');
    return response.user;
  };

  refreshTokens = async () => {
    const tokens = this.getTokens();
    if (!tokens || !tokens.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await api.post('/auth/refresh', {
      refreshToken: tokens.refreshToken
    });
    
    this.setTokens(response.tokens);
    return response.tokens;
  };

  setTokens = (tokens) => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  };

  getTokens = () => {
    try {
      const tokens = localStorage.getItem(TOKEN_KEY);
      if (!tokens) return null;
      
      const parsedTokens = JSON.parse(tokens);
      // Validate that tokens have the expected structure
      if (parsedTokens && typeof parsedTokens === 'object' && parsedTokens.accessToken) {
        return parsedTokens;
      }
      return null;
    } catch (error) {
      console.error('Error parsing tokens from localStorage:', error);
      // Clear corrupted tokens
      this.clearTokens();
      return null;
    }
  };

  clearTokens = () => {
    localStorage.removeItem(TOKEN_KEY);
  };

  getAccessToken = () => {
    const tokens = this.getTokens();
    return tokens ? tokens.accessToken : null;
  };
}

const authService = new AuthService();
export default authService;