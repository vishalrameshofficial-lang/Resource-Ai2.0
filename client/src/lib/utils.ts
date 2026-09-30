import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { UrgencyLevel, RequestStatus } from '../types/emergency';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function maskPhone(phone: string, isRevealed = false) {
  if (!phone) return 'N/A';
  if (isRevealed) return phone;
  const clean = phone.trim();
  if (clean.length <= 4) return '****';
  const prefix = clean.slice(0, 3);
  const suffix = clean.slice(-4);
  return `${prefix} ******${suffix}`;
}

export function formatDate(isoString: string) {
  if (!isoString) return 'N/A';
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat('en-IN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }).format(d);
  } catch {
    return isoString;
  }
}

export function getUrgencyBadgeColor(urgency: UrgencyLevel) {
  switch (urgency) {
    case 'CRITICAL':
      return 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse';
    case 'HIGH':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    case 'MEDIUM':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40';
    case 'LOW':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    default:
      return 'bg-slate-700 text-slate-300 border-slate-600';
  }
}

export function getStatusBadgeColor(status: RequestStatus) {
  switch (status) {
    case 'NEW':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    case 'VERIFIED':
      return 'bg-indigo-500/20 text-indigo-400 border-indigo-500/40';
    case 'FORWARDED_TO_GOVERNMENT':
      return 'bg-purple-500/20 text-purple-400 border-purple-500/40';
    case 'ACCEPTED':
      return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40';
    case 'RESOURCE_ALLOCATED':
      return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    case 'DELIVERY_IN_PROGRESS':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/40';
    case 'DELIVERED':
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    case 'REJECTED':
      return 'bg-slate-700 text-slate-400 border-slate-600';
    case 'CANCELLED':
      return 'bg-red-900/30 text-red-400 border-red-800';
    default:
      return 'bg-slate-700 text-slate-300 border-slate-600';
  }
}

export function formatStatusLabel(status: RequestStatus) {
  return status.replace(/_/g, ' ');
}
