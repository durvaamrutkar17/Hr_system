import React from 'react';
import { useAuth } from '../context/AuthContext';
import { isReviewer as isReviewerPermission } from '../permissions/permissions';
import './Header.css';
import { FiMenu } from 'react-icons/fi';

const Header = ({ onToggleSidebar, viewMode, onChangeViewMode }) => {
  const { user } = useAuth();
  // Old inline check (kept for reference): const isReviewer = user?.role === 'manager' || user?.role === 'admin';
  const isReviewer = isReviewerPermission(user);

  return (
    <header className="header">
      <div className="header-left">
        <button className="menu-toggle" onClick={onToggleSidebar}>
          <FiMenu />
        </button>
        <div className="header-title">
          <h2>HealthismPlus</h2>
          <p>HR Portal</p>
        </div>
      </div>
      <div className="header-right">
        {user && (
          <div className="user-info">
            <div className="user-avatar">
              {user.firstName?.charAt(0)}{user.lastName?.charAt(0)}
            </div>
            <div className="user-details">
              <p className="user-name">{user.firstName} {user.lastName}</p>
              <p className="user-role">{user.designation}</p>
            </div>
          </div>
        )}
        {isReviewer && (
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'me' ? 'active' : ''}`}
              onClick={() => onChangeViewMode('me')}
            >
              Me
            </button>
            <button
              className={`toggle-btn ${viewMode === 'mgr' ? 'active' : ''}`}
              onClick={() => onChangeViewMode('mgr')}
            >
              Mgr
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
