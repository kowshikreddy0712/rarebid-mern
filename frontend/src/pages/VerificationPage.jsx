import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, ShieldCheck } from 'lucide-react';
import { api, getErrorMessage } from '../api';
import { useAuth } from '../context/AuthContext';

export default function VerificationPage() {
  const { user, loading, refreshUser } = useAuth();
  const [fullLegalName, setFullLegalName] = useState('');
  const [contactNote, setContactNote] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [verificationFiles, setVerificationFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  useEffect(() => { if (user) setFullLegalName(user.name || ''); }, [user]);
  if (loading) return <main className="wrap page-content"><div className="page-loading">Loading…</div></main>;
  if (!user) return <Navigate to="/login" replace />;
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(''); setSuccess('');
    try { let documentIds = []; if (verificationFiles.length) { const body = new FormData(); verificationFiles.forEach(file => body.append('documents', file)); const uploaded = await api.post('/uploads/seller-verification-documents', body); documentIds = uploaded.data.documents.map(doc => doc.id); } const { data } = await api.post('/users/seller-verification', { fullLegalName, contactNote, evidenceReference, documentIds }); setSuccess(data.message); await refreshUser(); }
    catch (err) { setError(getErrorMessage(err)); }
    finally { setBusy(false); }
  }
  return <main className="wrap narrow-page verification-page"><Link className="back-link" to="/"><ArrowLeft size={15} /> Back to marketplace</Link><div className="verification-heading"><span className="verification-large-icon"><ShieldCheck size={27} /></span><div className="eyebrow"><span className="eyebrow-line" /> TRUST & SAFETY</div><h1>Build trust<br />before you <em>sell.</em></h1><p>Seller verification helps establish who is offering an item. It does not independently prove an item's authenticity.</p></div>
    <div className="verification-progress"><div className={`progress-step done`}><span>1</span><div><strong>Account created</strong><small>Your RareBid account is active.</small></div></div><div className={`progress-step ${['pending', 'verified'].includes(user.sellerVerificationStatus) ? 'done' : 'current'}`}><span>2</span><div><strong>Identity review</strong><small>Administrator reviews your submission.</small></div></div><div className={`progress-step ${user.sellerVerificationStatus === 'verified' ? 'done' : ''}`}><span>3</span><div><strong>Seller access</strong><small>Submit listings for review.</small></div></div></div>
    <div className="verification-status-card"><div><strong>Verification status</strong><span className={`verification-state state-${user.sellerVerificationStatus}`}>{user.sellerVerificationStatus.replace('_', ' ')}</span></div>{user.sellerVerificationStatus === 'verified' ? <p>Your seller account is verified. You can now submit an item for listing review.</p> : user.sellerVerificationStatus === 'pending' ? <p>Your submission is awaiting administrator review. You do not need to submit it again.</p> : <p>Complete the form below to request seller access.</p>}</div>
    {user.sellerVerificationStatus !== 'pending' && user.sellerVerificationStatus !== 'verified' && <form className="listing-form verification-form" onSubmit={submit}><div className="form-section"><label className="field-label">Full legal name *<input required minLength={3} maxLength={120} value={fullLegalName} onChange={e => setFullLegalName(e.target.value)} placeholder="Name matching your identity evidence" /></label><label className="field-label">Contact note (optional)<textarea rows={2} maxLength={500} value={contactNote} onChange={e => setContactNote(e.target.value)} placeholder="Any context for the review team" /></label><label className="field-label">Evidence reference *<div className="input-with-icon"><FileText size={17} /><input required minLength={8} maxLength={500} value={evidenceReference} onChange={e => setEvidenceReference(e.target.value)} placeholder="Short note about the evidence provided" /></div><span className="field-help">Use a non-sensitive reference note. Do not put full identity-document numbers in this field.</span></label><label className="field-label">Identity / seller evidence documents (optional)<div className="input-with-icon"><FileText size={17} /><input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => setVerificationFiles(Array.from(e.target.files || []).slice(0, 5))} /></div><span className="field-help">Up to 5 PDF/JPG/PNG/WEBP files, 10 MB each. These are stored privately for review, but this demo does not perform automated identity checks.</span></label>{verificationFiles.length > 0 && <div className="evidence-file-list">{verificationFiles.map((file, index) => <div key={`${file.name}-${index}`}><FileText size={15} /><span>{file.name}</span><small>{(file.size / (1024 * 1024)).toFixed(2)} MB</small></div>)}</div>}<div className="subtle-callout"><ShieldCheck size={17} /><p>Only submit documents you are authorized to share. The files are private to you and administrators in this MVP, but you should use test documents while developing. Admin approval is a manual review workflow, not legal identity verification.</p></div></div><button className="button-primary full-width" disabled={busy}>{busy ? 'Submitting…' : 'Submit verification request'} <ArrowRight size={17} /></button>{error && <div className="inline-error">{error}</div>}{success && <div className="notice-banner success"><CheckCircle2 size={16} />{success}</div>}</form>}
    {user.sellerVerificationStatus === 'verified' && <Link to="/sell" className="button-primary">Create a listing <ArrowRight size={17} /></Link>}
  </main>;
}
