import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authAPI } from '../services/api';
import PasswordInput from '../components/PasswordInput';
import './Login.css';

// New page: the "password setup" half of the invitation system. An
// Admin/HR user creates an invitation via POST /api/auth/invite (no UI for
// that yet - see backend/controllers/authController.js inviteUser), shares
// the resulting link (which points here), and the invitee lands on this page
// to set their own password and create their account.
const AcceptInvite = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { completeInviteSetup } = useAuth();

  const [invitation, setInvitation] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    authAPI.getInvitation(token)
      .then((res) => setInvitation(res.data.invitation))
      .catch((err) => setLoadError(err.response?.data?.message || 'Invitation not found or expired'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (password.length < 6) {
      setSubmitError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match');
      return;
    }

    try {
      setSubmitting(true);
      const res = await authAPI.setupPassword(token, password);
      completeInviteSetup(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Could not set password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <h1>HealthismPlus</h1>
          <p>Set your password</p>
        </div>

        {loading ? (
          <p className="loading-text">Checking invitation...</p>
        ) : loadError ? (
          <div className="error-message">{loadError}</div>
        ) : (
          <>
            <p style={{ marginBottom: '1rem' }}>
              Welcome, {invitation.firstName} {invitation.lastName}. Set a password for{' '}
              <strong>{invitation.email}</strong> to activate your account.
            </p>

            {submitError && <div className="error-message">{submitError}</div>}

            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <PasswordInput
                  id="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                />
              </div>
              <div className="form-group">
                <label htmlFor="confirmPassword">Confirm Password</label>
                <PasswordInput
                  id="confirmPassword"
                  name="confirmPassword"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
              </div>
              <button type="submit" className="login-btn" disabled={submitting}>
                {submitting ? 'Setting up...' : 'Set password and continue'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default AcceptInvite;
