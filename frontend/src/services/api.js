import axios from 'axios';

const SERVER_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
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
  getMe: () => api.get('/auth/me'),
  // Improved authentication: registration lock, invitation system, password
  // setup, forced password reset, login audit.
  getRegistrationStatus: () => api.get('/auth/registration-status'),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  invite: (invitationData) => api.post('/auth/invite', invitationData),
  getInvitation: (token) => api.get(`/auth/invite/${token}`),
  setupPassword: (token, password) => api.post(`/auth/invite/${token}/setup-password`, { password }),
  getLoginAudit: (params) => api.get('/auth/login-audit', { params })
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
  createExpense: (formData) => api.post('/expenses', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
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
  getUserById: (id) => api.get(`/users/${id}`),
  createEmployee: (employeeData) => api.post('/users', employeeData),
  updateLeaveBalance: (id, balanceData) => api.patch(`/users/${id}/leave-balance`, balanceData),
  assignRole: (id, roleData) => api.patch(`/users/${id}/role`, roleData),
  forcePasswordReset: (id) => api.patch(`/users/${id}/force-password-reset`)
};

// Announcement API calls
export const announcementAPI = {
  getAnnouncements: () => api.get('/announcements'),
  createAnnouncement: (announcementData) => api.post('/announcements', announcementData),
  updateAnnouncement: (id, updateData) => api.put(`/announcements/${id}`, updateData),
  deleteAnnouncement: (id) => api.delete(`/announcements/${id}`)
};

// Holiday API calls
export const holidayAPI = {
  getHolidays: () => api.get('/holidays'),
  createHoliday: (holidayData) => api.post('/holidays', holidayData),
  updateHoliday: (id, updateData) => api.put(`/holidays/${id}`, updateData),
  deleteHoliday: (id) => api.delete(`/holidays/${id}`)
};

// Asset API calls
export const assetAPI = {
  getAssets: (params) => api.get('/assets', { params }),
  createAsset: (assetData) => api.post('/assets', assetData),
  updateAsset: (id, updateData) => api.put(`/assets/${id}`, updateData)
};

// Flex hours API calls
export const flexHoursAPI = {
  requestFlexHours: (data) => api.post('/flex-hours', data),
  getFlexHoursRequests: (params) => api.get('/flex-hours', { params }),
  getFlexHoursBalance: () => api.get('/flex-hours/balance'),
  updateFlexHoursRequest: (id, updateData) => api.put(`/flex-hours/${id}`, updateData)
};

export default api;
