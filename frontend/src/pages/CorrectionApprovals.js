import React, { useState, useEffect } from 'react';
import { attendanceAPI } from '../services/api';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import './CorrectionApprovals.css';

const FILTERS = ['pending', 'approved', 'rejected', 'all'];

const CorrectionApprovals = () => {
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [processingId, setProcessingId] = useState(null);
  const { message, showToast } = useToast();

  useEffect(() => {
    fetchCorrections();
  }, []);

  const fetchCorrections = async () => {
    try {
      setLoading(true);
      const response = await attendanceAPI.getCorrectionRequests({});
      setCorrections(response.data.corrections || []);
    } catch (error) {
      console.error('Error fetching corrections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (id, status) => {
    if (!window.confirm(`${status === 'approved' ? 'Approve' : 'Reject'} this correction request?`)) return;

    try {
      setProcessingId(id);
      await attendanceAPI.updateCorrectionRequest(id, { status });
      showToast('success', `Correction ${status}`);
      fetchCorrections();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = filter === 'all' ? corrections : corrections.filter((c) => c.status === filter);

  return (
    <div className="correction-approvals-page">
      <h1 className="page-title">Correction Approvals</h1>

      <Toast message={message} />

      <div className="filter-bar">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="approvals-card">
        {loading ? (
          <p className="loading-text">Loading...</p>
        ) : filtered.length > 0 ? (
          <div className="approvals-list">
            {filtered.map((c) => (
              <div key={c._id} className="approval-row">
                <div className="approval-main">
                  <p className="approval-name">{c.employeeId?.firstName} {c.employeeId?.lastName}</p>
                  <p className="approval-meta">
                    {new Date(c.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' · '}
                    {c.requestedCheckInTime ? new Date(c.requestedCheckInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                    {' – '}
                    {c.requestedCheckOutTime ? new Date(c.requestedCheckOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                  </p>
                  <p className="approval-reason">{c.reason}</p>
                </div>
                {c.status === 'pending' ? (
                  <div className="approval-actions">
                    <button
                      className="approve-btn"
                      disabled={processingId === c._id}
                      onClick={() => handleDecision(c._id, 'approved')}
                    >
                      Approve
                    </button>
                    <button
                      className="reject-btn"
                      disabled={processingId === c._id}
                      onClick={() => handleDecision(c._id, 'rejected')}
                    >
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className={`status-badge ${c.status}`}>{c.status}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="no-records">No {filter !== 'all' ? filter : ''} correction requests</p>
        )}
      </div>
    </div>
  );
};

export default CorrectionApprovals;
