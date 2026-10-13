// client/src/pages/auth/CollegeLogin.js
import React from 'react';
import Login from './Login';

const CollegeLogin = () => (
  <Login altLink={{ prefix: 'Signing in for a school?', to: '/login/school', label: 'Use the school sign-in' }} />
);

export default CollegeLogin;
