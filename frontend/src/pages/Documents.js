import React, { useState, useEffect, useRef } from 'react';
import { documentAPI, FILE_BASE_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import './Documents.css';

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

const Documents = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docLabel, setDocLabel] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { message, showToast } = useToast();
  const fileInputRef = useRef(null);
  const [confirmState, setConfirmState] = useState(null);

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await documentAPI.getDocuments({ employeeId: user._id });
      setDocuments(response.data.documents || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChooseFileClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0] || null);
  };

  const handleUpload = async () => {
    if (!docLabel.trim()) {
      showToast('error', 'Please enter a document name (e.g. PAN card, Aadhaar)');
      return;
    }
    if (!selectedFile) {
      showToast('error', 'Please choose a file to upload');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('fileName', docLabel.trim());
    formData.append('documentType', 'Other');

    try {
      setUploading(true);
      await documentAPI.uploadDocument(formData);
      showToast('success', 'Document uploaded successfully');
      setDocLabel('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchDocuments();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (doc) => {
    setConfirmState({
      message: `Remove "${doc.fileName}"?`,
      confirmLabel: 'Remove',
      onConfirm: () => performDelete(doc)
    });
  };

  const performDelete = async (doc) => {
    setConfirmState(null);
    try {
      await documentAPI.deleteDocument(doc._id);
      showToast('success', 'Document removed');
      fetchDocuments();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    }
  };

  const companyDocs = documents
    .filter((d) => d.category === 'company')
    .sort((a, b) => new Date(a.uploadedDate) - new Date(b.uploadedDate));
  const personalDocs = documents.filter((d) => d.category !== 'company');

  const renderRow = (doc) => (
    <div key={doc._id} className="doc-row">
      <div className="doc-icon">📄</div>
      <div className="doc-main">
        <p className="doc-name">{doc.fileName}</p>
        <p className="doc-date">{formatDate(doc.uploadedDate)}</p>
      </div>
      <a
        className="download-link"
        href={`${FILE_BASE_URL}${doc.fileUrl}`}
        download={doc.fileName}
        target="_blank"
        rel="noreferrer"
      >
        ⬇ Download
      </a>
      {doc.category !== 'company' && (
        <button type="button" className="remove-link" onClick={() => handleDelete(doc)}>
          ✕ Remove
        </button>
      )}
    </div>
  );

  return (
    <div className="documents-page">
      <p className="eyebrow">Records</p>
      <h1 className="page-title">Documents</h1>

      <Toast message={message} />

      <div className="doc-card">
        <h2 className="section-title">Company letters</h2>
        {loading ? (
          <p className="loading-text">Loading...</p>
        ) : companyDocs.length > 0 ? (
          <div className="doc-list">
            {companyDocs.map(renderRow)}
          </div>
        ) : (
          <p className="no-records">No company documents yet</p>
        )}
      </div>

      {!loading && personalDocs.length > 0 && (
        <div className="doc-card">
          <h2 className="section-title">My uploads</h2>
          <div className="doc-list">
            {personalDocs.map(renderRow)}
          </div>
        </div>
      )}

      <div className="doc-card">
        <h2 className="section-title">Upload personal document</h2>
        <div className="upload-form">
          <input
            type="text"
            placeholder="e.g. PAN card, Aadhaar"
            value={docLabel}
            onChange={(e) => setDocLabel(e.target.value)}
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <button type="button" className="choose-file-btn" onClick={handleChooseFileClick}>
            📎 Choose file
          </button>
          <span className="selected-file-name">
            {selectedFile ? selectedFile.name : 'No file chosen'}
          </span>
          <button className="upload-btn" onClick={handleUpload} disabled={uploading}>
            {uploading ? 'Uploading...' : '⬆ Upload'}
          </button>
        </div>
      </div>

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

export default Documents;
