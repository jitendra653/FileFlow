
import axios, { AxiosResponse, AxiosError } from 'axios';
import fs from 'fs';

const API_URL = 'http://localhost:3000/v1/auth/login';
const credentials = {
  email: 'user@example.com', // Replace with your email
  password: 'password123' // Replace with your password
};

axios.post(API_URL, credentials)
  .then((response: AxiosResponse) => {
    const token = response.data.token;
    console.log('Login successful. Token:', token);

    // Save the token to a Postman environment file
    const postmanEnv = [
      {
        key: 'authToken',
        value: token,
        enabled: true
      }
    ];

    fs.writeFileSync('postman_environment.json', JSON.stringify(postmanEnv, null, 2));
    console.log('Token saved to postman_environment.json');
  })
  .catch((error: AxiosError) => {
    if (error.response) {
      console.error('Login failed:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
  });
