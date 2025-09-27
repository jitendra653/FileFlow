import React, { useState } from 'react';
import API_BASE_URL from '../utils/apiConfig';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
  const response = await fetch(`${API_BASE_URL}/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        alert('Registration successful! Please log in.');
      } else {
        alert(data.error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('An error occurred. Please try again.');
    }
  };

  return (
    <>
      <section id="register" className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md mx-auto bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
          <h1 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
            Create Account
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Join thousands of users managing files efficiently
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <input
              type="text"
              placeholder="Full Name"
              className="w-full hidden border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <input
              type="password"
              placeholder="Confirm Password"
              className="w-full hidden border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <button className="w-full py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700">
              Create Account
            </button>
          </form>
          <div className="mt-4 text-sm text-center">
            Already have an account?{" "}
            <a href="/login" className="text-indigo-600">
              Sign in
            </a>
          </div>
        </div>
      </section>
    </>

  );
};

export default Register;
