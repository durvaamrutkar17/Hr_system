import React, { useState, useEffect } from 'react';
import { resignationAPI, assetAPI } from '../services/api';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import './ResignationApprovals.css';

const FILTERS = ['pending', 'approved', 'resigned', 'rejected', 'withdrawn', 'all'];
const CLEARANCE_KEYS = ['it', 'finance', 'hr'];
const idOf = (refOrId) => refOrId?._id || refOrId;

const ResignationApprovals = () => {
  const [resignations, setResignations] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [processingId, setProcessingId] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const { message, showToast } = useToast();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [resignationsRes, assetsRes] = await Promise.all([
        resignationAPI.getResignations({}),
        assetAPI.getAssets({})
      ]);
      setResignations(resignationsRes.data.resignations || []);
      setAssets(assetsRes.data.assets || []);
    } catch (error) {
      console.error('Error fetching resignations:', error);
    } finally {
      setLoading(false);
    }
  };

  const activeAssetCountFor = (employeeId) =>
    assets.filter((a) => idOf(a.employeeId) === employeeId && a.status === 'active').length;

  const handleDecision = (id, status) => {
    setConfirmState({
      message: `${status === 'approved' ? 'Approve' : 'Reject'} this resignation request?`,
      confirmLabel: status === 'approved' ? 'Approve' : 'Reject',
      onConfirm: () => performDecision(id, status)
    });
  };

  const handleMarkResigned = (resignation) => {
    setConfirmState({
      message: `Mark ${resignation.employeeId?.firstName} ${resignation.employeeId?.lastName} as resigned? They'll be removed from the active employee list.`,
      confirmLabel: 'Mark as resigned',
      onConfirm: () => performDecision(resignation._id, 'resigned')
    });
  };

  const performDecision = async (id, status) => {
    setConfirmState(null);
    try {
      setProcessingId(id);
      await resignationAPI.updateResignation(id, { status });
      showToast('success', status === 'resigned' ? 'Employee marked as resigned' : `Resignation ${status}`);
      fetchAll();
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
      fetchAll();
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

                  {(r.status === 'pending' || r.status === 'approved' || r.status === 'resigned') && (
                    <div className="clearance-row">
                      {CLEARANCE_KEYS.map((key) => (
                        <button
                          key={key}
                          className={`clearance-chip ${r.clearance[key] ? 'cleared' : ''}`}
                          disabled={processingId === r._id || r.status === 'resigned'}
                          onClick={() => toggleClearance(r, key)}
                        >
                          {key.toUpperCase()} {r.clearance[key] ? '✓' : ''}
                        </button>
                      ))}
                    </div>
                  )}

                  {r.status === 'approved' && (() => {
                    const allCleared = CLEARANCE_KEYS.every((key) => r.clearance[key]);
                    const activeAssetCount = activeAssetCountFor(idOf(r.employeeId));
                    const blockers = [];
                    if (!allCleared) blockers.push('complete the clearance checklist');
                    if (activeAssetCount > 0) blockers.push(`return ${activeAssetCount} active asset${activeAssetCount > 1 ? 's' : ''}`);

                    return (
                      <div className="resign-action">
                        <button
                          type="button"
                          className="resign-btn"
                          disabled={blockers.length > 0 || processingId === r._id}
                          onClick={() => handleMarkResigned(r)}
                        >
                          Mark as resigned
                        </button>
                        {blockers.length > 0 && (
                          <p className="resign-blocked-note">Blocked — {blockers.join(' and ')} first</p>
                        )}
                      </div>
                    );
                  })()}
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

      <ConfirmDialog
        open={!!confirmState}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        onConfirm={confirmState?.onConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
};

export default ResignationApprovals;
