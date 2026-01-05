// client/src/pages/auth/SchoolLogin.js
import React from 'react';
import { Link } from 'react-router-dom';
import Login from './Login';

const SchoolLogin = () => {
  return (
    <div>
      <Login isSchoolMode={true} />
      <div className="text-center mt-4">
        <p className="text-sm text-gray-600">
          For colleges,{' '}
          <Link to="/login/college" className="font-medium text-[#FF8C42] hover:text-[#e67a35]">
            click here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SchoolLogin;


