import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canManagePerformance, canManageOfficialDocuments } from '../permissions/permissions';
import {
  userAPI,
  attendanceAPI,
  leaveAPI,
  flexHoursAPI,
  expenseAPI,
  documentAPI,
  documentRequestAPI,
  assetAPI,
  payslipAPI,
  hierarchyAPI,
  performanceAPI,
  resignationAPI,
  FILE_BASE_URL
} from '../services/api';
import { buildMonthAttendanceRows, summarizeMonthRows, getDayStatus, computeLopBreakdown } from '../utils/attendanceCalendar';
import { downloadPayslipPdf } from '../utils/payslipPdf';
import { splitCustomSalaryFields } from '../utils/salaryCalc';
import { DOCUMENT_CATEGORIES, DOCUMENT_TYPES, isExpired, isExpiringSoon } from '../utils/documentTaxonomy';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import './ManagerDashboard.css';
import './Attendance.css';
import './Salary.css';
import './Documents.css';
import './EmployeeProfile.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS = [2023, 2024, 2025, 2026];

// Upgraded Employee Profile: everything below used to be one long
// unconditionally-rendered scroll that fetched all of an employee's data
// (attendance, leave, payroll, documents, assets, corrections, expenses) in
// one big Promise.all on mount. It's now a tabbed layout matching the 10
// required sections, and each tab's data loads dynamically - only when that
// tab is opened for the first time (see the dispatcher effect below) -
// instead of everything loading upfront regardless of what the viewer
// actually looks at.
const TABS = [
  { key: 'personal', label: 'Personal Information' },
  { key: 'employment', label: 'Employment Information' },
  { key: 'hierarchy', label: 'Reporting Hierarchy' },
  { key: 'documents', label: 'Documents' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'leave', label: 'Leave' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'assets', label: 'Assets' },
  { key: 'performance', label: 'Performance' },
  { key: 'exit', label: 'Exit Process' }
];

const formatCurrency = (value) => `₹${Math.round(value || 0).toLocaleString('en-IN')}`;

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

const getStatusLabel = (paymentStatus) =>
  paymentStatus === 'paid'
    ? { label: 'Paid', className: 'paid' }
    : { label: 'Processing', className: 'processing' };

