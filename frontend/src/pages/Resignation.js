import React, { useState, useEffect } from 'react';
import { resignationAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Resignation.css';

const STATUS_LABELS = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn'
};

const Resignation = () => {
  const { user } = useAuth();
  const [resignations, setResignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [lastWorkingDay, setLastWorkingDay] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchResignations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchResignations = async () => {
    try {
      setLoading(true);
      const response = await resignationAPI.getResignations({ employeeId: user._id });
      setResignations(response.data.resignations || []);
    } catch (error) {
      console.error('Error fetching resignations:', error);
    } finally {
      setLoading(false);
    }
  };

  const activeResignation = resignations.find((r) => ['pending', 'approved'].includes(r.status));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!lastWorkingDay) {
      alert('Please select a proposed last working day');
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (new Date(lastWorkingDay) < today) {
      alert('Last working day cannot be in the past');
      return;
    }
    if (!reason.trim()) {
      alert('Please enter a reason');
      return;
    }

    try {
      setSubmitting(true);
      await resignationAPI.createResignation({ lastWorkingDay, reason: reason.trim() });
      alert('✅ Resignation submitted for review');
      setLastWorkingDay('');
      setReason('');
      fetchResignations();
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!window.confirm('Withdraw your resignation request?')) return;

    try {
      setWithdrawing(true);
      await resignationAPI.withdrawResignation(activeResignation._id);
      alert('Resignation withdrawn');
      fetchResignations();
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <div className="resignation-page">
      <p className="eyebrow">Offboarding</p>
      <h1 className="page-title">Exit / Resignation</h1>

      {loading ? (
        <p className="loading-text">Loading...</p>
      ) : activeResignation ? (
        <div className="status-card">
          <p className="intro-text">
            Your resignation is being reviewed by your manager and HR. A clearance checklist has
            been opened across IT, Finance and HR.
          </p>

          <div className="status-summary">
            <div>
              <p className="summary-label">Status</p>
              <span className={`status-badge ${activeResignation.status}`}>
                {STATUS_LABELS[activeResignation.status]}
              </span>
            </div>
            <div>
              <p className="summary-label">Proposed last working day</p>
              <p className="summary-value">
                {new Date(activeResignation.lastWorkingDay).toLocaleDateString('en-US', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>

          <p className="reason-text">“{activeResignation.reason}”</p>

          <h3 className="checklist-title">Clearance checklist</h3>
          <div className="checklist">
            {['it', 'finance', 'hr'].map((key) => (
              <div key={key} className={`checklist-item ${activeResignation.clearance[key] ? 'cleared' : ''}`}>
                <span className="checklist-label">{key.toUpperCase()}</span>
                <span className="checklist-status">
                  {activeResignation.clearance[key] ? '✓ Cleared' : 'Pending'}
                </span>
              </div>
            ))}
          </div>

          {activeResignation.status === 'pending' && (
            <button className="withdraw-btn" onClick={handleWithdraw} disabled={withdrawing}>
              {withdrawing ? 'Withdrawing...' : 'Withdraw resignation'}
            </button>
          )}
        </div>
      ) : (
        <div className="form-card">
          <p className="intro-text">
            Submitting a resignation starts a formal review with your manager and HR, and opens a
            clearance checklist across IT, Finance and HR.
          </p>

          <form onSubmit={handleSubmit} className="resignation-form">
            <div className="form-row">
              <div className="form-group">
                <label>Proposed last working day</label>
                <input
                  type="date"
                  value={lastWorkingDay}
                  onChange={(e) => setLastWorkingDay(e.target.value)}
                  required
                />
              </div>
              <div className="form-group reason-group">
                <label>Reason</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>

            <button type="submit" className="submit-resignation-btn" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit resignation'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Resignation;
