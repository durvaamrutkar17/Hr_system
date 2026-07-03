import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { attendanceAPI, leaveAPI, announcementAPI } from '../services/api';
import './Dashboard.css';

const formatTime = (date) =>
  date ? new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : 'Loading...';

const Dashboard = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workMode, setWorkMode] = useState('WFO');
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [checkInReason, setCheckInReason] = useState('');
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);

  // True once the employee has already checked out at least once today (e.g. took a half day) —
  // checking in again for a later session (like working at night) requires a reason.
  const needsReasonToCheckInAgain = !!todayAttendance && !hasCheckedIn;

  useEffect(() => {
    fetchData();
    checkTodayStatus();
  }, []);

  const checkTodayStatus = async () => {
    try {
      const today = new Date();
      const month = today.getMonth() + 1;
      const year = today.getFullYear();

      const response = await attendanceAPI.getAttendance({
        employeeId: user._id,
        month: month,
        year: year
      });

      const attendance = response.data.attendance || [];

      // Find today's record by comparing dates
      const todayRecord = attendance.find(record => {
        const recordDate = new Date(record.date);
        const todayDate = new Date();
        return recordDate.toDateString() === todayDate.toDateString();
      });

      if (todayRecord) {
        setTodayAttendance(todayRecord);
        setWorkMode(todayRecord.workMode || 'WFO');

        const sessions = todayRecord.sessions && todayRecord.sessions.length > 0
          ? todayRecord.sessions
          : (todayRecord.checkInTime ? [{ checkInTime: todayRecord.checkInTime, checkOutTime: todayRecord.checkOutTime }] : []);
        const lastSession = sessions[sessions.length - 1];

        if (lastSession && !lastSession.checkOutTime) {
          setHasCheckedIn(true);
          setCheckInTime(lastSession.checkInTime);
        } else {
          setHasCheckedIn(false);
          setCheckInTime(null);
        }
      } else {
        setTodayAttendance(null);
        setHasCheckedIn(false);
        setCheckInTime(null);
      }
    } catch (error) {
      console.error('Error checking today status:', error);
      setHasCheckedIn(false);
    }
  };

  const fetchData = async () => {
    try {
      const announcementResponse = await announcementAPI.getAnnouncements();
      setAnnouncements(announcementResponse.data.announcements || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (needsReasonToCheckInAgain && !checkInReason.trim()) {
      alert('Please enter a reason for checking in again');
      return;
    }

    try {
      setSubmittingCheckIn(true);
      const response = await attendanceAPI.checkIn(
        workMode,
        needsReasonToCheckInAgain ? checkInReason.trim() : undefined
      );
      if (response.data.attendance) {
        const attendance = response.data.attendance;
        const lastSession = attendance.sessions?.[attendance.sessions.length - 1];
        setHasCheckedIn(true);
        setCheckInTime(lastSession ? lastSession.checkInTime : attendance.checkInTime);
        setTodayAttendance(attendance);
        setShowReasonInput(false);
        setCheckInReason('');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      alert('❌ Error: ' + errorMsg);
    } finally {
      setSubmittingCheckIn(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      const response = await attendanceAPI.checkOut();
      if (response.data.attendance) {
        setHasCheckedIn(false);
        setTodayAttendance(response.data.attendance);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      alert('❌ Error: ' + errorMsg);
    }
  };

  return (
    <div className="dashboard">
      <div className="welcome-section">
        <h1>Welcome back {user?.firstName}!</h1>

        <div className="work-mode-selector">
          <label>Today's Work Mode:</label>
          <div className="mode-buttons">
            <button
              className={`mode-btn ${workMode === 'WFO' ? 'active' : ''}`}
              onClick={() => setWorkMode('WFO')}
              disabled={hasCheckedIn}
            >
              WFO
            </button>
            <button
              className={`mode-btn ${workMode === 'WFH' ? 'active' : ''}`}
              onClick={() => setWorkMode('WFH')}
              disabled={hasCheckedIn}
            >
              WFH
            </button>
          </div>
        </div>

        {hasCheckedIn ? (
          <>
            <div className="check-in-status">
              <p className="status-text">✅ Checked in at {formatTime(checkInTime)}</p>
              <p className="status-subtext">Work Mode: {workMode}</p>
            </div>
            <button className="check-out-btn" onClick={handleCheckOut}>
              Check Out
            </button>
          </>
        ) : needsReasonToCheckInAgain ? (
          <div className="recheck-in-section">
            <div className="checkout-complete">
              <p className="complete-text">
                You've already checked out today{todayAttendance.hoursWorked ? ` (${todayAttendance.hoursWorked.toFixed(2)} hrs logged so far)` : ''}.
              </p>
              <p className="complete-subtext">
                Coming back to work later (e.g. a night shift after a half day)? Check in again below —
                you'll need to give a reason.
              </p>
            </div>

            {!showReasonInput ? (
              <button className="check-in-btn" onClick={() => setShowReasonInput(true)}>
                Check In Again
              </button>
            ) : (
              <div className="reason-form">
                <input
                  type="text"
                  className="reason-input"
                  placeholder="Reason for checking in again (e.g. finishing an urgent deployment tonight)"
                  value={checkInReason}
                  onChange={(e) => setCheckInReason(e.target.value)}
                />
                <div className="reason-actions">
                  <button
                    className="check-in-btn"
                    onClick={handleCheckIn}
                    disabled={submittingCheckIn}
                  >
                    {submittingCheckIn ? 'Checking in...' : 'Confirm Check In'}
                  </button>
                  <button
                    className="cancel-btn"
                    onClick={() => { setShowReasonInput(false); setCheckInReason(''); }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button className="check-in-btn" onClick={handleCheckIn}>
            Check In
          </button>
        )}
      </div>

      <div className="leave-stats">
        <div className="stat-card">
          <div className="stat-icon">☀️</div>
          <div className="stat-content">
            <h3>{user?.casualLeaveBalance || 0}</h3>
            <p>Casual Leave left</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏥</div>
          <div className="stat-content">
            <h3>{user?.sickLeaveBalance || 0}</h3>
            <p>Sick Leave left</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <h3>{user?.earnedLeaveBalance || 0}</h3>
            <p>Earned Leave left</p>
          </div>
        </div>
      </div>

      <div className="announcements-section">
        <div className="section-header">
          <h2>Announcements</h2>
          <a href="/announcements">View all ›</a>
        </div>
        {loading ? (
          <p>Loading announcements...</p>
        ) : announcements.length > 0 ? (
          <div className="announcements-list">
            {announcements.slice(0, 3).map((announcement) => (
              <div key={announcement._id} className="announcement-item">
                <h3>{announcement.title}</h3>
                <p>{announcement.content.substring(0, 100)}...</p>
                <small>{new Date(announcement.createdAt).toLocaleDateString()}</small>
              </div>
            ))}
          </div>
        ) : (
          <p>No announcements available</p>
        )}
      </div>

      <div className="quick-actions">
        <div className="action-card" onClick={() => window.location.href = '/leave'}>
          <div className="action-icon">☀️</div>
          <h3>Apply Leave</h3>
        </div>
        <div className="action-card" onClick={() => window.location.href = '/salary'}>
          <div className="action-icon">📄</div>
          <h3>View Payslip</h3>
        </div>
        <div className="action-card" onClick={() => window.location.href = '/reimbursement'}>
          <div className="action-icon">💼</div>
          <h3>Claim Expense</h3>
        </div>
        <div className="action-card" onClick={() => window.location.href = '/holidays'}>
          <div className="action-icon">📅</div>
          <h3>Holidays</h3>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
