import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Header from './components/Header';
import { AuthProvider } from './context/AuthContext';
import HomePage from './pages/HomePage';
import AuctionPage from './pages/AuctionPage';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import SellPage from './pages/SellPage';
import VerificationPage from './pages/VerificationPage';
import WatchlistPage from './pages/WatchlistPage';
import ActivityPage from './pages/ActivityPage';
import AdminPage from './pages/AdminPage';
import NotificationsPage from './pages/NotificationsPage';

function AppShell() {
  return <><Header /><Routes><Route path="/" element={<HomePage />} /><Route path="/auctions/:id" element={<AuctionPage />} /><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/sell" element={<SellPage />} /><Route path="/verification" element={<VerificationPage />} /><Route path="/watchlist" element={<WatchlistPage />} /><Route path="/activity" element={<ActivityPage />} /><Route path="/notifications" element={<NotificationsPage />} /><Route path="/admin" element={<AdminPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></>;
}

export default function App() {
  return <BrowserRouter><AuthProvider><AppShell /></AuthProvider></BrowserRouter>;
}
