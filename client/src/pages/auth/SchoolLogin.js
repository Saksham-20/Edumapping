// client/src/pages/auth/SchoolLogin.js
import React from 'react';
import Login from './Login';

const SchoolLogin = () => (
  <Login
    isSchoolMode
    altLink={{ prefix: 'Signing in for a college?', to: '/login/college', label: 'Use the college sign-in' }}
  />
);

export default SchoolLogin;
