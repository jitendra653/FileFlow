const axios = require('axios');
const fs = require('fs');

const API_URL = 'http://localhost:3000/v1/auth/login';
const credentials = {
  email: 'user@example.com', // Replace with your email
  password: 'password123' // Replace with your password
};

axios.post(API_URL, credentials)
  .then(response => {
    const token = response.data.token;

    // Save the token to a file for future use
    fs.writeFileSync('token.txt', token);
    console.log('Token saved to token.txt');
  })
  .catch(error => {
    if (error.response) {
      console.error('Login failed:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  });
