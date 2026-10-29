import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Camera, CheckCircle2, FileText, Info, ShieldCheck, UploadCloud } from 'lucide-react';
import { api, getErrorMessage } from '../api';
import { useAuth } from '../context/AuthContext';

const categories = ['Vehicles', 'Gold & Treasures', 'Antiques', 'Art', 'Coins', 'Collectibles', 'Books', 'Watches', 'Memorabilia', 'Militaria', 'Other'];
const initial = { title: '', description: '', category: 'Collectibles', condition: 'Good', imageUrl: '', evidenceDescription: '', startingPrice: '1000', minIncrement: '100', durationMinutes: '10', startAt: '', shippingInfo: '' };
export default function SellPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initial);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  if (loading) return <main className="wrap page-content"><div className="page-loading">Loading your account…</div></main>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.sellerVerificationStatus !== 'verified') return <main className="wrap narrow-page"><div className="seller-gate"><span className="seller-gate-icon"><ShieldCheck size={28} /></span><div className="eyebrow"><span className="eyebrow-line" /> SELLER ONBOARDING</div><h1>Before your item<br />meets its <em>next owner.</em></h1><p>To keep the marketplace trustworthy, sellers must submit a verification request before listing. It is a one-time step.</p><div className="verification-status-card"><strong>Current status</strong><span className={`verification-state state-${user.sellerVerificationStatus}`}>{user.sellerVerificationStatus.replace('_', ' ')}</span>{user.sellerVerificationStatus === 'pending' ? <p>Your request is in the review queue. You can return here after an administrator reviews it.</p> : user.sellerVerificationStatus === 'rejected' ? <p>Your previous request was rejected. Review your details and submit a new request.</p> : <p>Submit your seller verification details to unlock listing creation.</p>}</div><Link to="/verification" className="button-primary">Continue to verification <ArrowRight size={17} /></Link></div></main>;

  function update(key, value) { setForm(current => ({ ...current, [key]: value })); }
  async function submit(e) {
    e.preventDefault(); setError(''); setSuccess('');
    const invalidField = e.currentTarget.querySelector(':invalid');
    if (invalidField) {
      const fieldLabel = invalidField.closest('label')?.childNodes[0]?.textContent?.replace(/\s*\*\s*$/, '').trim();
      setError(fieldLabel ? `${fieldLabel} needs attention. Check the value and try again.` : 'Please check the required listing details and try again.');
      return;
    }
    if (!imageFile && !form.imageUrl.trim()) { setError('Choose a product photo or provide an image URL.'); return; }
    setBusy(true);
    try {
      let imageUrl = form.imageUrl.trim();
      if (imageFile) {
        const upload = new FormData(); upload.append('image', imageFile);
        const uploaded = await api.post('/uploads/product-image', upload);
        imageUrl = uploaded.data.imageUrl;
      }
      let evidenceDocumentIds = [];
      if (evidenceFiles.length) {
        const documents = new FormData(); evidenceFiles.forEach(file => documents.append('documents', file));
        const uploadedDocs = await api.post('/uploads/evidence-documents', documents);
        evidenceDocumentIds = uploadedDocs.data.documents.map(doc => doc.id);
      }
      const payload = { ...form, imageUrl, evidenceDocumentIds, startingPrice: Number(form.startingPrice), minIncrement: Number(form.minIncrement), durationMinutes: Number(form.durationMinutes), startAt: new Date(form.startAt).toISOString() };
      const { data } = await api.post('/auctions', payload);
      setSuccess(data.message || 'Your listing has been submitted.');
      setTimeout(() => navigate('/activity'), 1300);
    } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  }
  const earliest = new Date(Date.now() + 60_000); earliest.setSeconds(0, 0);
  const minDate = `${earliest.getFullYear()}-${String(earliest.getMonth() + 1).padStart(2, '0')}-${String(earliest.getDate()).padStart(2, '0')}T${String(earliest.getHours()).padStart(2, '0')}:${String(earliest.getMinutes()).padStart(2, '0')}`;
  return <main className="wrap narrow-page">
    <Link className="back-link" to="/"><ArrowLeft size={15} /> Back to marketplace</Link>
    <div className="sell-page-heading"><div className="eyebrow"><span className="eyebrow-line" /> SELL ON RAREBID</div><h1>Every object has<br />a <em>next chapter.</em></h1><p>Tell the story, share the details, and let the right collector find it.</p><div className="review-note"><ShieldCheck size={17} /><span><strong>Every listing is reviewed before publication.</strong> Please describe condition and evidence accurately.</span></div></div>
    <form className="listing-form" noValidate onSubmit={submit}>
      <div className="form-section"><div className="form-section-heading"><span>01</span><div><h2>The object</h2><p>Help collectors understand what makes this piece worth a closer look.</p></div></div>
        <label className="field-label">Listing title *<input required minLength={4} maxLength={120} value={form.title} onChange={e => update('title', e.target.value)} placeholder="e.g. 1960s brass marine compass" /></label>
        <label className="field-label">Description *<textarea required minLength={20} maxLength={5000} rows={5} value={form.description} onChange={e => update('description', e.target.value)} placeholder="Describe the history, markings, dimensions, condition, and anything a collector should know…" /></label>
        <div className="form-grid-2"><label className="field-label">Category *<select value={form.category} onChange={e => update('category', e.target.value)}>{categories.map(x => <option key={x}>{x}</option>)}</select></label><label className="field-label">Condition *<select value={form.condition} onChange={e => update('condition', e.target.value)}>{['New', 'Excellent', 'Good', 'Fair', 'For parts / restoration'].map(x => <option key={x}>{x}</option>)}</select></label></div>
        <label className="field-label">Product photo *<div className="input-with-icon"><Camera size={17} /><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e => { const file = e.target.files?.[0] || null; setImageFile(file); setImagePreview(file ? URL.createObjectURL(file) : ''); }} /></div><span className="field-help">Upload JPG, PNG, WEBP, or GIF up to 5 MB. Only upload images you own or are allowed to use.</span></label>
        <label className="field-label">Or use an image URL (optional)<input type="url" value={form.imageUrl} onChange={e => update('imageUrl', e.target.value)} placeholder="https://…" /></label>
        {(imagePreview || form.imageUrl) && <div className="image-url-preview"><img src={imagePreview || form.imageUrl} alt="Listing preview" onError={e => { e.currentTarget.style.display = 'none'; }} /><span>Listing image preview</span></div>}
      </div>
      <div className="form-section"><div className="form-section-heading"><span>02</span><div><h2>Evidence & provenance</h2><p>Be transparent about what you know and what you cannot verify.</p></div></div>
        <label className="field-label">Evidence summary<textarea rows={3} maxLength={2000} value={form.evidenceDescription} onChange={e => update('evidenceDescription', e.target.value)} placeholder="Receipts, maker marks, certificates, provenance, appraisals—or state clearly if none are available." /></label>
        <label className="field-label">Supporting evidence documents (optional)<div className="input-with-icon"><FileText size={17} /><input type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp" onChange={e => setEvidenceFiles(Array.from(e.target.files || []).slice(0, 5))} /></div><span className="field-help">Up to 5 PDF/JPG/PNG/WEBP files, 10 MB each. These are stored privately and only the seller and administrators can access them.</span></label>
        {evidenceFiles.length > 0 && <div className="evidence-file-list">{evidenceFiles.map((file, index) => <div key={`${file.name}-${index}`}><FileText size={15} /><span>{file.name}</span><small>{(file.size / (1024 * 1024)).toFixed(2)} MB</small></div>)}</div>}
        <div className="subtle-callout"><Info size={17} /><p><strong>Evidence is not proof by itself.</strong> Describe receipts, maker marks, provenance, certificates, or appraisal reports. An administrator reviews submissions, but independent authenticity may still require a qualified specialist.</p></div>
      </div>
      <div className="form-section"><div className="form-section-heading"><span>03</span><div><h2>Auction settings</h2><p>Choose a fair starting point and a clear schedule.</p></div></div>
        <div className="form-grid-2"><label className="field-label">Starting price (₹) *<input type="number" min="1" step="1" required value={form.startingPrice} onChange={e => update('startingPrice', e.target.value)} /></label><label className="field-label">Minimum increment (₹) *<input type="number" min="1" step="1" required value={form.minIncrement} onChange={e => update('minIncrement', e.target.value)} /></label></div>
        <div className="form-grid-2"><label className="field-label">Auction duration *<select value={form.durationMinutes} onChange={e => update('durationMinutes', e.target.value)}>{[1, 2, 5, 10, 15, 30, 60].map(x => <option key={x} value={x}>{x} {x === 1 ? 'minute' : 'minutes'}</option>)}</select></label><label className="field-label">Start date & time *<input type="datetime-local" required min={minDate} value={form.startAt} onChange={e => update('startAt', e.target.value)} /><span className="field-help">Uses your local timezone; server stores UTC.</span></label></div>
        <label className="field-label">Shipping information<textarea rows={2} maxLength={1000} value={form.shippingInfo} onChange={e => update('shippingInfo', e.target.value)} placeholder="Packing, courier preferences, pickup limits, and likely shipping cost…" /></label>
      </div>
      <div className="submit-listing-row"><div><FileText size={18} /><span>Your listing will be submitted for review before it becomes public.</span></div><button className="button-primary" disabled={busy}>{busy ? 'Submitting…' : 'Submit for review'} <ArrowRight size={17} /></button></div>
      {error && <div className="inline-error">{error}</div>}{success && <div className="notice-banner success"><CheckCircle2 size={16} />{success}</div>}
    </form>
  </main>;
}
