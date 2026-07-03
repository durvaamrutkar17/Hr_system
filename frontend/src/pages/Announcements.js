import React, { useState, useEffect } from 'react';
import { announcementAPI } from '../services/api';
import './Announcements.css';

const Announcements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const response = await announcementAPI.getAnnouncements();
      setAnnouncements(response.data.announcements || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="announcements-page">
      <div className="page-header">
        <h1>Announcements</h1>
      </div>

      <div className="announcements-container">
        {loading ? (
          <p>Loading announcements...</p>
        ) : announcements.length > 0 ? (
          announcements.map((announcement) => (
            <div key={announcement._id} className="announcement-card">
              <div className="announcement-badge" style={{
                backgroundColor: announcement.priority === 'high' ? '#e74c3c' : 
                                announcement.priority === 'medium' ? '#f39c12' : '#3498db'
              }}>
                {announcement.priority}
              </div>
              <h2>{announcement.title}</h2>
              <p className="announcement-content">{announcement.content}</p>
              <div className="announcement-meta">
                <span className="category">{announcement.category}</span>
                <span className="date">
                  {new Date(announcement.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="no-announcements">
            <p>No announcements available</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Announcements;
