// client/src/pages/auth/CollegeLogin.js
import React from 'react';
import Login from './Login';

const CollegeLogin = () => (
  <Login altLink={{ prefix: 'For schools,', to: '/login/school', label: 'click here' }} />
);

export default CollegeLogin;
