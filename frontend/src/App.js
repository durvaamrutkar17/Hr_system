import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Leave from './pages/Leave';
import Announcements from './pages/Announcements';
import Salary from './pages/Salary';
import SalaryDetail from './pages/SalaryDetail';
import Attendance from './pages/Attendance';
import Reimbursement from './pages/Reimbursement';
import Documents from './pages/Documents';
import MyAssets from './pages/MyAssets';
import Holidays from './pages/Holidays';
import Resignation from './pages/Resignation';
import ManagerDashboard from './pages/ManagerDashboard';
import Employees from './pages/Employees';
import EmployeeProfile from './pages/EmployeeProfile';
import TeamAttendance from './pages/TeamAttendance';
import LeaveApprovals from './pages/LeaveApprovals';
import CorrectionApprovals from './pages/CorrectionApprovals';
import Payroll from './pages/Payroll';
import PostAnnouncements from './pages/PostAnnouncements';
import AssetTracker from './pages/AssetTracker';
import ResignationApprovals from './pages/ResignationApprovals';
import './App.css';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return user ? children : <Navigate to="/login" />;
};

const AppContent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('viewMode') || 'me');

  const isReviewer = user?.role === 'manager' || user?.role === 'admin';
  const effectiveViewMode = isReviewer ? viewMode : 'me';

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // The sidebar's menu items switch immediately based on viewMode, but route
  // guards for manager-only pages key off the account's actual role (which
  // doesn't change) — so without this, switching to "Me" while on a
  // manager-only page left the sidebar and the page content out of sync.
  // Landing on the dashboard for the new mode keeps them consistent.
  const changeViewMode = (mode) => {
    setViewMode(mode);
    localStorage.setItem('viewMode', mode);
    navigate('/dashboard');
  };

  useEffect(() => {
    // Close sidebar on larger screens
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <>
      {user ? (
        <div className="app-layout">
          <Header onToggleSidebar={toggleSidebar} viewMode={effectiveViewMode} onChangeViewMode={changeViewMode} />
          <div className="app-container">
            <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} viewMode={effectiveViewMode} />
            <main className="main-content">
              <Routes>
                <Route path="/dashboard" element={effectiveViewMode === 'mgr' ? <ManagerDashboard /> : <Dashboard />} />
                <Route path="/employees" element={isReviewer ? <Employees /> : <Navigate to="/dashboard" />} />
                <Route path="/employees/:employeeId" element={isReviewer ? <EmployeeProfile /> : <Navigate to="/dashboard" />} />
                <Route path="/leave" element={<Leave />} />
                <Route path="/announcements" element={<Announcements />} />
                <Route path="/salary" element={<Salary />} />
                <Route path="/salary/:month/:year" element={<SalaryDetail />} />
                <Route path="/attendance" element={<Attendance />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/my-assets" element={<MyAssets />} />
                <Route path="/holidays" element={<Holidays viewMode={effectiveViewMode} />} />
                <Route path="/reimbursement" element={<Reimbursement />} />
                <Route path="/exit" element={<Resignation />} />
                <Route path="/team-attendance" element={isReviewer ? <TeamAttendance /> : <Navigate to="/dashboard" />} />
                <Route path="/leave-approvals" element={isReviewer ? <LeaveApprovals /> : <Navigate to="/dashboard" />} />
                <Route path="/correction-approvals" element={isReviewer ? <CorrectionApprovals /> : <Navigate to="/dashboard" />} />
                <Route path="/payroll" element={isReviewer ? <Payroll /> : <Navigate to="/dashboard" />} />
                <Route path="/post-announcements" element={isReviewer ? <PostAnnouncements /> : <Navigate to="/dashboard" />} />
                <Route path="/asset-tracker" element={isReviewer ? <AssetTracker /> : <Navigate to="/dashboard" />} />
                <Route path="/resignation-approvals" element={isReviewer ? <ResignationApprovals /> : <Navigate to="/dashboard" />} />
                <Route path="/" element={<Navigate to="/dashboard" />} />
              </Routes>
            </main>
          </div>
        </div>
      ) : (
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      )}
    </>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
