import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { attendanceAPI, leaveAPI, announcementAPI } from '../services/api';
import { isOnProbation } from '../utils/leavePolicy';
import { buildMonthAttendanceRows, summarizeMonthRows } from '../utils/attendanceCalendar';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import './Dashboard.css';

const formatTime = (date) =>
  date ? new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : 'Loading...';

// Saturday only needs 5 hrs for a full day; every other day needs 9.
const requiredHoursFor = (date) => (new Date(date).getDay() === 6 ? 5 : 9);

const hasCompletedRequiredHours = (attendance) =>
  !!attendance && (attendance.hoursWorked || 0) >= requiredHoursFor(attendance.date || new Date());

const Dashboard = () => {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workMode, setWorkMode] = useState('');
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState(null);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [checkInReason, setCheckInReason] = useState('');
  const [submittingCheckIn, setSubmittingCheckIn] = useState(false);
  const [monthAttendance, setMonthAttendance] = useState([]);
  const [monthLeaves, setMonthLeaves] = useState([]);
  const { message, showToast } = useToast();

  const onProbation = isOnProbation(user?.dateOfJoining);

  // True once the employee has already checked out at least once today (e.g. took a half day) —
  // checking in again for a later session (like working at night) requires a reason.
  const needsReasonToCheckInAgain = !!todayAttendance && !hasCheckedIn;

  useEffect(() => {
    fetchData();
    checkTodayStatus();
    fetchMonthLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMonthLeaves = async () => {
    try {
      const response = await leaveAPI.getEmployeeLeaves(user._id);
      setMonthLeaves(response.data.leaves || []);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    }
  };

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
      setMonthAttendance(attendance);

      // Find today's record by comparing dates
      const todayRecord = attendance.find(record => {
        const recordDate = new Date(record.date);
        const todayDate = new Date();
        return recordDate.toDateString() === todayDate.toDateString();
      });

      if (todayRecord) {
        setTodayAttendance(todayRecord);

        const sessions = todayRecord.sessions && todayRecord.sessions.length > 0
          ? todayRecord.sessions
          : (todayRecord.checkInTime ? [{ checkInTime: todayRecord.checkInTime, checkOutTime: todayRecord.checkOutTime }] : []);
        const lastSession = sessions[sessions.length - 1];

        if (lastSession && !lastSession.checkOutTime) {
          setHasCheckedIn(true);
          setCheckInTime(lastSession.checkInTime);
          // Mid-session: work mode is locked to whatever this session already started with.
          setWorkMode(todayRecord.workMode || 'WFO');
        } else {
          setHasCheckedIn(false);
          setCheckInTime(null);
          // Work mode stays locked to today's mode until the day's required hours (9,
          // or 5 on Saturday) are done — only then can a check-in-again pick a new mode.
          if (hasCompletedRequiredHours(todayRecord)) {
            setWorkMode('');
          } else {
            setWorkMode(todayRecord.workMode || 'WFO');
          }
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
    if (!workMode) {
      showToast('error', 'Please select WFO or WFH before checking in');
      return;
    }
    if (needsReasonToCheckInAgain && !checkInReason.trim()) {
      showToast('error', 'Please enter a reason for checking in again');
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
      showToast('error', errorMsg);
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
        // Work mode stays locked to today's mode — a later check-in-again reuses it.
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      showToast('error', errorMsg);
    }
  };

  const probationRows = onProbation
    ? buildMonthAttendanceRows({
        dateOfJoining: user?.dateOfJoining,
        attendance: monthAttendance,
        leaves: monthLeaves,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      })
    : [];
  const { presentCount, absentCount, leaveCount } = summarizeMonthRows(probationRows);

  // Once checked out, the mode selector stays locked to today's mode until the day's
  // required hours are actually done — only then can a check-in-again pick a new mode.
  const modeLockedForToday = needsReasonToCheckInAgain && !hasCompletedRequiredHours(todayAttendance);

  return (
    <div className="dashboard">
      <Toast message={message} />

      <div className="welcome-section">
        <h1>Welcome back {user?.firstName}!</h1>

        <div className="work-mode-selector">
          <label>Today's Work Mode:</label>
          <div className="mode-buttons">
            <button
              className={`mode-btn ${workMode === 'WFO' ? 'active' : ''}`}
              onClick={() => setWorkMode('WFO')}
              disabled={hasCheckedIn || modeLockedForToday}
            >
              WFO
            </button>
            <button
              className={`mode-btn ${workMode === 'WFH' ? 'active' : ''}`}
              onClick={() => setWorkMode('WFH')}
              disabled={hasCheckedIn || modeLockedForToday}
            >
              WFH
            </button>
          </div>
          {!workMode && !hasCheckedIn && !modeLockedForToday && (
            <p className="mode-hint">Select a work mode above before checking in</p>
          )}
          {modeLockedForToday && (
            <p className="mode-hint">
              Work mode is locked to {workMode} until you complete {requiredHoursFor(todayAttendance?.date || new Date())} hrs today
              {todayAttendance?.hoursWorked ? ` (${todayAttendance.hoursWorked.toFixed(2)} hrs logged so far)` : ''}
            </p>
          )}
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
                    disabled={!workMode || submittingCheckIn}
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
          <button className="check-in-btn" onClick={handleCheckIn} disabled={!workMode || submittingCheckIn}>
            {submittingCheckIn ? 'Checking in...' : 'Check In'}
          </button>
        )}
      </div>

      {onProbation ? (
        <div className="leave-stats">
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-content">
              <h3>{presentCount}</h3>
              <p>Present this month</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">❌</div>
            <div className="stat-content">
              <h3>{absentCount}</h3>
              <p>Absent this month</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">☀️</div>
            <div className="stat-content">
              <h3>{leaveCount}</h3>
              <p>Leave this month</p>
            </div>
          </div>
        </div>
      ) : (
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
      )}

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
