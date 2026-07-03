import axios from 'axios';

const SERVER_URL = 'http://localhost:5000';
const API_URL = `${SERVER_URL}/api`;

export const FILE_BASE_URL = SERVER_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  getMe: () => api.get('/auth/me')
};

// Leave API calls
export const leaveAPI = {
  getLeaves: () => api.get('/leaves'),
  getEmployeeLeaves: (id) => api.get(`/leaves/employee/${id}`),
  createLeave: (leaveData) => api.post('/leaves', leaveData),
  updateLeave: (id, updateData) => api.put(`/leaves/${id}`, updateData),
  deleteLeave: (id) => api.delete(`/leaves/${id}`)
};

// Attendance API calls
export const attendanceAPI = {
  checkIn: (workMode, reason) => api.post('/attendance/check-in', { workMode, reason }),
  checkOut: () => api.post('/attendance/check-out'),
  getAttendance: (params) => api.get('/attendance', { params }),
  requestCorrection: (data) => api.post('/attendance/correction', data),
  getCorrectionRequests: (params) => api.get('/attendance/correction', { params }),
  updateCorrectionRequest: (id, updateData) => api.put(`/attendance/correction/${id}`, updateData)
};

// Payslip API calls
export const payslipAPI = {
  getPayslips: (params) => api.get('/payslips', { params }),
  createPayslip: (payslipData) => api.post('/payslips', payslipData),
  updatePayslip: (id, updateData) => api.put(`/payslips/${id}`, updateData)
};

// Expense API calls
export const expenseAPI = {
  getExpenses: (params) => api.get('/expenses', { params }),
  createExpense: (expenseData) => api.post('/expenses', expenseData),
  updateExpense: (id, updateData) => api.put(`/expenses/${id}`, updateData)
};

// Document API calls
export const documentAPI = {
  getDocuments: (params) => api.get('/documents', { params }),
  uploadDocument: (formData) => api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  addCompanyDocument: (formData) => api.post('/documents/company', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deleteDocument: (id) => api.delete(`/documents/${id}`)
};

// Resignation API calls
export const resignationAPI = {
  getResignations: (params) => api.get('/resignations', { params }),
  createResignation: (data) => api.post('/resignations', data),
  updateResignation: (id, updateData) => api.put(`/resignations/${id}`, updateData),
  withdrawResignation: (id) => api.put(`/resignations/${id}/withdraw`)
};

// User API calls
export const userAPI = {
  getUsers: () => api.get('/users'),
  createEmployee: (employeeData) => api.post('/users', employeeData)
};

// Announcement API calls
export const announcementAPI = {
  getAnnouncements: () => api.get('/announcements'),
  createAnnouncement: (announcementData) => api.post('/announcements', announcementData),
  updateAnnouncement: (id, updateData) => api.put(`/announcements/${id}`, updateData),
  deleteAnnouncement: (id) => api.delete(`/announcements/${id}`)
};

export default api;
