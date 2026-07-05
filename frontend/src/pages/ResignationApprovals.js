import React, { useState, useEffect } from 'react';
import { resignationAPI } from '../services/api';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import './ResignationApprovals.css';

const FILTERS = ['pending', 'approved', 'rejected', 'withdrawn', 'all'];
const CLEARANCE_KEYS = ['it', 'finance', 'hr'];

const ResignationApprovals = () => {
  const [resignations, setResignations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [processingId, setProcessingId] = useState(null);
  const { message, showToast } = useToast();

  useEffect(() => {
    fetchResignations();
  }, []);

  const fetchResignations = async () => {
    try {
      setLoading(true);
      const response = await resignationAPI.getResignations({});
      setResignations(response.data.resignations || []);
    } catch (error) {
      console.error('Error fetching resignations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (id, status) => {
    if (!window.confirm(`${status === 'approved' ? 'Approve' : 'Reject'} this resignation request?`)) return;

    try {
      setProcessingId(id);
      await resignationAPI.updateResignation(id, { status });
      showToast('success', `Resignation ${status}`);
      fetchResignations();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const toggleClearance = async (resignation, key) => {
    try {
      setProcessingId(resignation._id);
      const clearance = { ...resignation.clearance, [key]: !resignation.clearance[key] };
      await resignationAPI.updateResignation(resignation._id, { clearance });
      fetchResignations();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = filter === 'all' ? resignations : resignations.filter((r) => r.status === filter);

  return (
    <div className="resignation-approvals-page">
      <h1 className="page-title">Resignation Approvals</h1>

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
            {filtered.map((r) => (
              <div key={r._id} className="approval-row">
                <div className="approval-main">
                  <div className="approval-header">
                    <p className="approval-name">{r.employeeId?.firstName} {r.employeeId?.lastName}</p>
                    <span className={`status-badge ${r.status}`}>{r.status}</span>
                  </div>
                  <p className="approval-meta">
                    Last working day:{' '}
                    {new Date(r.lastWorkingDay).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                  <p className="approval-reason">“{r.reason}”</p>

                  {(r.status === 'pending' || r.status === 'approved') && (
                    <div className="clearance-row">
                      {CLEARANCE_KEYS.map((key) => (
                        <button
                          key={key}
                          className={`clearance-chip ${r.clearance[key] ? 'cleared' : ''}`}
                          disabled={processingId === r._id}
                          onClick={() => toggleClearance(r, key)}
                        >
                          {key.toUpperCase()} {r.clearance[key] ? '✓' : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {r.status === 'pending' && (
                  <div className="approval-actions">
                    <button
                      className="approve-btn"
                      disabled={processingId === r._id}
                      onClick={() => handleDecision(r._id, 'approved')}
                    >
                      Approve
                    </button>
                    <button
                      className="reject-btn"
                      disabled={processingId === r._id}
                      onClick={() => handleDecision(r._id, 'rejected')}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="no-records">No {filter !== 'all' ? filter : ''} resignation requests</p>
        )}
      </div>
    </div>
  );
};

export default ResignationApprovals;
