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
        throw new Error('Invalid response from server. Please try again.');
      }
      
      this.setTokens(response.tokens);
      return response;
    } catch (error) {
      // Not logged: a mistyped password is an expected answer, which the
      // sign-in form shows under its heading. It used to print the error
      // and its stack to the console as well, on every failed attempt.
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

  // One refresh at a time. A dashboard fires a dozen requests at once; when
  // the access token had expired each of them got a 401 and started its own
  // refresh, so a single expiry cost a dozen extra calls against the
  // per-user rate limit. Callers that arrive while one is in flight share it.
  refreshInFlight = null;

  refreshTokens = () => {
    if (!this.refreshInFlight) {
      this.refreshInFlight = (async () => {
        const tokens = this.getTokens();
        if (!tokens || !tokens.refreshToken) {
          throw new Error('No refresh token available');
        }
        const response = await api.post('/auth/refresh', {
          refreshToken: tokens.refreshToken
        });
        this.setTokens(response.tokens);
        return response.tokens;
      })().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  };

  setTokens = (tokens) => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  };

  getTokens = () => {
    try {
      const tokens = localStorage.getItem(TOKEN_KEY);
      if (!tokens) return null;
      
      const parsedTokens = JSON.parse(tokens);
      // A session is alive while either token is. Requiring the access token
      // here meant that once it was gone (cleared, or dropped by the browser)
      // the still-valid refresh token was never read: the app treated the
      // person as signed out and sent them to the sign-in page instead of
      // refreshing.
      if (
        parsedTokens &&
        typeof parsedTokens === 'object' &&
        (parsedTokens.accessToken || parsedTokens.refreshToken)
      ) {
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