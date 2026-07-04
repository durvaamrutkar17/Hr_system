import React, { useState, useEffect } from 'react';
import { leaveAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { isOnProbation, probationEndDate, computeLeavePayability } from '../utils/leavePolicy';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import './Leave.css';

const Leave = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { message, showToast } = useToast();
  const [formData, setFormData] = useState({
    leaveType: 'Casual',
    startDate: '',
    endDate: '',
    reason: ''
  });

  useEffect(() => {
    fetchLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const response = await leaveAPI.getEmployeeLeaves(user._id);
      setLeaves(response.data.leaves || []);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    const days = Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(0, days);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.startDate || !formData.endDate) {
      showToast('error', 'Please select both From and To dates');
      return;
    }
    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      showToast('error', 'To date cannot be before From date');
      return;
    }
    if (!formData.reason.trim()) {
      showToast('error', 'Please enter a reason');
      return;
    }

    try {
      setSubmitting(true);
      await leaveAPI.createLeave({
        employeeId: user._id,
        leaveType: formData.leaveType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        numberOfDays: calculateDays(formData.startDate, formData.endDate),
        reason: formData.reason.trim()
      });
      showToast('success', 'Leave request sent to your reporting manager');
      setFormData({ leaveType: 'Casual', startDate: '', endDate: '', reason: '' });
      fetchLeaves();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const onProbation = isOnProbation(user?.dateOfJoining);
  const probationEnd = probationEndDate(user?.dateOfJoining);

  const leavesByMonth = {};
  leaves.forEach((l) => {
    const d = new Date(l.startDate);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    (leavesByMonth[key] = leavesByMonth[key] || []).push(l);
  });

  const payabilityById = {};
  Object.entries(leavesByMonth).forEach(([key, monthLeaves]) => {
    const [year, month] = key.split('-').map(Number);
    const { breakdown } = computeLeavePayability(user?.dateOfJoining, monthLeaves, month, year);
    breakdown.forEach(({ leave, paidDays, unpaidDays }) => {
      payabilityById[leave._id] = { paidDays, unpaidDays };
    });
  });

  return (
    <div className="leave-page">
      <p className="eyebrow">Time Off</p>
      <h1 className="page-title">Leave</h1>

      <Toast message={message} />

      <div className={`employment-banner ${onProbation ? 'probation' : 'permanent'}`}>
        {onProbation ? (
          <span>
            On probation until <strong>{probationEnd.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</strong> —
            leave taken during probation is unpaid and marked absent.
          </span>
        ) : (
          <span>
            Permanent employee — up to <strong>2 paid leave days per month</strong>; any additional approved leave day in the same month is unpaid and marked absent.
          </span>
        )}
      </div>

      <div className="leave-stats">
        <div className="stat-card">
          <p className="stat-label">Casual Leave</p>
          <h3 className="stat-value">{user?.casualLeaveBalance ?? 0}</h3>
        </div>
        <div className="stat-card">
          <p className="stat-label">Sick Leave</p>
          <h3 className="stat-value">{user?.sickLeaveBalance ?? 0}</h3>
        </div>
        <div className="stat-card">
          <p className="stat-label">Earned Leave</p>
          <h3 className="stat-value">{user?.earnedLeaveBalance ?? 0}</h3>
        </div>
      </div>

      <div className="apply-section">
        <h2 className="section-title">Apply for leave</h2>
        <form onSubmit={handleSubmit} className="apply-form">
          <div className="form-row">
            <div className="form-group">
              <label>Type</label>
              <select name="leaveType" value={formData.leaveType} onChange={handleChange}>
                <option value="Casual">Casual</option>
                <option value="Sick">Sick</option>
                <option value="Earned">Earned</option>
                <option value="Unpaid">Unpaid</option>
              </select>
            </div>
            <div className="form-group">
              <label>From</label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>To</label>
              <input
                type="date"
                name="endDate"
                value={formData.endDate}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Reason</label>
              <input
                type="text"
                name="reason"
                placeholder="Brief reason"
                value={formData.reason}
                onChange={handleChange}
              />
            </div>
          </div>

          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting ? 'Sending...' : 'Send to reporting manager'}
          </button>
        </form>
      </div>

      <div className="requests-section">
        <h2 className="section-title">My requests</h2>
        {loading ? (
          <p className="loading-text">Loading...</p>
        ) : leaves.length > 0 ? (
          <div className="requests-list">
            {leaves.map((leave) => {
              const payability = payabilityById[leave._id];
              return (
                <div key={leave._id} className="request-row">
                  <div className="request-main">
                    <p className="request-type">{leave.leaveType} Leave</p>
                    <p className="request-dates">
                      {new Date(leave.startDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' – '}
                      {new Date(leave.endDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' · '}{leave.numberOfDays} day{leave.numberOfDays !== 1 ? 's' : ''}
                    </p>
                    <p className="request-reason">{leave.reason}</p>
                    {leave.status === 'approved' && payability && payability.unpaidDays > 0 && (
                      <p className="request-unpaid-note">
                        {payability.paidDays > 0
                          ? `${payability.paidDays} day${payability.paidDays !== 1 ? 's' : ''} paid · ${payability.unpaidDays} day${payability.unpaidDays !== 1 ? 's' : ''} unpaid (marked absent)`
                          : `${payability.unpaidDays} day${payability.unpaidDays !== 1 ? 's' : ''} unpaid (marked absent)`}
                      </p>
                    )}
                  </div>
                  <span className={`status-badge ${leave.status}`}>{leave.status}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="no-records">No leave requests yet.</p>
        )}
      </div>
    </div>
  );
};

export default Leave;
