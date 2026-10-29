import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, Gavel, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../api';

function AuthLayout({ children, title, subtitle, isRegister }) {
  return <main className="auth-page"><div className="auth-visual"><div className="auth-visual-text"><span className="eyebrow"><span className="eyebrow-line" /> THE ART OF THE FIND</span><h2>Some things<br />are worth<br /><em>the pursuit.</em></h2><p>A considered marketplace for rare objects, remarkable stories, and the people who treasure them.</p><div className="auth-visual-foot"><Gavel size={17} /><span>Discover. Collect. Pass it on.</span></div></div><div className="auth-visual-photo"><img src="https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=1200&q=85" alt="Collectible objects" /></div></div><div className="auth-form-side"><div className="auth-form-wrap"><Link to="/" className="auth-back">← Back to marketplace</Link><div className="auth-form-heading"><span className="auth-mini-icon"><ShieldCheck size={20} /></span><h1>{title}</h1><p>{subtitle}</p></div>{children}<div className="auth-switch">{isRegister ? <>Already have an account? <Link to="/login">Log in</Link></> : <>New to RareBid? <Link to="/register">Create an account</Link></>}</div><div className="auth-legal">By continuing, you agree to our marketplace terms and fair bidding rules.</div></div></div></main>;
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  if (user) return <Navigate to="/" replace />;
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try { await login(form); navigate('/'); } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  }
  return <AuthLayout title="Welcome back." subtitle="Sign in to continue your collecting journey."><form className="form-stack" onSubmit={submit}><label className="field-label">Email address<input type="email" autoComplete="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></label><label className="field-label">Password<div className="password-wrap"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Enter your password" /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>{error && <div className="inline-error">{error}</div>}<button className="button-primary auth-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={17} /></button></form></AuthLayout>;
}

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  if (user) return <Navigate to="/" replace />;
  async function submit(e) {
    e.preventDefault(); setError('');
    if (form.password !== form.confirm) return setError('Passwords do not match.');
    setBusy(true);
    try { await register({ name: form.name, email: form.email, password: form.password }); navigate('/'); } catch (err) { setError(getErrorMessage(err)); } finally { setBusy(false); }
  }
  return <AuthLayout title="Make room for rare." subtitle="Create an account to bid, collect, and sell." isRegister><form className="form-stack" onSubmit={submit}><label className="field-label">Full name<input autoComplete="name" required minLength={2} maxLength={80} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your name" /></label><label className="field-label">Email address<input type="email" autoComplete="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></label><label className="field-label">Password<div className="password-wrap"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={8} required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="At least 8 characters" /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle password visibility">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label><label className="field-label">Confirm password<input type="password" autoComplete="new-password" minLength={8} required value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} placeholder="Repeat password" /></label>{error && <div className="inline-error">{error}</div>}<button className="button-primary auth-submit" disabled={busy}>{busy ? 'Creating account…' : 'Create account'} <ArrowRight size={17} /></button></form></AuthLayout>;
}
