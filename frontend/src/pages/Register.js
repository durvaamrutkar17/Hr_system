import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import PasswordInput from '../components/PasswordInput';
import { validateEmployeeForm } from '../utils/formValidation';
import './Login.css';

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    designation: '',
    department: '',
    dateOfJoining: new Date().toISOString().split('T')[0]
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Public registration is now bootstrap-only (first account = Super Admin).
  // `null` = still checking, `true`/`false` once we know.
  const [registrationOpen, setRegistrationOpen] = useState(null);
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    authAPI.getRegistrationStatus()
      .then((res) => setRegistrationOpen(!!res.data.open))
      .catch(() => setRegistrationOpen(true)); // fail open so a broken check never locks out the very first setup
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFieldErrors(prev => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const errors = validateEmployeeForm(formData);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setError('Please fix the highlighted fields');
      return;
    }

    setLoading(true);
    try {
      await register(formData);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box" style={{ maxHeight: '95vh', overflowY: 'auto' }}>
        <div className="login-header">
          <h1>HealthismPlus</h1>
          <p>HR Portal - Register</p>
        </div>

        {/* Old unconditional form render (kept for reference): registration
            used to always be open, so the form below rendered unconditionally
            here with no registrationOpen check at all. */}
        {registrationOpen === false ? (
          <div className="error-message">
            Registration is closed. This HR system already has an administrator -
            please ask them for an invite link instead of registering here.
          </div>
        ) : (
        <>
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="firstName">First Name</label>
              <input
                type="text"
                id="firstName"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="First name"
                className={fieldErrors.firstName ? 'input-error' : ''}
              />
              {fieldErrors.firstName && <p className="field-error">{fieldErrors.firstName}</p>}
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="lastName">Last Name</label>
              <input
                type="text"
                id="lastName"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Last name"
                className={fieldErrors.lastName ? 'input-error' : ''}
              />
              {fieldErrors.lastName && <p className="field-error">{fieldErrors.lastName}</p>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter your email"
              className={fieldErrors.email ? 'input-error' : ''}
            />
            {fieldErrors.email && <p className="field-error">{fieldErrors.email}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <PasswordInput
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Enter password (min 6 characters)"
              className={fieldErrors.password ? 'input-error' : ''}
            />
            {fieldErrors.password && <p className="field-error">{fieldErrors.password}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="10-digit phone number"
              className={fieldErrors.phone ? 'input-error' : ''}
            />
            {fieldErrors.phone && <p className="field-error">{fieldErrors.phone}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="designation">Designation</label>
            <input
              type="text"
              id="designation"
              name="designation"
              value={formData.designation}
              onChange={handleChange}
              placeholder="e.g., Software Engineer"
              className={fieldErrors.designation ? 'input-error' : ''}
            />
            {fieldErrors.designation && <p className="field-error">{fieldErrors.designation}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="department">Department</label>
            <select
              id="department"
              name="department"
              value={formData.department}
              onChange={handleChange}
              className={fieldErrors.department ? 'input-error' : ''}
            >
              <option value="">Select Department</option>
              <option value="Engineering">Engineering</option>
              <option value="HR">HR</option>
              <option value="Finance">Finance</option>
              <option value="Sales">Sales</option>
              <option value="Marketing">Marketing</option>
              <option value="Operations">Operations</option>
            </select>
            {fieldErrors.department && <p className="field-error">{fieldErrors.department}</p>}
          </div>

          <div className="form-group">
            <label htmlFor="dateOfJoining">Date of Joining</label>
            <input
              type="date"
              id="dateOfJoining"
              name="dateOfJoining"
              value={formData.dateOfJoining}
              onChange={handleChange}
              className={fieldErrors.dateOfJoining ? 'input-error' : ''}
            />
            {fieldErrors.dateOfJoining && <p className="field-error">{fieldErrors.dateOfJoining}</p>}
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        </>
        )}

        <div className="login-footer">
          <p>Already have an account? <a href="/login">Login here</a></p>
        </div>
      </div>
    </div>
  );
};

export default Register;
