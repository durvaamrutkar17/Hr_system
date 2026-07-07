import React from 'react';
import './Sidebar.css';
import { FiLogOut, FiClock, FiSun, FiUsers, FiCheckCircle, FiClipboard, FiDollarSign, FiRadio, FiMonitor, FiUserX } from 'react-icons/fi';
import { MdDashboard } from 'react-icons/md';
import { AiOutlineCalendar, AiOutlineFile, AiOutlineDollar } from 'react-icons/ai';
import { BiNote } from 'react-icons/bi';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation, Link } from 'react-router-dom';

const employeeMenuItems = [
  { icon: <MdDashboard />, label: 'Dashboard', path: '/dashboard' },
  { icon: <FiClock />, label: 'Attendance', path: '/attendance' },
  { icon: <FiSun />, label: 'Leave', path: '/leave' },
  { icon: <AiOutlineDollar />, label: 'Salary', path: '/salary' },
  { icon: <AiOutlineFile />, label: 'Documents', path: '/documents' },
  { icon: <AiOutlineCalendar />, label: 'Holidays', path: '/holidays' },
  { icon: <AiOutlineFile />, label: 'Reimbursement', path: '/reimbursement' },
  { icon: <BiNote />, label: 'Announcements', path: '/announcements' },
  { icon: <FiMonitor />, label: 'My Assets', path: '/my-assets' },
  { icon: <AiOutlineFile />, label: 'Exit / Resignation', path: '/exit' }
];

const managerMenuItems = [
  { icon: <MdDashboard />, label: 'Dashboard', path: '/dashboard' },
  { icon: <FiUsers />, label: 'Team Attendance', path: '/team-attendance' },
  { icon: <FiCheckCircle />, label: 'Leave Approvals', path: '/leave-approvals' },
  { icon: <FiClipboard />, label: 'Correction Approvals', path: '/correction-approvals' },
  { icon: <FiDollarSign />, label: 'Payroll', path: '/payroll' },
  { icon: <FiRadio />, label: 'Post Announcements', path: '/post-announcements' },
  { icon: <FiMonitor />, label: 'Asset Tracker', path: '/asset-tracker' },
  { icon: <FiUserX />, label: 'Resignation Approvals', path: '/resignation-approvals' }
];

const Sidebar = ({ isOpen, toggleSidebar, viewMode }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isReviewer = user?.role === 'manager' || user?.role === 'admin';
  const menuItems = isReviewer && viewMode === 'mgr' ? managerMenuItems : employeeMenuItems;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <h3>HealthismPlus</h3>
      </div>
      <nav className="sidebar-nav">
        {menuItems.map((item, index) => (
          <Link
            key={index}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
            onClick={() => {
              if (window.innerWidth <= 768) toggleSidebar();
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button onClick={handleLogout} className="logout-btn">
          <FiLogOut />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
