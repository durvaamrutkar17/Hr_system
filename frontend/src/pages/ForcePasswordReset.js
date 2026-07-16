import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import PasswordInput from '../components/PasswordInput';
import './Login.css';

// New page: rendered by App.js instead of the normal app shell whenever
// user.mustResetPassword is true (set by an Admin/HR "force password reset"
// action - see backend/controllers/userController.js forcePasswordReset).
// The backend also enforces this server-side (middleware/auth.js protect
// blocks every non-/api/auth route while the flag is set), so this page is
// UX, not the actual security boundary.
const ForcePasswordReset = () => {
  const { user, clearMustResetPassword, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setSubmitting(true);
      await authAPI.resetPassword({ currentPassword, newPassword });
      clearMustResetPassword();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reset password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>HealthismPlus</h1>
          <p>Password reset required</p>
        </div>

        <p style={{ marginBottom: '1rem' }}>
          Hi {user?.firstName}, an administrator has required you to set a new password
          before you can continue using the app.
        </p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="currentPassword">Temporary / current password</label>
            <PasswordInput
              id="currentPassword"
              name="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter the password you were given"
            />
          </div>
          <div className="form-group">
            <label htmlFor="newPassword">New password</label>
            <PasswordInput
              id="newPassword"
              name="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm new password</label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
            />
          </div>
          <button type="submit" className="login-btn" disabled={submitting}>
            {submitting ? 'Updating...' : 'Set new password'}
          </button>
        </form>

        <div className="login-footer">
          <p><a href="#logout" onClick={(e) => { e.preventDefault(); logout(); }}>Log out instead</a></p>
        </div>
      </div>
    </div>
  );
};

export default ForcePasswordReset;
