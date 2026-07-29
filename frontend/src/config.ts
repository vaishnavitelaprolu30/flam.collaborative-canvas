// API configuration — uses environment variable in production, localhost in dev
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
export const WS_URL = API_BASE_URL;
