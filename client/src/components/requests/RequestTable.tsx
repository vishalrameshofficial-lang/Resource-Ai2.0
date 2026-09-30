import React, { useState } from 'react';
import {
  Search,
  Filter,
  Eye,
  EyeOff,
  ChevronRight,
  AlertCircle,
  Users,
  MapPin,
  Clock
} from 'lucide-react';
import { EmergencyRequest, RequestStatus, UrgencyLevel } from '../../types/emergency';
import { UrgencyBadge, StatusBadge, SourceBadge } from '../common/Badge';
import { formatDate, maskPhone } from '../../lib/utils';

interface RequestTableProps {
  requests: EmergencyRequest[];
  onSelectRequest: (request: EmergencyRequest) => void;
  isLoading?: boolean;
}

export function RequestTable({ requests, onSelectRequest, isLoading }: RequestTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [revealedPhones, setRevealedPhones] = useState<Record<string, boolean>>({});

  const togglePhoneReveal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRevealedPhones((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filtered = requests.filter((r) => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    if (urgencyFilter !== 'ALL' && r.urgency !== urgencyFilter) return false;
    if (categoryFilter !== 'ALL' && r.emergency_category !== categoryFilter) return false;
    if (sourceFilter !== 'ALL' && r.source !== sourceFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchId = r.request_id.toLowerCase().includes(q);
      const matchName = r.caller_name?.toLowerCase().includes(q);
      const matchLoc = r.location?.toLowerCase().includes(q);
      const matchDesc = r.description?.toLowerCase().includes(q);
      if (!matchId && !matchName && !matchLoc && !matchDesc) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Request ID, caller name, location or keyword..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900/90 border border-slate-700/80 rounded-xl text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="NEW">New</option>
            <option value="VERIFIED">Verified</option>
            <option value="FORWARDED_TO_GOVERNMENT">Forwarded to Govt</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="RESOURCE_ALLOCATED">Resource Allocated</option>
            <option value="DELIVERY_IN_PROGRESS">Delivery in Progress</option>
            <option value="DELIVERED">Delivered</option>
            <option value="REJECTED">Rejected</option>
          </select>

          {/* Urgency Filter */}
          <select
            value={urgencyFilter}
            onChange={(e) => setUrgencyFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Urgencies</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Categories</option>
            <option value="flood">Flood</option>
            <option value="landslide">Landslide</option>
            <option value="cyclone">Cyclone</option>
            <option value="medical">Medical</option>
            <option value="building_collapse">Collapse</option>
            <option value="fire">Fire</option>
            <option value="other">Other</option>
          </select>

          {/* Source Filter */}
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Sources</option>
            <option value="AI VOICE">AI Voice</option>
            <option value="WEB">Web Form</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Request ID</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Caller</th>
                <th className="py-3 px-4">Phone (PII)</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">People</th>
                <th className="py-3 px-4">Urgency</th>
                <th className="py-3 px-4">Resources</th>
                <th className="py-3 px-4">Source</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-400">
                    Loading emergency requests...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto text-slate-500 mb-2" />
                    No emergency requests match current filters.
                  </td>
                </tr>
              ) : (
                filtered.map((req) => {
                  const isRevealed = Boolean(revealedPhones[req.id]);
                  const displayPhone = maskPhone(req.caller_phone || req.masked_phone || '', isRevealed);

                  return (
                    <tr
                      key={req.id}
                      onClick={() => onSelectRequest(req)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      {/* Request ID */}
                      <td className="py-3 px-4 font-mono font-bold text-blue-400 whitespace-nowrap">
                        {req.request_id}
                      </td>

                      {/* Time */}
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{formatDate(req.created_at)}</span>
                        </div>
                      </td>

                      {/* Caller */}
                      <td className="py-3 px-4 font-medium text-slate-200 whitespace-nowrap">
                        <div>
                          <span>{req.caller_name || 'Anonymous'}</span>
                          <span className="block text-[10px] text-slate-400">
                            Lang: {req.caller_language}
                          </span>
                        </div>
                      </td>

                      {/* Phone with Privacy Reveal Button */}
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-300">
                        <div className="flex items-center space-x-1.5">
                          <span>{displayPhone}</span>
                          <button
                            title={isRevealed ? 'Mask number' : 'Reveal full phone number'}
                            onClick={(e) => togglePhoneReveal(req.id, e)}
                            className="p-1 hover:bg-slate-700/60 rounded text-slate-400 hover:text-slate-200 transition"
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Location */}
                      <td className="py-3 px-4 text-slate-300 max-w-[180px] truncate" title={req.location}>
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-red-400 shrink-0" />
                          <span className="truncate">{req.location}</span>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 capitalize text-slate-200 whitespace-nowrap">
                        {req.emergency_category.replace(/_/g, ' ')}
                      </td>

                      {/* Affected People */}
                      <td className="py-3 px-4 text-center font-bold text-slate-200 whitespace-nowrap">
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800">
                          <Users className="w-3 h-3 text-slate-400" />
                          <span>{req.affected_people_count}</span>
                        </span>
                      </td>

                      {/* Urgency */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <UrgencyBadge urgency={req.urgency} />
                      </td>

                      {/* Resources Needed */}
                      <td className="py-3 px-4 max-w-[160px] truncate text-slate-300">
                        {req.resources_needed && req.resources_needed.length > 0
                          ? req.resources_needed.map((r) => r.item).join(', ')
                          : 'General relief'}
                      </td>

                      {/* Source */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <SourceBadge source={req.source} />
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={req.status} />
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRequest(req);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white transition inline-flex items-center space-x-1"
                        >
                          <span>View</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
