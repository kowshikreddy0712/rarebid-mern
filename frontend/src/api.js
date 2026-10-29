import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
export const SOCKET_URL = API_BASE.replace(/\/api\/v1\/?$/, '');
export const api = axios.create({ baseURL: API_BASE, withCredentials: true, timeout: 15000 });

export function getErrorMessage(error) {
  return error?.response?.data?.message || (error?.code === 'ECONNABORTED' ? 'The server took too long to respond.' : 'Could not connect to RareBid. Check that the API server is running.');
}

export function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(amount || 0));
}

export function formatCountdown(endAt, now = Date.now()) {
  const diff = Math.max(0, new Date(endAt).getTime() - now);
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function formatDate(value) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
