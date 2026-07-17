import React, { useState, useEffect } from 'react';
import { leaveAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../permissions/permissions';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import './LeaveApprovals.css';

// Leave module upgrade: hierarchy approval. A leave with a non-empty
// approvalChain (Team Lead -> Manager -> Department Head -> HR) must be
// actioned one stage at a time by whoever the chain identifies for the
// current pending stage - see backend/controllers/leaveController.js
// updateLeave. This mirrors that same authorization check client-side so
// the Approve/Reject buttons only show up for the reviewer whose turn it
// actually is; everyone else sees a read-only "awaiting X approval" badge
// instead of buttons that would just 403.
const isMyStageToAction = (user, stage) => {
  if (!stage) return false;
  if (stage.level === 'HR') {
    return isAdmin(user) || user?.organizationLevel === 'HR';
  }
  return String(user?._id) === String(stage.approverId) || isAdmin(user);
};

const FILTERS = ['pending', 'approved', 'rejected', 'all'];

const LeaveApprovals = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [processingId, setProcessingId] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const { message, showToast } = useToast();

  useEffect(() => {
    fetchLeaves();
  }, []);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const response = await leaveAPI.getLeaves();
      setLeaves(response.data.leaves || []);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = (id, status) => {
    setConfirmState({
      message: `${status === 'approved' ? 'Approve' : 'Reject'} this leave request?`,
      confirmLabel: status === 'approved' ? 'Approve' : 'Reject',
      onConfirm: () => performDecision(id, status)
    });
  };

  const performDecision = async (id, status) => {
    setConfirmState(null);
    try {
      setProcessingId(id);
      await leaveAPI.updateLeave(id, { status });
      showToast('success', `Leave request ${status}`);
      fetchLeaves();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredLeaves = filter === 'all' ? leaves : leaves.filter((l) => l.status === filter);

  return (
    <div className="leave-approvals-page">
      <h1 className="page-title">Leave Approvals</h1>

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
        ) : filteredLeaves.length > 0 ? (
          <div className="approvals-list">
            {filteredLeaves.map((leave) => {
              const chain = leave.approvalChain || [];
              const currentStage = chain.find((s) => s.status === 'pending');
              // Old condition (kept for reference): leave.status === 'pending'
              // was the only thing gating whether Approve/Reject showed up -
              // now, for a leave with a hierarchy chain, they only show up
              // for whoever's turn it currently is.
              const canActNow = leave.status === 'pending' && (chain.length === 0 || isMyStageToAction(user, currentStage));

              return (
                <div key={leave._id} className="approval-row">
                  <div className="approval-main">
                    <p className="approval-name">
                      {leave.employeeId?.firstName} {leave.employeeId?.lastName}
                      <span className="approval-type"> — {leave.leaveType} Leave</span>
                    </p>
                    <p className="approval-meta">
                      {new Date(leave.startDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' – '}
                      {new Date(leave.endDate).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {' · '}{leave.numberOfDays} day{leave.numberOfDays !== 1 ? 's' : ''}
                    </p>
                    <p className="approval-reason">{leave.reason}</p>
                    {chain.length > 0 && (
                      <div className="approval-chain">
                        {chain.map((stage, idx) => (
                          <span key={idx} className={`status-badge chain-badge ${stage.status}`}>
                            {stage.level}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {canActNow ? (
                    <div className="approval-actions">
                      <button
                        className="approve-btn"
                        disabled={processingId === leave._id}
                        onClick={() => handleDecision(leave._id, 'approved')}
                      >
                        Approve
                      </button>
                      <button
                        className="reject-btn"
                        disabled={processingId === leave._id}
                        onClick={() => handleDecision(leave._id, 'rejected')}
                      >
                        Reject
                      </button>
                    </div>
                  ) : leave.status === 'pending' ? (
                    <span className="status-badge pending">Awaiting {currentStage?.level}</span>
                  ) : (
                    <span className={`status-badge ${leave.status}`}>{leave.status}</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="no-records">No {filter !== 'all' ? filter : ''} leave requests</p>
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

export default LeaveApprovals;
