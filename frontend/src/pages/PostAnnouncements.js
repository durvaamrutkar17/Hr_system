import React, { useState, useEffect } from 'react';
import { announcementAPI } from '../services/api';
import './PostAnnouncements.css';

const PostAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await announcementAPI.getAnnouncements();
      setAnnouncements(response.data.announcements || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async (e) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }
    if (!content.trim()) {
      alert('Please enter a message');
      return;
    }

    try {
      setPosting(true);
      await announcementAPI.createAnnouncement({
        title: title.trim(),
        content: content.trim(),
        category: 'General',
        visibility: 'all',
        priority: 'medium'
      });
      alert('✅ Announcement posted to all staff');
      setTitle('');
      setContent('');
      fetchAnnouncements();
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="post-announcements-page">
      <p className="eyebrow">Broadcast</p>
      <h1 className="page-title">Post Announcement</h1>

      <div className="compose-card">
        <form onSubmit={handlePost} className="compose-form">
          <input
            type="text"
            className="title-input"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="message-input"
            placeholder="Message to the whole team..."
            rows="4"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
          <button type="submit" className="post-btn" disabled={posting}>
            📢 {posting ? 'Posting...' : 'Post to all staff'}
          </button>
        </form>
      </div>

      <div className="posted-card">
        <h2 className="section-title">Posted</h2>
        {loading ? (
          <p className="loading-text">Loading...</p>
        ) : announcements.length > 0 ? (
          <div className="posted-list">
            {announcements.map((a) => (
              <div key={a._id} className="posted-row">
                <p className="posted-title">{a.title}</p>
                <p className="posted-date">
                  {new Date(a.createdAt).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-records">No announcements posted yet</p>
        )}
      </div>
    </div>
  );
};

export default PostAnnouncements;
