import React, { useState, useEffect } from 'react';
import { assetAPI, userAPI } from '../services/api';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import './AssetTracker.css';

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

const AssetTracker = () => {
  const [employees, setEmployees] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const { message, showToast } = useToast();
  const [form, setForm] = useState({ employeeId: '', itemName: '', serialNumber: '' });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [employeesRes, assetsRes] = await Promise.all([
        userAPI.getUsers(),
        assetAPI.getAssets()
      ]);
      const employeeList = employeesRes.data.users || [];
      setEmployees(employeeList);
      setAssets(assetsRes.data.assets || []);
      setForm((prev) => ({ ...prev, employeeId: prev.employeeId || employeeList[0]?._id || '' }));
    } catch (error) {
      console.error('Error loading assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAssign = async (e) => {
    e.preventDefault();

    if (!form.employeeId) {
      showToast('error', 'Please select an employee');
      return;
    }
    if (!form.itemName.trim()) {
      showToast('error', 'Please enter an item name');
      return;
    }

    try {
      setAssigning(true);
      await assetAPI.createAsset({
        employeeId: form.employeeId,
        itemName: form.itemName.trim(),
        serialNumber: form.serialNumber.trim()
      });
      showToast('success', 'Asset assigned');
      setForm((prev) => ({ ...prev, itemName: '', serialNumber: '' }));
      fetchAll();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setAssigning(false);
    }
  };

  const handleMarkReturned = async (asset) => {
    if (!window.confirm(`Mark "${asset.itemName}" as returned?`)) return;

    try {
      await assetAPI.updateAsset(asset._id, { status: 'returned' });
      showToast('success', 'Asset marked returned');
      fetchAll();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    }
  };

  return (
    <div className="asset-tracker-page">
      <p className="eyebrow">Operations</p>
      <h1 className="page-title">Asset Tracker</h1>

      <Toast message={message} />

      <div className="asset-card">
        <h2 className="section-title">Assign new asset</h2>
        <form onSubmit={handleAssign} className="assign-form">
          <select name="employeeId" value={form.employeeId} onChange={handleChange}>
            {employees.map((emp) => (
              <option key={emp._id} value={emp._id}>
                {emp.firstName} {emp.lastName}
              </option>
            ))}
          </select>
          <input
            type="text"
            name="itemName"
            placeholder="Item (e.g. MacBook Air)"
            value={form.itemName}
            onChange={handleChange}
          />
          <input
            type="text"
            name="serialNumber"
            placeholder="Serial / SIM number"
            value={form.serialNumber}
            onChange={handleChange}
          />
          <button type="submit" className="assign-btn" disabled={assigning}>
            {assigning ? 'Assigning...' : '+ Assign'}
          </button>
        </form>
      </div>

      <div className="asset-card">
        <h2 className="section-title">All assets</h2>
        {loading ? (
          <p className="loading-text">Loading...</p>
        ) : assets.length > 0 ? (
          <div className="asset-list">
            {assets.map((asset) => (
              <div key={asset._id} className="asset-row">
                <div className="asset-icon">💻</div>
                <div className="asset-main">
                  <p className="asset-name">{asset.itemName}</p>
                  <p className="asset-meta">
                    {asset.employeeId ? `${asset.employeeId.firstName} ${asset.employeeId.lastName}` : 'Unassigned'}
                    {asset.serialNumber && ` · ${asset.serialNumber}`}
                    {` · assigned ${formatDate(asset.assignedDate)}`}
                  </p>
                </div>
                <span className={`status-badge ${asset.status}`}>
                  {asset.status === 'active' ? 'Active' : 'Returned'}
                </span>
                {asset.status === 'active' && (
                  <button type="button" className="return-link" onClick={() => handleMarkReturned(asset)}>
                    Mark returned
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="no-records">No assets assigned yet</p>
        )}
      </div>
    </div>
  );
};

export default AssetTracker;
