// client/src/contexts/AuthContext.js
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import authService, { isSignedInOnRegister } from '../services/auth.js';
import toast from 'react-hot-toast';

const AuthContext = createContext();

const initialState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  tokens: null
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        tokens: action.payload.tokens,
        isAuthenticated: true,
        isLoading: false
      };
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    // Only check auth status if we don't already have a user
    if (!state.user && !state.isAuthenticated) {
      checkAuthStatus();
    }
  }, []); // Remove dependencies to prevent infinite loops

  const checkAuthStatus = async (attempt = 1) => {
    try {
      const tokens = authService.getTokens();

      // A refresh token alone is enough: /auth/me then answers 401 and the
      // API layer refreshes and retries it.
      if (tokens && (tokens.accessToken || tokens.refreshToken)) {
        const user = await authService.getCurrentUser();
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: { user, tokens: authService.getTokens() || tokens }
        });
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    } catch (error) {
      const status = error?.status || error?.response?.status;
      // Only a refusal of the session itself ends it. A network blip, or the
      // 503 the API answers with for the few seconds after a restart while it
      // reconnects to the database, used to wipe the tokens too, so every
      // deploy signed everybody out. Those are retried a few times instead,
      // and the tokens are kept so a reload later still works.
      const sessionRefused = status === 401 || status === 403;
      // A 429 is the rate limiter, not a verdict on the session: a busy
      // officer who hit it was dropped onto the sign-in page. Wait it out
      // (the limiter's own retry hint, capped) and keep the session.
      if (status === 429 && attempt < 6) {
        const hinted = Number(error?.data?.retryAfter || error?.response?.data?.retryAfter);
        const waitMs = Math.min(Number.isFinite(hinted) && hinted > 0 && hinted < 120 ? hinted * 1000 : 10000, 60000);
        setTimeout(() => checkAuthStatus(attempt + 1), waitMs);
        return;
      }
      if (!sessionRefused && attempt < 3) {
        setTimeout(() => checkAuthStatus(attempt + 1), attempt * 2000);
        return;
      }
      if (sessionRefused) authService.clearTokens();
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const login = async (email, password) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await authService.login(email, password);

      dispatch({
        type: 'LOGIN_SUCCESS',
        payload: response
      });
      
      toast.success('Signed in');
      return response;
    } catch (error) {
      // No toast here: the sign-in form shows the reason under its heading,
      // and the API layer already toasts anything other than 401/403. Toasting
      // again put the same sentence on screen two or three times.
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const register = async (userData) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await authService.register(userData);

      // Pending accounts are not signed in (see authService.register); the
      // registration screen sends them to /pending-approval instead.
      if (isSignedInOnRegister(response.user)) {
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: response
        });
      }
      return response;
    } catch (error) {
      // The API layer has already shown the reason; the form shows it too.
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      dispatch({ type: 'LOGOUT' });
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Still log out locally even if server call fails
      dispatch({ type: 'LOGOUT' });
    }
  };

  const updateUser = (userData) => {
    dispatch({ type: 'UPDATE_USER', payload: userData });
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    updateUser
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};