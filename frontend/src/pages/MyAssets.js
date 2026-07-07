import React, { useState, useEffect } from 'react';
import { assetAPI } from '../services/api';
import './AssetTracker.css';

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

const MyAssets = () => {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await assetAPI.getAssets();
      setAssets(response.data.assets || []);
    } catch (error) {
      console.error('Error loading assets:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="asset-tracker-page">
      <p className="eyebrow">Operations</p>
      <h1 className="page-title">My Assets</h1>

      <div className="asset-card">
        <h2 className="section-title">Assigned to me</h2>
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
          <p className="no-records">No assets assigned yet</p>
        )}
      </div>
    </div>
  );
};

export default MyAssets;
