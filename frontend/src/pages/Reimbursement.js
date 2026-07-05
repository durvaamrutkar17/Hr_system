import React, { useState, useEffect } from 'react';
import { expenseAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import './Reimbursement.css';

const STATUS_LABELS = {
  submitted: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  reimbursed: 'Reimbursed'
};

const Reimbursement = () => {
  const { user } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { message, showToast } = useToast();
  const [formData, setFormData] = useState({
    expenseType: 'Travel',
    amount: '',
    description: '',
    date: new Date().toISOString().slice(0, 10)
  });

  useEffect(() => {
    fetchExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const response = await expenseAPI.getExpenses({ employeeId: user._id });
      setExpenses(response.data.expenses || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(formData.amount);

    if (!amountNum || amountNum <= 0) {
      showToast('error', 'Please enter a valid amount');
      return;
    }
    if (!formData.description.trim()) {
      showToast('error', 'Please describe what this claim was for');
      return;
    }
    if (!formData.date) {
      showToast('error', 'Please select a date');
      return;
    }

    try {
      setSubmitting(true);
      await expenseAPI.createExpense({
        expenseType: formData.expenseType,
        amount: amountNum,
        description: formData.description.trim(),
        date: formData.date
      });
      showToast('success', 'Claim submitted for approval');
      setFormData({ expenseType: 'Travel', amount: '', description: '', date: new Date().toISOString().slice(0, 10) });
      fetchExpenses();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="reimbursement-page">
      <p className="eyebrow">Claims</p>
      <h1 className="page-title">Reimbursement</h1>

      <Toast message={message} />

      <div className="claim-card">
        <h2 className="section-title">Submit a claim</h2>
        <form onSubmit={handleSubmit} className="claim-form">
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select name="expenseType" value={formData.expenseType} onChange={handleChange}>
                <option value="Travel">Travel</option>
                <option value="Food">Food</option>
                <option value="Accommodation">Accommodation</option>
                <option value="Medical">Medical</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Amount (₹)</label>
              <input
                type="number"
                name="amount"
                min="0"
                step="0.01"
                value={formData.amount}
                onChange={handleChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                name="date"
                max={new Date().toISOString().slice(0, 10)}
                value={formData.date}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              name="description"
              placeholder="What was this for?"
              value={formData.description}
              onChange={handleChange}
            />
          </div>

          <button type="submit" className="submit-btn" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit claim'}
          </button>
        </form>
      </div>

      <div className="claims-card">
        <h2 className="section-title">My claims</h2>
        {loading ? (
          <p className="loading-text">Loading...</p>
        ) : expenses.length > 0 ? (
          <div className="claims-list">
            {expenses.map((expense) => (
              <div key={expense._id} className="claim-row">
                <div className="claim-main">
                  <p className="claim-title">
                    {expense.expenseType} — ₹{expense.amount.toLocaleString('en-IN')}
                  </p>
                  <p className="claim-meta">
                    {expense.description} · {new Date(expense.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <span className={`status-badge ${expense.status}`}>
                  {STATUS_LABELS[expense.status] || expense.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-records">No claims submitted yet</p>
        )}
      </div>
    </div>
  );
};

export default Reimbursement;
