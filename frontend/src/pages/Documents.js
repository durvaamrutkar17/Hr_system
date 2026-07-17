import React, { useState, useEffect, useRef } from 'react';
import { documentAPI, documentRequestAPI, FILE_BASE_URL } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { DOCUMENT_CATEGORIES, DOCUMENT_TYPES, isExpired, isExpiringSoon } from '../utils/documentTaxonomy';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import './Documents.css';

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

const emptyRequestForm = { documentCategory: '', documentType: '', reason: '' };

// Old page (kept for reference, see git history): this used to be a generic
// "Documents" page with just two flat lists (company vs personal) and one
// upload form with a free-text label. Documents module redesign: this is now
// "My Documents" - the employee's own self-service document center, with
// categories/types, expiry, verification status, version history, and the
// ability to request an official document from HR instead of just uploading
// whatever they have. Uploading official ("company") documents happens from
// the Employee Profile page's Documents tab instead (HR-only there).
const Documents = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docLabel, setDocLabel] = useState('');
  const [docType, setDocType] = useState('Other');
  const [docCategory, setDocCategory] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const { message, showToast } = useToast();
  const fileInputRef = useRef(null);
  const [confirmState, setConfirmState] = useState(null);

  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestForm, setRequestForm] = useState(emptyRequestForm);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  useEffect(() => {
    fetchDocuments();
    fetchRequests();
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

  const fetchRequests = async () => {
    try {
      setLoadingRequests(true);
      const response = await documentRequestAPI.getRequests({ employeeId: user._id });
      setRequests(response.data.requests || []);
    } catch (error) {
      console.error('Error fetching document requests:', error);
    } finally {
      setLoadingRequests(false);
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

    // Old form data (kept for reference): only fileName + a fixed documentType of 'Other'.
    // formData.append('documentType', 'Other');
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('fileName', docLabel.trim());
    formData.append('documentType', docType);
    if (docCategory) formData.append('documentCategory', docCategory);
    if (expiryDate) formData.append('expiryDate', expiryDate);

    try {
      setUploading(true);
      await documentAPI.uploadDocument(formData);
      showToast('success', 'Document uploaded successfully');
      setDocLabel('');
      setDocType('Other');
      setDocCategory('');
      setExpiryDate('');
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

  const handleRequestFormChange = (e) => {
    const { name, value } = e.target;
    setRequestForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (!requestForm.documentCategory || !requestForm.documentType) {
      showToast('error', 'Please choose a category and document type');
      return;
    }
    try {
      setSubmittingRequest(true);
      await documentRequestAPI.createRequest(requestForm);
      showToast('success', 'Request sent to HR');
      setRequestForm(emptyRequestForm);
      fetchRequests();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Old split (kept for reference): d.category === 'company' / d.category !== 'company'.
  // Unchanged logic, just renamed for the "HR owns official documents" language.
  const officialDocs = documents
    .filter((d) => d.category === 'company')
    .sort((a, b) => new Date(a.uploadedDate) - new Date(b.uploadedDate));
  const personalDocs = documents.filter((d) => d.category !== 'company');

  const renderBadges = (doc) => (
    <>
      <span className={`verify-badge ${doc.verificationStatus}`}>{doc.verificationStatus}</span>
      {doc.expiryDate && isExpired(doc.expiryDate) && <span className="verify-badge rejected">Expired</span>}
      {doc.expiryDate && !isExpired(doc.expiryDate) && isExpiringSoon(doc.expiryDate) && (
        <span className="verify-badge pending">Expires {formatDate(doc.expiryDate)}</span>
      )}
      {doc.version > 1 && <span className="verify-badge verified">v{doc.version}</span>}
    </>
  );

  const renderRow = (doc, allowDelete) => (
    <div key={doc._id} className="doc-row">
      <div className="doc-icon">📄</div>
      <div className="doc-main">
        <p className="doc-name">{doc.fileName}</p>
        <p className="doc-date">
          {doc.documentCategory ? `${doc.documentCategory} · ` : ''}{doc.documentType} · {formatDate(doc.uploadedDate)}
        </p>
        <div className="doc-badges">{renderBadges(doc)}</div>
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
      {allowDelete && (
        <button type="button" className="remove-link" onClick={() => handleDelete(doc)}>
          ✕ Remove
        </button>
      )}
    </div>
  );

  return (
    <div className="documents-page">
      <p className="eyebrow">Records</p>
      <h1 className="page-title">My Documents</h1>

      <Toast message={message} />

      <div className="doc-card">
        <h2 className="section-title">Official documents (issued by HR)</h2>
        {loading ? (
          <p className="loading-text">Loading...</p>
        ) : officialDocs.length > 0 ? (
          <div className="doc-list">
            {officialDocs.map((doc) => renderRow(doc, false))}
          </div>
        ) : (
          <p className="no-records">No official documents yet</p>
        )}
      </div>

      {!loading && personalDocs.length > 0 && (
        <div className="doc-card">
          <h2 className="section-title">My uploads</h2>
          <div className="doc-list">
            {personalDocs.map((doc) => renderRow(doc, true))}
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
          <select value={docCategory} onChange={(e) => setDocCategory(e.target.value)}>
            <option value="">Category (optional)</option>
            {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={docType} onChange={(e) => setDocType(e.target.value)}>
            {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            type="date"
            title="Expiry date (optional)"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
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

      <div className="doc-card">
        <h2 className="section-title">Request a document from HR</h2>
        <form onSubmit={handleSubmitRequest} className="upload-form" noValidate>
          <select name="documentCategory" value={requestForm.documentCategory} onChange={handleRequestFormChange}>
            <option value="">Category</option>
            {DOCUMENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select name="documentType" value={requestForm.documentType} onChange={handleRequestFormChange}>
            <option value="">Document type</option>
            {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input
            type="text"
            name="reason"
            placeholder="Reason (optional)"
            value={requestForm.reason}
            onChange={handleRequestFormChange}
          />
          <button type="submit" className="upload-btn" disabled={submittingRequest}>
            {submittingRequest ? 'Sending...' : 'Send request'}
          </button>
        </form>

        {loadingRequests ? (
          <p className="loading-text">Loading...</p>
        ) : requests.length > 0 ? (
          <div className="doc-list" style={{ marginTop: '15px' }}>
            {requests.map((r) => (
              <div key={r._id} className="doc-row">
                <div className="doc-icon">📝</div>
                <div className="doc-main">
                  <p className="doc-name">{r.documentType}</p>
                  <p className="doc-date">{r.documentCategory} · requested {formatDate(r.createdAt)}{r.reason ? ` · ${r.reason}` : ''}</p>
                </div>
                <span className={`verify-badge ${r.status === 'fulfilled' ? 'verified' : r.status === 'rejected' ? 'rejected' : 'pending'}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-records">No requests yet</p>
        )}
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
