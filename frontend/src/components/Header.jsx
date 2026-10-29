import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Gavel, Search, Bookmark, Menu, X, UserRound, Plus, ChevronDown, LogOut, ShieldCheck, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const submitSearch = (event) => {
    event.preventDefault();
    navigate(`/?q=${encodeURIComponent(query.trim())}`);
    setMenuOpen(false);
  };
  const nav = <>
    <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>Discover</NavLink>
    <NavLink to="/?status=upcoming" className="nav-link">Upcoming</NavLink>
    <NavLink to="/watchlist" className="nav-link">Watchlist</NavLink>
  </>;
  return <header className="site-header">
    <div className="header-inner wrap">
      <Link className="brand" to="/" aria-label="RareBid home"><span className="brand-mark"><Gavel size={19} strokeWidth={2.2} /></span><span>rare<span className="brand-light">bid</span><small>OBJECTS WITH A STORY</small></span></Link>
      <form className="header-search" onSubmit={submitSearch}><Search size={17} /><input aria-label="Search lots" placeholder="Search rare finds, makers, eras…" value={query} onChange={e => setQuery(e.target.value)} /><kbd>↵</kbd></form>
      <nav className="desktop-nav">{nav}</nav>
      <div className="header-actions">
        {user && <Link to="/notifications" className="notification-header-button" aria-label="Notifications"><Bell size={17} /></Link>}
        <Link className="sell-button" to={user?.sellerVerificationStatus === 'verified' ? '/sell' : '/verification'}><Plus size={16} /> Sell an item</Link>
        {user ? <div className="account-wrap"><button className="account-button" onClick={() => setMenuOpen(v => !v)}><span className="avatar">{user.name?.slice(0, 1).toUpperCase()}</span><ChevronDown size={14} /></button>{menuOpen && <div className="account-menu"><div className="account-menu-user"><strong>{user.name}</strong><span>{user.email}</span></div><Link to="/activity" onClick={() => setMenuOpen(false)}><UserRound size={15} /> My activity</Link><Link to="/notifications" onClick={() => setMenuOpen(false)}><Bell size={15} /> Notifications</Link><Link to="/verification" onClick={() => setMenuOpen(false)}><ShieldCheck size={15} /> Seller verification</Link>{user.role === 'admin' && <Link to="/admin" onClick={() => setMenuOpen(false)}><ShieldCheck size={15} /> Admin dashboard</Link>}<button onClick={async () => { await logout(); setMenuOpen(false); navigate('/'); }}><LogOut size={15} /> Log out</button></div>}</div> : <Link to="/login" className="login-button">Log in <span>↗</span></Link>}
        <button className="mobile-menu-toggle" aria-label="Toggle navigation" onClick={() => setMenuOpen(v => !v)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
    </div>
    {menuOpen && <div className="mobile-nav wrap">{nav}{user && <Link to="/activity" className="nav-link">My activity</Link>}{user && <Link to="/notifications" className="nav-link">Notifications</Link>}{user?.role === 'admin' && <Link to="/admin" className="nav-link">Admin</Link>}{!user && <Link to="/login" className="nav-link">Log in</Link>}<Link to="/watchlist" className="nav-link"><Bookmark size={15} /> Watchlist</Link></div>}
  </header>;
}
