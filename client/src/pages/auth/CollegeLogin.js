// client/src/pages/auth/CollegeLogin.js
import React from 'react';
import { Link } from 'react-router-dom';
import Login from './Login';

const CollegeLogin = () => {
  return (
    <div>
      <Login />
      <div className="text-center mt-4">
        <p className="text-sm text-gray-600">
          For schools,{' '}
          <Link to="/login/school" className="font-medium text-[#138808] hover:text-[#0f6b0f]">
            click here
          </Link>
        </p>
      </div>
    </div>
  );
};

export default CollegeLogin;





