// src/utils/apiConfig.ts
// Centralized API base URL for frontend API calls

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default API_BASE_URL;
