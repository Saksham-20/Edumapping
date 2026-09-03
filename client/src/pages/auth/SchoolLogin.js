// client/src/pages/auth/SchoolLogin.js
import React from 'react';
import Login from './Login';

const SchoolLogin = () => (
  <Login
    isSchoolMode
    altLink={{ prefix: 'For colleges,', to: '/login/college', label: 'click here' }}
  />
);

export default SchoolLogin;