const EmployeeProfile = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [employee, setEmployee] = useState(null);
  const [loadingEmployee, setLoadingEmployee] = useState(true);
  const { message, showToast } = useToast();

  // Which tab is open, and which tabs have already fetched their data once
  // (so switching back to a tab you've already visited doesn't refetch it).
  const [activeTab, setActiveTab] = useState('personal');
  const [loadedTabs, setLoadedTabs] = useState(new Set());

  // Leave tab
  const [leaves, setLeaves] = useState([]);
  const [loadingLeaves, setLoadingLeaves] = useState(true);
  const [editingLeaveBalance, setEditingLeaveBalance] = useState(false);
  const [leaveBalanceForm, setLeaveBalanceForm] = useState({ casual: 0, sick: 0, earned: 0 });
  const [savingLeaveBalance, setSavingLeaveBalance] = useState(false);

  // Documents tab
  const [documents, setDocuments] = useState([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [documentRequests, setDocumentRequests] = useState([]);
  // HR/Admin "upload official document" form (only rendered for canManageOfficialDocuments)
  const [hrDocForm, setHrDocForm] = useState({ fileName: '', documentType: 'Offer Letter', documentCategory: '', expiryDate: '', visibility: 'private' });
  const [hrDocFile, setHrDocFile] = useState(null);
  const [uploadingHrDoc, setUploadingHrDoc] = useState(false);

  // Assets tab
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);

  // Payroll tab (also needs approved expenses to fold reimbursements into net pay)
  const [payslips, setPayslips] = useState([]);
  const [latestPayslip, setLatestPayslip] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loadingPayroll, setLoadingPayroll] = useState(true);

  // Attendance tab (also shows correction requests)
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [attendance, setAttendance] = useState([]);
  const [flexRequests, setFlexRequests] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [expandedRows, setExpandedRows] = useState(new Set());

  // Reporting Hierarchy tab
  const [directReports, setDirectReports] = useState([]);
  const [reportingChain, setReportingChain] = useState([]);
  const [loadingHierarchy, setLoadingHierarchy] = useState(true);

  // Performance tab
  const [performanceReviews, setPerformanceReviews] = useState([]);
  const [loadingPerformance, setLoadingPerformance] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewForm, setReviewForm] = useState({ reviewPeriod: '', rating: 3, strengths: '', areasForImprovement: '', goals: '' });
  const [savingReview, setSavingReview] = useState(false);

  // Exit Process tab
  const [resignations, setResignations] = useState([]);
  const [loadingExit, setLoadingExit] = useState(true);

  // Old combined effect (kept for reference): this used to fetch the employee
  // record AND every other tab's data (corrections, expenses, documents,
  // assets, payslips, leaves) together in one Promise.all on mount:
  //
  // useEffect(() => {
  //   const fetchEmployee = async () => { ...userAPI.getUserById(employeeId)... };
  //   const fetchStaticDetail = async () => {
  //     const [correctionsRes, expensesRes, documentsRes, assetsRes, payslipsRes, leavesRes] = await Promise.all([...]);
  //     ...
  //   };
  //   fetchEmployee();
  //   fetchStaticDetail();
  // }, [employeeId]);
  //
  // The employee record itself still loads immediately (the header and the
  // Personal/Employment tabs need it right away), but every other section
  // now loads on demand - see the tab dispatcher effect further down.
  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        setLoadingEmployee(true);
        const res = await userAPI.getUserById(employeeId);
        setEmployee(res.data.user || null);
      } catch (error) {
        console.error('Error loading employee:', error);
        setEmployee(null);
      } finally {
        setLoadingEmployee(false);
      }
    };

    fetchEmployee();
    // Reset tab-loaded tracking when navigating between different employees.
    setLoadedTabs(new Set());
    setActiveTab('personal');
  }, [employeeId]);

  const fetchLeaves = useCallback(async () => {
    try {
      setLoadingLeaves(true);
      const res = await leaveAPI.getEmployeeLeaves(employeeId);
      setLeaves(res.data.leaves || []);
    } catch (error) {
      console.error('Error loading leaves:', error);
    } finally {
      setLoadingLeaves(false);
    }
  }, [employeeId]);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoadingDocuments(true);
      // Document requests are fetched alongside documents so HR/Admin can see
      // and act on this employee's pending "please issue me X" requests right
      // here on the Documents tab (documentRequestAPI already scopes the
      // result to this employeeId whether the caller is a reviewer or the
      // employee themselves).
      const [docsRes, requestsRes] = await Promise.all([
        documentAPI.getDocuments({ employeeId }),
        documentRequestAPI.getRequests({ employeeId })
      ]);
      setDocuments(docsRes.data.documents || []);
      setDocumentRequests(requestsRes.data.requests || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  }, [employeeId]);

  const handleHrDocFormChange = (e) => {
    const { name, value } = e.target;
    setHrDocForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleUploadOfficialDocument = async (e) => {
    e.preventDefault();
    if (!hrDocForm.fileName.trim()) {
      showToast('error', 'Please enter a document name');
      return;
    }
    if (!hrDocFile) {
      showToast('error', 'Please choose a file to upload');
      return;
    }

    const formData = new FormData();
    formData.append('file', hrDocFile);
    formData.append('employeeId', employeeId);
    formData.append('fileName', hrDocForm.fileName.trim());
    formData.append('documentType', hrDocForm.documentType);
    if (hrDocForm.documentCategory) formData.append('documentCategory', hrDocForm.documentCategory);
    if (hrDocForm.expiryDate) formData.append('expiryDate', hrDocForm.expiryDate);
    formData.append('visibility', hrDocForm.visibility);

    try {
      setUploadingHrDoc(true);
      await documentAPI.addCompanyDocument(formData);
      showToast('success', 'Official document issued');
      setHrDocForm({ fileName: '', documentType: 'Offer Letter', documentCategory: '', expiryDate: '', visibility: 'private' });
      setHrDocFile(null);
      fetchDocuments();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setUploadingHrDoc(false);
    }
  };

  const handleReviewRequest = async (request, status) => {
    try {
      await documentRequestAPI.updateRequest(request._id, { status });
      showToast('success', `Request ${status}`);
      fetchDocuments();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    }
  };

  const fetchAssets = useCallback(async () => {
    try {
      setLoadingAssets(true);
      const res = await assetAPI.getAssets({ employeeId });
      setAssets(res.data.assets || []);
    } catch (error) {
      console.error('Error loading assets:', error);
    } finally {
      setLoadingAssets(false);
    }
  }, [employeeId]);

  const fetchPayroll = useCallback(async () => {
    try {
      setLoadingPayroll(true);
      const [payslipsRes, expensesRes] = await Promise.all([
        payslipAPI.getPayslips({ employeeId }),
        expenseAPI.getExpenses({ employeeId })
      ]);
      setPayslips(payslipsRes.data.payslips || []);
      setLatestPayslip((payslipsRes.data.payslips || [])[0] || null);
      setExpenses(expensesRes.data.expenses || []);
    } catch (error) {
      console.error('Error loading payroll:', error);
    } finally {
      setLoadingPayroll(false);
    }
  }, [employeeId]);

  const fetchHierarchy = useCallback(async () => {
    try {
      setLoadingHierarchy(true);
      const [reportsRes, chainRes] = await Promise.all([
        hierarchyAPI.getDirectReports(employeeId),
        hierarchyAPI.getReportingChain(employeeId)
      ]);
      setDirectReports(reportsRes.data.directReports || []);
      setReportingChain(chainRes.data.chain || []);
    } catch (error) {
      console.error('Error loading reporting hierarchy:', error);
    } finally {
      setLoadingHierarchy(false);
    }
  }, [employeeId]);

  const fetchPerformance = useCallback(async () => {
    try {
      setLoadingPerformance(true);
      const res = await performanceAPI.getEmployeePerformance(employeeId);
      setPerformanceReviews(res.data.reviews || []);
    } catch (error) {
      console.error('Error loading performance reviews:', error);
    } finally {
      setLoadingPerformance(false);
    }
  }, [employeeId]);

  const fetchExit = useCallback(async () => {
    try {
      setLoadingExit(true);
      const res = await resignationAPI.getResignations({ employeeId });
      setResignations(res.data.resignations || []);
    } catch (error) {
      console.error('Error loading exit process:', error);
    } finally {
      setLoadingExit(false);
    }
  }, [employeeId]);

  // Dynamic per-tab loading: fetch a tab's data the first time it's opened,
  // then rely on `loadedTabs` so revisiting it doesn't refetch. Attendance is
  // handled by its own effect below since it also depends on the month/year
  // picker (which should always refetch, even if the tab was "loaded" before).
  useEffect(() => {
    if (!employeeId || activeTab === 'attendance' || activeTab === 'personal' || activeTab === 'employment') return;
    if (loadedTabs.has(activeTab)) return;

    const fetchers = {
      leave: fetchLeaves,
      documents: fetchDocuments,
      assets: fetchAssets,
      payroll: fetchPayroll,
      hierarchy: fetchHierarchy,
      performance: fetchPerformance,
      exit: fetchExit
    };

    const fetcher = fetchers[activeTab];
    if (!fetcher) return;

    fetcher().then(() => setLoadedTabs((prev) => new Set(prev).add(activeTab)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, employeeId]);

  const fetchAttendance = useCallback(async () => {
    try {
      setLoadingAttendance(true);
      const [attendanceRes, flexRes, correctionsRes] = await Promise.all([
        attendanceAPI.getAttendance({ employeeId, month: selectedMonth, year: selectedYear }),
        flexHoursAPI.getFlexHoursRequests({ employeeId }),
        attendanceAPI.getCorrectionRequests({ employeeId })
      ]);
      setAttendance(attendanceRes.data.attendance || []);
      setFlexRequests(flexRes.data.requests || []);
      setCorrections(correctionsRes.data.corrections || []);
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoadingAttendance(false);
    }
  }, [employeeId, selectedMonth, selectedYear]);

  useEffect(() => {
    if (activeTab !== 'attendance') return;
    fetchAttendance();
  }, [activeTab, fetchAttendance]);

  const toggleRowDetail = (key) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const rows = buildMonthAttendanceRows({
    dateOfJoining: employee?.dateOfJoining,
    attendance,
    leaves,
    month: selectedMonth,
    year: selectedYear
  });

  const appliedFlexByDate = flexRequests
    .filter((r) => r.status !== 'rejected')
    .reduce((acc, r) => {
      const key = new Date(r.date).toDateString();
      acc[key] = (acc[key] || 0) + r.hoursRequested;
      return acc;
    }, {});

  const { presentCount } = summarizeMonthRows(rows, appliedFlexByDate);
  const totalHours = attendance.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
  const { earnings: customEarnings, deductions: customDeductions } = splitCustomSalaryFields(employee?.customSalaryFields);

  // A payslip for the month still in progress was processed against attendance
  // as of that moment — absences since then wouldn't show up unless someone
  // reprocesses it. The attendance already loaded above for the selected month
  // lets us show the live LOP figure instead of the frozen one, as long as the
  // manager hasn't navigated the month picker away from the current month.
  const today = new Date();
  const isViewingCurrentMonth = selectedMonth === today.getMonth() + 1 && selectedYear === today.getFullYear();
  const latestIsOngoingMonth = !!latestPayslip && isViewingCurrentMonth
    && latestPayslip.month === selectedMonth && latestPayslip.year === selectedYear;
  const liveLopInfo = latestIsOngoingMonth ? computeLopBreakdown(rows, appliedFlexByDate) : null;
  const liveLopAmount = liveLopInfo && liveLopInfo.lopDays > 0
    ? Math.round((latestPayslip.earnings.basic / 30) * liveLopInfo.lopDays)
    : 0;
  const displayLopDays = latestIsOngoingMonth ? liveLopInfo.lopDays : (latestPayslip?.deductions.lopDays || 0);
  const displayLopAmount = latestIsOngoingMonth ? liveLopAmount : (latestPayslip?.deductions.lopAmount || 0);
  const lopAdjustment = latestPayslip ? displayLopAmount - latestPayslip.deductions.lopAmount : 0;
  const displayTotalDeductions = latestPayslip ? latestPayslip.totalDeductions + lopAdjustment : 0;
  const displayNetSalary = latestPayslip ? latestPayslip.netSalary - lopAdjustment : 0;

  const getReimbursementsFor = (month, year) =>
    expenses
      .filter((e) => {
        if (e.status !== 'approved' && e.status !== 'reimbursed') return false;
        const d = new Date(e.date);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      })
      .reduce((sum, e) => sum + e.amount, 0);

  const handleDownloadPayslip = (payslip) => {
    if (!employee) return;
    downloadPayslipPdf({
      payslip,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      designation: employee.designation,
      employeeIdStr: employee._id.slice(-6).toUpperCase(),
      reimbursement: getReimbursementsFor(payslip.month, payslip.year)
    });
  };

  const startEditLeaveBalance = () => {
    setLeaveBalanceForm({
      casual: employee?.casualLeaveBalance ?? 0,
      sick: employee?.sickLeaveBalance ?? 0,
      earned: employee?.earnedLeaveBalance ?? 0
    });
    setEditingLeaveBalance(true);
  };

  const cancelEditLeaveBalance = () => setEditingLeaveBalance(false);

  const saveLeaveBalance = async () => {
    try {
      setSavingLeaveBalance(true);
      const res = await userAPI.updateLeaveBalance(employeeId, {
        casualLeaveBalance: leaveBalanceForm.casual,
        sickLeaveBalance: leaveBalanceForm.sick,
        earnedLeaveBalance: leaveBalanceForm.earned
      });
      setEmployee((prev) => (prev ? { ...prev, ...res.data.user } : prev));
      setEditingLeaveBalance(false);
      showToast('success', 'Leave balance updated');
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setSavingLeaveBalance(false);
    }
  };

  const handleReviewFormChange = (e) => {
    const { name, value } = e.target;
    setReviewForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.reviewPeriod.trim()) {
      showToast('error', 'Please enter a review period');
      return;
    }
    try {
      setSavingReview(true);
      const res = await performanceAPI.createReview({
        employeeId,
        reviewPeriod: reviewForm.reviewPeriod.trim(),
        rating: Number(reviewForm.rating),
        strengths: reviewForm.strengths,
        areasForImprovement: reviewForm.areasForImprovement,
        goals: reviewForm.goals
      });
      setPerformanceReviews((prev) => [res.data.review, ...prev]);
      setShowReviewForm(false);
      setReviewForm({ reviewPeriod: '', rating: 3, strengths: '', areasForImprovement: '', goals: '' });
      showToast('success', 'Review added');
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setSavingReview(false);
    }
  };

  const sortedLeaves = [...leaves].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  const sortedCorrections = [...corrections].sort((a, b) => new Date(b.date) - new Date(a.date));
  const latestResignation = resignations[0] || null;

  if (!loadingEmployee && !employee) {
    return (
      <div className="manager-dashboard-page">
        <button type="button" className="profile-back-btn" onClick={() => navigate('/employees')}>
          ← Back to Employees
        </button>
        <p className="no-records">Employee not found</p>
      </div>
    );
  }

  return (
    <div className="manager-dashboard-page">
      <Toast message={message} />
      <div className="profile-header-row">
        <button type="button" className="profile-back-btn" onClick={() => navigate('/employees')}>
          ← Back to Employees
        </button>
      </div>

      <div className="profile-section-card">
        {loadingEmployee ? (
          <p className="loading-text">Loading...</p>
        ) : (
          <div className="detail-header">
            <div className="detail-avatar">
              {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
            </div>
            <div>
              <h2 className="detail-name">
                {employee.firstName} {employee.lastName}
                {employee._id === user._id ? ' (You)' : ''}
              </h2>
              <p className="detail-role">{employee.designation} · {employee.department}</p>
            </div>
            <span className={`role-badge ${employee.role}`}>{employee.role}</span>
            {employee.status && employee.status !== 'active' && (
              <span className="status-badge resigned">{employee.status === 'resigned' ? 'Resigned' : 'Inactive'}</span>
            )}
          </div>
        )}
      </div>

      {!loadingEmployee && (
        <>
          <div className="profile-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`profile-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'personal' && (
            <div className="profile-section-card">
              <h3 className="detail-section-title">Personal Information</h3>
              <div className="detail-grid">
                <div className="detail-field">
                  <p className="detail-label">Employee ID</p>
                  <p className="detail-value">{employee.employeeId || '—'}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Email</p>
                  <p className="detail-value">{employee.email}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Phone</p>
                  <p className="detail-value">{employee.phone || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'employment' && (
            <div className="profile-section-card">
              <h3 className="detail-section-title">Employment Information</h3>
              <div className="detail-grid">
                <div className="detail-field">
                  <p className="detail-label">Designation</p>
                  <p className="detail-value">{employee.designation || '—'}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Department</p>
                  <p className="detail-value">{employee.department || '—'}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Role</p>
                  <p className="detail-value">{employee.role || '—'}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Organization Level</p>
                  <p className="detail-value">{employee.organizationLevel || '—'}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Employment Type</p>
                  <p className="detail-value">{employee.employmentType || '—'}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Work Mode</p>
                  <p className="detail-value">{employee.workMode || '—'}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Date of Joining</p>
                  <p className="detail-value">
                    {employee.dateOfJoining ? formatDate(employee.dateOfJoining) : (employee.joiningDate ? formatDate(employee.joiningDate) : '—')}
                  </p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Status</p>
                  <p className="detail-value">{employee.status || '—'}</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'hierarchy' && (
            <div className="profile-section-card">
              <h3 className="detail-section-title">Reporting Hierarchy</h3>
              {loadingHierarchy ? (
                <p className="loading-text">Loading...</p>
              ) : (
                <>
                  <div className="detail-section">
                    <h4 className="detail-section-title" style={{ fontSize: '14px' }}>Reports to (chain to the top)</h4>
                    {reportingChain.length > 0 ? (
                      <div className="detail-list">
                        {reportingChain.map((superior) => (
                          <div key={superior._id} className="detail-list-row">
                            <div>
                              <p className="detail-list-title">{superior.firstName} {superior.lastName}</p>
                              <p className="detail-list-meta">{superior.designation}{superior.organizationLevel ? ` · ${superior.organizationLevel}` : ''}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="detail-list-empty">No reporting manager set</p>
                    )}
                  </div>
                  <div className="detail-section">
                    <h4 className="detail-section-title" style={{ fontSize: '14px' }}>Direct reports</h4>
                    {directReports.length > 0 ? (
                      <div className="detail-list">
                        {directReports.map((report) => (
                          <div key={report._id} className="detail-list-row">
                            <div>
                              <p className="detail-list-title">{report.firstName} {report.lastName}</p>
                              <p className="detail-list-meta">{report.designation}{report.organizationLevel ? ` · ${report.organizationLevel}` : ''}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="detail-list-empty">No direct reports</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <>
              <div className="profile-section-card">
                <h3 className="detail-section-title">Documents</h3>
                {loadingDocuments ? (
                  <p className="loading-text">Loading...</p>
                ) : documents.length > 0 ? (
                  <div className="detail-list">
                    {documents.map((doc) => (
                      <div key={doc._id} className="detail-list-row">
                        <div>
                          <p className="detail-list-title">{doc.fileName}</p>
                          <p className="detail-list-meta">
                            {doc.category === 'company' ? 'Official (HR)' : 'Personal'}
                            {doc.documentCategory ? ` · ${doc.documentCategory}` : ''} · {doc.documentType} · {formatDate(doc.uploadedDate)}
                          </p>
                          <div className="doc-badges">
                            <span className={`verify-badge ${doc.verificationStatus}`}>{doc.verificationStatus}</span>
                            {doc.expiryDate && isExpired(doc.expiryDate) && <span className="verify-badge rejected">Expired</span>}
                            {doc.expiryDate && !isExpired(doc.expiryDate) && isExpiringSoon(doc.expiryDate) && (
                              <span className="verify-badge pending">Expires {formatDate(doc.expiryDate)}</span>
                            )}
                            {doc.version > 1 && <span className="verify-badge verified">v{doc.version}</span>}
                          </div>
                        </div>
                        <div className="detail-list-actions">
                          <a
                            className="detail-download-link"
                            href={`${FILE_BASE_URL}${doc.fileUrl}`}
                            download={doc.fileName}
                            target="_blank"
                            rel="noreferrer"
                          >
                            ⬇
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="detail-list-empty">No documents uploaded yet</p>
                )}
              </div>

              {canManageOfficialDocuments(user) && (
                <div className="profile-section-card">
                  <h3 className="detail-section-title">Upload official document (HR/Admin)</h3>
                  <form onSubmit={handleUploadOfficialDocument} className="upload-form" noValidate>
                    <input
                      type="text"
                      name="fileName"
                      placeholder="Document name"
                      value={hrDocForm.fileName}
                      onChange={handleHrDocFormChange}
                    />
                    <select name="documentCategory" value={hrDocForm.documentCategory} onChange={handleHrDocFormChange}>
                      <option value="">Category</option>
                      {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select name="documentType" value={hrDocForm.documentType} onChange={handleHrDocFormChange}>
                      {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select name="visibility" value={hrDocForm.visibility} onChange={handleHrDocFormChange}>
                      <option value="private">Private (employee + HR/Admin)</option>
                      <option value="managers">Managers</option>
                      <option value="company">Company-wide</option>
                    </select>
                    <input
                      type="date"
                      name="expiryDate"
                      title="Expiry date (optional)"
                      value={hrDocForm.expiryDate}
                      onChange={handleHrDocFormChange}
                    />
                    <input
                      type="file"
                      onChange={(e) => setHrDocFile(e.target.files[0] || null)}
                    />
                    <button type="submit" className="upload-btn" disabled={uploadingHrDoc}>
                      {uploadingHrDoc ? 'Uploading...' : '⬆ Issue document'}
                    </button>
                  </form>
                </div>
              )}

              {canManageOfficialDocuments(user) && documentRequests.some((r) => r.status === 'pending') && (
                <div className="profile-section-card">
                  <h3 className="detail-section-title">Pending document requests</h3>
                  <div className="detail-list">
                    {documentRequests.filter((r) => r.status === 'pending').map((r) => (
                      <div key={r._id} className="detail-list-row">
                        <div>
                          <p className="detail-list-title">{r.documentType}</p>
                          <p className="detail-list-meta">{r.documentCategory} · {formatDate(r.createdAt)}{r.reason ? ` · ${r.reason}` : ''}</p>
                        </div>
                        <div className="detail-list-actions">
                          <button type="button" className="modal-submit-btn" onClick={() => handleReviewRequest(r, 'approved')}>Approve</button>
                          <button type="button" className="modal-cancel-btn" onClick={() => handleReviewRequest(r, 'rejected')}>Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'attendance' && (
            <>
              <div className="profile-section-card">
                <div className="detail-section-header">
                  <h3 className="detail-section-title">Attendance</h3>
                  <div className="month-selector">
                    <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}>
                      {MONTH_NAMES.map((m, idx) => (
                        <option key={m} value={idx + 1}>{m}</option>
                      ))}
                    </select>
                    <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}>
                      {YEARS.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {!loadingAttendance && attendance.length > 0 && (
                  <div className="history-summary">
                    <span><strong>{totalHours.toFixed(2)}</strong> hrs total</span>
                    <span><strong>{presentCount}</strong> days present</span>
                  </div>
                )}

                {loadingAttendance ? (
                  <p className="loading-text">Loading attendance...</p>
                ) : rows.length > 0 ? (
                  <div className="table-wrapper">
                    <table className="attendance-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Status</th>
                          <th>Check-in</th>
                          <th>Check-out</th>
                          <th>Working Hours</th>
                          <th>Flex Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => {
                          if (row.kind === 'holiday') {
                            return (
                              <tr key={`holiday-${row.date.toISOString()}`} className="attendance-table-row">
                                <td><p className="date-label">{formatDate(row.date)}</p></td>
                                <td><span className="status-badge holiday">Holiday</span></td>
                                <td>-</td>
                                <td>-</td>
                                <td>-</td>
                                <td>-</td>
                              </tr>
                            );
                          }

                          if (row.kind === 'absent') {
                            return (
                              <tr key={`absent-${row.date.toISOString()}`} className="attendance-table-row">
                                <td><p className="date-label">{formatDate(row.date)}</p></td>
                                <td><span className="status-badge absent">Absent</span></td>
                                <td>-</td>
                                <td>-</td>
                                <td>-</td>
                                <td>-</td>
                              </tr>
                            );
                          }

                          if (row.kind === 'leave') {
                            const status = row.day.paid
                              ? { label: 'Leave', className: 'leave' }
                              : { label: 'Absent', className: 'absent' };
                            return (
                              <tr key={`leave-${row.day.leaveId}-${row.date.toISOString()}`} className="attendance-table-row">
                                <td><p className="date-label">{formatDate(row.date)}</p></td>
                                <td><span className={`status-badge ${status.className}`}>{status.label}</span></td>
                                <td>-</td>
                                <td>-</td>
                                <td>-</td>
                                <td>-</td>
                              </tr>
                            );
                          }

                          const record = row.record;
                          const hours = record.hoursWorked || 0;
                          const dayCap = row.date.getDay() === 6 ? 5 : 9;
                          const workingHours = Math.min(hours, dayCap);
                          const flexHours = Math.max(hours - dayCap, 0);
                          const appliedFlex = appliedFlexByDate[row.date.toDateString()] || 0;
                          const status = getDayStatus(record, row.date, appliedFlex);
                          const flexParts = [];
                          if (flexHours > 0) flexParts.push(`+${flexHours.toFixed(2)} earned`);
                          if (appliedFlex > 0) flexParts.push(`+${appliedFlex.toFixed(2)} applied`);

                          return (
                            <React.Fragment key={record._id}>
                              <tr className="attendance-table-row">
                                <td>
                                  <p className="date-label">{formatDate(row.date)}</p>
                                  <p className="work-mode">{record.workMode}</p>
                                </td>
                                <td>
                                  <div className="status-cell">
                                    <span className={`status-badge ${status.className}`}>{status.label}</span>
                                    {status.detail && (
                                      <button
                                        type="button"
                                        className="status-info-btn"
                                        onClick={() => toggleRowDetail(record._id)}
                                        aria-label="View calculation"
                                      >
                                        i
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td>{record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</td>
                                <td>{record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</td>
                                <td>{workingHours.toFixed(2)} hrs</td>
                                <td>{flexParts.length > 0 ? flexParts.join(', ') : '-'}</td>
                              </tr>
                              {expandedRows.has(record._id) && (
                                <tr className="detail-breakdown-row">
                                  <td colSpan={6}>
                                    <div className="detail-breakdown">
                                      {status.detail && <p className="status-detail">{status.detail}</p>}
                                      {record.sessions && record.sessions.length > 1 && (
                                        <div className="session-breakdown">
                                          {record.sessions.map((s, idx) => (
                                            <div key={idx} className="session-row">
                                              <span className="session-label">Session {idx + 1}</span>
                                              {s.workMode && <span className="session-mode">{s.workMode}</span>}
                                              <span className="session-time">
                                                {s.checkInTime ? new Date(s.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                                                {' – '}
                                                {s.checkOutTime ? new Date(s.checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'ongoing'}
                                              </span>
                                              {s.reason && <span className="session-reason">{s.reason}</span>}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="no-records">No attendance records for this month</p>
                )}
              </div>

              <div className="profile-section-card">
                <h3 className="detail-section-title">Correction requests</h3>
                {loadingAttendance ? (
                  <p className="loading-text">Loading...</p>
                ) : sortedCorrections.length > 0 ? (
                  <div className="detail-list">
                    {sortedCorrections.map((correction) => (
                      <div key={correction._id} className="detail-list-row">
                        <div>
                          <p className="detail-list-title">{formatDate(correction.date)}</p>
                          <p className="detail-list-meta">
                            {correction.reason}
                            {(correction.requestedCheckInTime || correction.requestedCheckOutTime) && (
                              <>
                                {' · '}
                                {correction.requestedCheckInTime ? new Date(correction.requestedCheckInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                                {' – '}
                                {correction.requestedCheckOutTime ? new Date(correction.requestedCheckOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                              </>
                            )}
                          </p>
                        </div>
                        <span className={`status-badge ${correction.status}`}>{correction.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="detail-list-empty">No correction requests yet</p>
                )}
              </div>
            </>
          )}

          {activeTab === 'leave' && (
            <>
              <div className="profile-section-card">
                <div className="detail-section-header">
                  <h3 className="detail-section-title">Leave balance</h3>
                  {!editingLeaveBalance && (
                    <button type="button" className="add-field-btn" onClick={startEditLeaveBalance}>
                      Edit
                    </button>
                  )}
                </div>
                {editingLeaveBalance ? (
                  <>
                    <div className="structure-form">
                      <div className="structure-group">
                        <label>Casual</label>
                        <input
                          type="number"
                          min="0"
                          value={leaveBalanceForm.casual}
                          onChange={(e) => setLeaveBalanceForm((prev) => ({ ...prev, casual: e.target.value }))}
                        />
                      </div>
                      <div className="structure-group">
                        <label>Sick</label>
                        <input
                          type="number"
                          min="0"
                          value={leaveBalanceForm.sick}
                          onChange={(e) => setLeaveBalanceForm((prev) => ({ ...prev, sick: e.target.value }))}
                        />
                      </div>
                      <div className="structure-group">
                        <label>Earned</label>
                        <input
                          type="number"
                          min="0"
                          value={leaveBalanceForm.earned}
                          onChange={(e) => setLeaveBalanceForm((prev) => ({ ...prev, earned: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="modal-actions">
                      <button type="button" className="modal-cancel-btn" onClick={cancelEditLeaveBalance} disabled={savingLeaveBalance}>
                        Cancel
                      </button>
                      <button type="button" className="modal-submit-btn" onClick={saveLeaveBalance} disabled={savingLeaveBalance}>
                        {savingLeaveBalance ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="detail-grid">
                    <div className="detail-field">
                      <p className="detail-label">Casual</p>
                      <p className="detail-value">{employee.casualLeaveBalance ?? '—'}</p>
                    </div>
                    <div className="detail-field">
                      <p className="detail-label">Sick</p>
                      <p className="detail-value">{employee.sickLeaveBalance ?? '—'}</p>
                    </div>
                    <div className="detail-field">
                      <p className="detail-label">Earned</p>
                      <p className="detail-value">{employee.earnedLeaveBalance ?? '—'}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="profile-section-card">
                <h3 className="detail-section-title">Leave requests</h3>
                {loadingLeaves ? (
                  <p className="loading-text">Loading...</p>
                ) : sortedLeaves.length > 0 ? (
                  <div className="detail-list">
                    {sortedLeaves.map((leave) => (
                      <div key={leave._id} className="detail-list-row">
                        <div>
                          <p className="detail-list-title">{leave.leaveType} Leave</p>
                          <p className="detail-list-meta">
                            {formatDate(leave.startDate)} – {formatDate(leave.endDate)} · {leave.numberOfDays} day{leave.numberOfDays !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <span className={`status-badge ${leave.status}`}>{leave.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="detail-list-empty">No leave requests yet</p>
                )}
              </div>
            </>
          )}

          {activeTab === 'payroll' && (
            <>
              <div className="profile-section-card">
                <div className="detail-section-header">
                  <h3 className="detail-section-title">Salary</h3>
                  <button type="button" className="add-field-btn" onClick={() => navigate(`/payroll?employeeId=${employeeId}`)}>
                    View full calculation in Payroll →
                  </button>
                </div>
                {loadingPayroll ? (
                  <p className="loading-text">Loading...</p>
                ) : latestPayslip ? (
                  <>
                    <div className="net-pay-card">
                      <div>
                        <p className="net-pay-label">Net pay · {MONTH_NAMES[latestPayslip.month - 1]} {latestPayslip.year}</p>
                        <h2 className="net-pay-value">{formatCurrency(displayNetSalary)}</h2>
                      </div>
                      <div>
                        <p className="net-pay-label">Status</p>
                        <span className={`status-badge ${latestPayslip.paymentStatus === 'paid' ? 'paid' : 'processing'}`}>
                          {latestPayslip.paymentStatus === 'paid' ? 'Paid' : 'Processing'}
                        </span>
                      </div>
                    </div>
                    <div className="breakdown-grid">
                      <div className="breakdown-card">
                        <h3 className="breakdown-title">Earnings</h3>
                        <div className="breakdown-row">
                          <span>Basic</span>
                          <span>{formatCurrency(latestPayslip.earnings?.basic)}</span>
                        </div>
                        <div className="breakdown-row">
                          <span>HRA</span>
                          <span>{formatCurrency(latestPayslip.earnings?.hra)}</span>
                        </div>
                        <div className="breakdown-row">
                          <span>Special Allowance</span>
                          <span>{formatCurrency(latestPayslip.earnings?.specialAllowance)}</span>
                        </div>
                        {(latestPayslip.earnings?.custom || []).map((f) => (
                          <div className="breakdown-row" key={f.name}>
                            <span>{f.name}</span>
                            <span>{formatCurrency(f.value)}</span>
                          </div>
                        ))}
                        <div className="breakdown-row total-row">
                          <span>Gross Earnings</span>
                          <span>{formatCurrency(latestPayslip.grossSalary)}</span>
                        </div>
                      </div>
                      <div className="breakdown-card">
                        <h3 className="breakdown-title">Deductions</h3>
                        <div className="breakdown-row">
                          <span>PF (12% of basic)</span>
                          <span className="negative">-{formatCurrency(latestPayslip.deductions?.pf)}</span>
                        </div>
                        <div className="breakdown-row">
                          <span>Professional Tax</span>
                          <span className="negative">-{formatCurrency(latestPayslip.deductions?.professionalTax)}</span>
                        </div>
                        <div className="breakdown-row">
                          <span>TDS</span>
                          <span className="negative">-{formatCurrency(latestPayslip.deductions?.tds)}</span>
                        </div>
                        <div className="breakdown-row">
                          <span>LOP ({displayLopDays} days)</span>
                          <span className="negative">-{formatCurrency(displayLopAmount)}</span>
                        </div>
                        {(latestPayslip.deductions?.custom || []).map((f) => (
                          <div className="breakdown-row" key={f.name}>
                            <span>{f.name}</span>
                            <span className="negative">-{formatCurrency(f.value)}</span>
                          </div>
                        ))}
                        <div className="breakdown-row total-row">
                          <span>Total deductions</span>
                          <span className="negative">-{formatCurrency(displayTotalDeductions)}</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="detail-list-empty">No payslips generated yet</p>
                    {employee?.salaryStructure && (
                      <div className="detail-grid">
                        <div className="detail-field">
                          <p className="detail-label">Basic</p>
                          <p className="detail-value">{formatCurrency(employee.salaryStructure.basic)}</p>
                        </div>
                        <div className="detail-field">
                          <p className="detail-label">HRA</p>
                          <p className="detail-value">{formatCurrency(employee.salaryStructure.hra)}</p>
                        </div>
                        <div className="detail-field">
                          <p className="detail-label">Special Allowance</p>
                          <p className="detail-value">{formatCurrency(employee.salaryStructure.specialAllowance)}</p>
                        </div>
                        {customEarnings.map((f) => (
                          <div className="detail-field" key={f.name}>
                            <p className="detail-label">{f.name}</p>
                            <p className="detail-value">{formatCurrency(f.value)}</p>
                          </div>
                        ))}
                        <div className="detail-field">
                          <p className="detail-label">Professional Tax</p>
                          <p className="detail-value">{formatCurrency(employee.salaryStructure.professionalTax)}</p>
                        </div>
                        <div className="detail-field">
                          <p className="detail-label">TDS</p>
                          <p className="detail-value">{formatCurrency(employee.salaryStructure.tds)}</p>
                        </div>
                        {customDeductions.map((f) => (
                          <div className="detail-field" key={f.name}>
                            <p className="detail-label">{f.name}</p>
                            <p className="detail-value">{formatCurrency(f.value)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {!loadingPayroll && payslips.length > 0 && (
                <div className="profile-section-card history-card">
                  <h3 className="breakdown-title">Salary history</h3>
                  <div className="table-wrapper">
                    <table className="salary-table">
                      <thead>
                        <tr>
                          <th>Month</th>
                          <th>Gross Salary</th>
                          <th>Deductions</th>
                          <th>Reimbursements</th>
                          <th>Net Pay</th>
                          <th>Status</th>
                          <th>Payslip</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payslips.map((p) => {
                          const reimbursement = getReimbursementsFor(p.month, p.year);
                          const status = getStatusLabel(p.paymentStatus);
                          const isOngoing = p._id === latestPayslip?._id && latestIsOngoingMonth;
                          const rowTotalDeductions = isOngoing ? displayTotalDeductions : p.totalDeductions;
                          const rowNetSalary = isOngoing ? displayNetSalary : p.netSalary;

                          return (
                            <tr key={p._id}>
                              <td>{MONTH_NAMES[p.month - 1]} {p.year}</td>
                              <td>{formatCurrency(p.grossSalary)}</td>
                              <td className="negative">-{formatCurrency(rowTotalDeductions)}</td>
                              <td>{reimbursement > 0 ? formatCurrency(reimbursement) : '-'}</td>
                              <td className="net-cell">{formatCurrency(rowNetSalary + reimbursement)}</td>
                              <td>
                                {status && <span className={`status-badge ${status.className}`}>{status.label}</span>}
                              </td>
                              <td>
                                <button className="history-download-btn" onClick={() => handleDownloadPayslip(p)}>
                                  ⬇ Download
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="profile-section-card">
                <h3 className="detail-section-title">Reimbursement claims</h3>
                {loadingPayroll ? (
                  <p className="loading-text">Loading...</p>
                ) : expenses.length > 0 ? (
                  <div className="detail-list">
                    {[...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).map((expense) => (
                      <div key={expense._id} className="detail-list-row">
                        <div>
                          <p className="detail-list-title">{expense.expenseType} · {formatCurrency(expense.amount)}</p>
                          <p className="detail-list-meta">{formatDate(expense.date)}{expense.description ? ` · ${expense.description}` : ''}</p>
                        </div>
                        <span className={`status-badge ${expense.status}`}>{expense.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="detail-list-empty">No reimbursement claims yet</p>
                )}
              </div>
            </>
          )}

          {activeTab === 'assets' && (
            <div className="profile-section-card">
              <h3 className="detail-section-title">Assets</h3>
              {loadingAssets ? (
                <p className="loading-text">Loading...</p>
              ) : assets.length > 0 ? (
                <div className="detail-list">
                  {assets.map((asset) => (
                    <div key={asset._id} className="detail-list-row">
                      <div>
                        <p className="detail-list-title">{asset.itemName}</p>
                        <p className="detail-list-meta">
                          {asset.serialNumber && `${asset.serialNumber} · `}
                          assigned {formatDate(asset.assignedDate)}
                          {asset.status === 'returned' && asset.returnedDate && ` · returned ${formatDate(asset.returnedDate)}`}
                        </p>
                      </div>
                      <span className={`status-badge ${asset.status}`}>
                        {asset.status === 'active' ? 'Active' : 'Returned'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="detail-list-empty">No assets assigned yet</p>
              )}
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="profile-section-card">
              <div className="detail-section-header">
                <h3 className="detail-section-title">Performance</h3>
                {canManagePerformance(user) && !showReviewForm && (
                  <button type="button" className="add-field-btn" onClick={() => setShowReviewForm(true)}>
                    + Add review
                  </button>
                )}
              </div>

              {showReviewForm && (
                <form onSubmit={handleSubmitReview} className="modal-form" noValidate style={{ marginBottom: '1rem' }}>
                  <div className="modal-row">
                    <div className="modal-group">
                      <label>Review period</label>
                      <input type="text" name="reviewPeriod" placeholder="e.g. 2026 Q2" value={reviewForm.reviewPeriod} onChange={handleReviewFormChange} />
                    </div>
                    <div className="modal-group">
                      <label>Rating (1-5)</label>
                      <select name="rating" value={reviewForm.rating} onChange={handleReviewFormChange}>
                        {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="modal-group">
                    <label>Strengths</label>
                    <input type="text" name="strengths" value={reviewForm.strengths} onChange={handleReviewFormChange} />
                  </div>
                  <div className="modal-group">
                    <label>Areas for improvement</label>
                    <input type="text" name="areasForImprovement" value={reviewForm.areasForImprovement} onChange={handleReviewFormChange} />
                  </div>
                  <div className="modal-group">
                    <label>Goals</label>
                    <input type="text" name="goals" value={reviewForm.goals} onChange={handleReviewFormChange} />
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="modal-cancel-btn" onClick={() => setShowReviewForm(false)} disabled={savingReview}>
                      Cancel
                    </button>
                    <button type="submit" className="modal-submit-btn" disabled={savingReview}>
                      {savingReview ? 'Saving...' : 'Save review'}
                    </button>
                  </div>
                </form>
              )}

              {loadingPerformance ? (
                <p className="loading-text">Loading...</p>
              ) : performanceReviews.length > 0 ? (
                <div className="detail-list">
                  {performanceReviews.map((review) => (
                    <div key={review._id} className="detail-list-row">
                      <div>
                        <p className="detail-list-title">{review.reviewPeriod} · Rating {review.rating}/5</p>
                        <p className="detail-list-meta">
                          {review.strengths && `Strengths: ${review.strengths}`}
                          {review.areasForImprovement && ` · Improve: ${review.areasForImprovement}`}
                          {review.goals && ` · Goals: ${review.goals}`}
                        </p>
                        <p className="detail-list-meta">
                          Reviewed by {review.reviewedBy?.firstName} {review.reviewedBy?.lastName} · {formatDate(review.createdAt)}
                        </p>
                      </div>
                      <span className={`status-badge ${review.status}`}>{review.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="detail-list-empty">No performance reviews yet</p>
              )}
            </div>
          )}

          {activeTab === 'exit' && (
            <div className="profile-section-card">
              <h3 className="detail-section-title">Exit Process</h3>
              {loadingExit ? (
                <p className="loading-text">Loading...</p>
              ) : latestResignation ? (
                <>
                  <div className="detail-grid">
                    <div className="detail-field">
                      <p className="detail-label">Status</p>
                      <p className="detail-value"><span className={`status-badge ${latestResignation.status}`}>{latestResignation.status}</span></p>
                    </div>
                    <div className="detail-field">
                      <p className="detail-label">Last working day</p>
                      <p className="detail-value">{formatDate(latestResignation.lastWorkingDay)}</p>
                    </div>
                    <div className="detail-field">
                      <p className="detail-label">Reason</p>
                      <p className="detail-value">{latestResignation.reason || '—'}</p>
                    </div>
                  </div>
                  <div className="detail-section">
                    <h4 className="detail-section-title" style={{ fontSize: '14px' }}>Clearance</h4>
                    <div className="detail-grid">
                      <div className="detail-field">
                        <p className="detail-label">IT</p>
                        <p className="detail-value">{latestResignation.clearance?.it ? 'Cleared' : 'Pending'}</p>
                      </div>
                      <div className="detail-field">
                        <p className="detail-label">Finance</p>
                        <p className="detail-value">{latestResignation.clearance?.finance ? 'Cleared' : 'Pending'}</p>
                      </div>
                      <div className="detail-field">
                        <p className="detail-label">HR</p>
                        <p className="detail-value">{latestResignation.clearance?.hr ? 'Cleared' : 'Pending'}</p>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="detail-list-empty">No exit process initiated</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default EmployeeProfile;
