import React, { useState, useEffect } from 'react';
import { holidayAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import './Holidays.css';

const formatDay = (date) =>
  new Date(date).toLocaleDateString('en-US', { weekday: 'long' });

const emptyForm = { name: '', date: '', type: 'National', description: '', isOptional: false };

const Holidays = ({ viewMode }) => {
  const { user } = useAuth();
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [confirmState, setConfirmState] = useState(null);
  const { message, showToast } = useToast();

  const isReviewer = user?.role === 'manager' || user?.role === 'admin';
  const canManage = isReviewer && viewMode === 'mgr';

  useEffect(() => {
    fetchHolidays();
  }, []);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const response = await holidayAPI.getHolidays();
      setHolidays(response.data.holidays || []);
    } catch (error) {
      console.error('Error fetching holidays:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      showToast('error', 'Please enter a holiday name');
      return;
    }
    if (!form.date) {
      showToast('error', 'Please select a date');
      return;
    }

    try {
      setSaving(true);
      await holidayAPI.createHoliday({
        name: form.name.trim(),
        date: form.date,
        type: form.type,
        description: form.description.trim(),
        isOptional: form.isOptional
      });
      showToast('success', 'Holiday added');
      setForm(emptyForm);
      fetchHolidays();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (holiday) => {
    setConfirmState({
      message: `Remove "${holiday.name}"?`,
      confirmLabel: 'Remove',
      onConfirm: () => performDelete(holiday)
    });
  };

  const performDelete = async (holiday) => {
    setConfirmState(null);
    try {
      await holidayAPI.deleteHoliday(holiday._id);
      showToast('success', 'Holiday removed');
      fetchHolidays();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingHolidays = holidays.filter((h) => new Date(h.date) >= today);
  const pastHolidays = holidays.filter((h) => new Date(h.date) < today);

  const renderRow = (holiday) => {
    const isPast = new Date(holiday.date) < today;
    return (
      <div key={holiday._id} className={`holiday-row ${isPast ? 'past' : ''}`}>
        <div className="holiday-date-block">
          <span className="holiday-day-num">{new Date(holiday.date).getDate()}</span>
          <span className="holiday-month">
            {new Date(holiday.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
          </span>
        </div>
        <div className="holiday-main">
          <p className="holiday-name">{holiday.name}</p>
          <p className="holiday-weekday">{formatDay(holiday.date)}</p>
          {holiday.description && holiday.description !== holiday.name && (
            <p className="holiday-desc">{holiday.description}</p>
          )}
        </div>
        <span className={`type-badge ${holiday.type?.toLowerCase()}`}>{holiday.type}</span>
        {holiday.isOptional && <span className="optional-badge">Optional</span>}
        {canManage && (
          <button type="button" className="remove-link" onClick={() => handleDelete(holiday)}>
            ✕ Remove
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="holidays-page">
      <p className="eyebrow">Calendar</p>
      <h1 className="page-title">Holidays</h1>

      <Toast message={message} />

      <div className="holiday-card">
        <h2 className="section-title">Upcoming holidays</h2>
        {loading ? (
          <p className="loading-text">Loading...</p>
        ) : upcomingHolidays.length > 0 ? (
          <div className="holiday-list">{upcomingHolidays.map(renderRow)}</div>
        ) : (
          <p className="no-records">No upcoming holidays</p>
        )}
      </div>

      {!loading && pastHolidays.length > 0 && (
        <div className="holiday-card">
          <h2 className="section-title">Past holidays</h2>
          <div className="holiday-list">{pastHolidays.map(renderRow)}</div>
        </div>
      )}

      {canManage && (
        <div className="holiday-card">
          <h2 className="section-title">Add holiday</h2>
          <form onSubmit={handleAddHoliday} className="add-holiday-form">
            <input
              type="text"
              name="name"
              placeholder="Holiday name"
              value={form.name}
              onChange={handleChange}
            />
            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
            />
            <select name="type" value={form.type} onChange={handleChange}>
              <option value="National">National</option>
              <option value="Regional">Regional</option>
              <option value="Company">Company</option>
            </select>
            <input
              type="text"
              name="description"
              placeholder="Description (optional)"
              value={form.description}
              onChange={handleChange}
            />
            <label className="optional-checkbox">
              <input
                type="checkbox"
                name="isOptional"
                checked={form.isOptional}
                onChange={handleChange}
              />
              Optional holiday
            </label>
            <button type="submit" className="add-btn" disabled={saving}>
              {saving ? 'Adding...' : '+ Add holiday'}
            </button>
          </form>
        </div>
      )}

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

export default Holidays;
