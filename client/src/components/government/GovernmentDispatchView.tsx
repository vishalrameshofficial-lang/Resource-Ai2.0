import React, { useState } from 'react';
import {
  Building2,
  Shield,
  Send,
  Box,
  Truck,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Clock,
  Filter
} from 'lucide-react';
import { EmergencyRequest, RequestStatus } from '../../types/emergency';
import { UrgencyBadge, StatusBadge } from '../common/Badge';
import { formatDate, formatStatusLabel } from '../../lib/utils';
import { api } from '../../lib/api';

interface GovernmentDispatchViewProps {
  requests: EmergencyRequest[];
  onSelectRequest: (req: EmergencyRequest) => void;
  onRefresh: () => void;
}

export function GovernmentDispatchView({ requests, onSelectRequest, onRefresh }: GovernmentDispatchViewProps) {
  const [selectedRequest, setSelectedRequest] = useState<EmergencyRequest | null>(null);
  const [actionStage, setActionStage] = useState<'forward' | 'allocate' | 'transit' | 'delivered' | null>(null);
  const [govtRef, setGovtRef] = useState('');
  const [agencyName, setAgencyName] = useState('State Disaster Response Force (SDRF)');
  const [details, setDetails] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Group requests into government dispatch pipeline columns
  const pendingVerification = requests.filter((r) => r.status === 'NEW');
  const verifiedQueue = requests.filter((r) => r.status === 'VERIFIED');
  const forwardedToGovt = requests.filter((r) => r.status === 'FORWARDED_TO_GOVERNMENT' || r.status === 'ACCEPTED');
  const inAllocation = requests.filter((r) => r.status === 'RESOURCE_ALLOCATED');
  const inTransit = requests.filter((r) => r.status === 'DELIVERY_IN_PROGRESS');
  const delivered = requests.filter((r) => r.status === 'DELIVERED');

  const executeAction = async () => {
    if (!selectedRequest || !actionStage) return;
    setIsProcessing(true);
    setFeedback(null);

    try {
      if (actionStage === 'forward') {
        if (!govtRef.trim()) throw new Error('Official Government Reference # is required');
        await api.forwardToGovernment(selectedRequest.id, govtRef, agencyName, details);
        setFeedback(`Request ${selectedRequest.request_id} successfully forwarded to ${agencyName}`);
      } else if (actionStage === 'allocate') {
        await api.allocateResources(selectedRequest.id, details || 'Boats, food packets, medical kits deployed', govtRef);
        setFeedback(`Resources marked allocated for ${selectedRequest.request_id}`);
      } else if (actionStage === 'transit') {
        await api.transitDelivery(selectedRequest.id, details || 'Convoy en route', govtRef);
        setFeedback(`Delivery marked in progress for ${selectedRequest.request_id}`);
      } else if (actionStage === 'delivered') {
        await api.markDelivered(selectedRequest.id, details || 'Relief assistance safely handed over', govtRef);
        setFeedback(`Request ${selectedRequest.request_id} resolved & delivered.`);
      }

      onRefresh();
      setActionStage(null);
      setSelectedRequest(null);
      setDetails('');
      setGovtRef('');
    } catch (err: any) {
      setFeedback(`Error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner explaining safety distinction */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-indigo-950/30 to-blue-950/40 border border-purple-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <span>Government Emergency Dispatch & Coordination</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                AUDITED
              </span>
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Strict boundary enforcement: requests remain labeled{' '}
              <strong className="text-blue-400">"Recorded by ResourceAI"</strong> until an administrator records an official{' '}
              <strong className="text-purple-400">Government Agency Reference Code</strong>.
            </p>
          </div>
        </div>

        <div className="text-right text-xs text-slate-400 shrink-0">
          <div>Govt Pending: <span className="font-bold text-amber-400">{verifiedQueue.length + forwardedToGovt.length}</span></div>
          <div>Active Transit: <span className="font-bold text-cyan-400">{inTransit.length}</span></div>
        </div>
      </div>

      {feedback && (
        <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-200 text-xs flex items-center space-x-2">
          <Shield className="w-4 h-4 shrink-0 text-blue-400" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Action Dialog if a card is selected */}
      {selectedRequest && actionStage && (
        <div className="glass-panel p-5 rounded-2xl border border-purple-500/40 space-y-4 bg-slate-900/90 shadow-2xl">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white flex items-center space-x-2">
              <Send className="w-4 h-4 text-purple-400" />
              <span>
                Action on {selectedRequest.request_id} ({selectedRequest.location}) - Step: {actionStage.toUpperCase()}
              </span>
            </h4>
            <button
              onClick={() => {
                setSelectedRequest(null);
                setActionStage(null);
              }}
              className="text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {actionStage === 'forward' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Government Agency:
                  </label>
                  <select
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200"
                  >
                    <option value="State Disaster Response Force (SDRF)">SDRF (State Disaster Response)</option>
                    <option value="National Disaster Response Force (NDRF)">NDRF (National Force)</option>
                    <option value="District Disaster Management Authority (DDMA)">DDMA (District Authority)</option>
                    <option value="State Fire & Rescue Services">Fire & Rescue Services</option>
                    <option value="108 Emergency Medical Services">108 Medical Ambulance</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Official Reference Code <span className="text-red-400">*</span>:
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TN-SDRF-2026-9921"
                    value={govtRef}
                    onChange={(e) => setGovtRef(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono"
                  />
                </div>
              </>
            )}

            <div className={actionStage === 'forward' ? 'md:col-span-1' : 'md:col-span-3'}>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Dispatch / Resource Notes:
              </label>
              <input
                type="text"
                placeholder="Details of vehicle, boat, squad or relief delivery notes..."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-100"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
            <button
              onClick={() => {
                setSelectedRequest(null);
                setActionStage(null);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              disabled={isProcessing}
              onClick={executeAction}
              className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition disabled:opacity-50"
            >
              {isProcessing ? 'Recording...' : 'Confirm Government Step'}
            </button>
          </div>
        </div>
      )}

      {/* Kanban / Pipeline Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Column 1: Awaiting Verification */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>1. New & Verified ({pendingVerification.length + verifiedQueue.length})</span>
            </h4>
          </div>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {[...pendingVerification, ...verifiedQueue].map((req) => (
              <div
                key={req.id}
                onClick={() => onSelectRequest(req)}
                className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/40 cursor-pointer transition shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-blue-400 text-xs">{req.request_id}</span>
                  <UrgencyBadge urgency={req.urgency} />
                </div>
                <p className="text-xs font-medium text-slate-200 line-clamp-1">{req.location}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{req.affected_people_count} people affected</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRequest(req);
                      setActionStage('forward');
                    }}
                    className="px-2 py-0.5 rounded bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white text-[10px] font-semibold transition"
                  >
                    Forward to Govt →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Forwarded / Accepted */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 className="text-xs font-bold text-purple-300 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-500" />
              <span>2. Forwarded to Govt ({forwardedToGovt.length})</span>
            </h4>
          </div>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {forwardedToGovt.map((req) => (
              <div
                key={req.id}
                onClick={() => onSelectRequest(req)}
                className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-purple-500/20 hover:border-purple-500/50 cursor-pointer transition shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-purple-300 text-xs">{req.request_id}</span>
                  <StatusBadge status={req.status} />
                </div>
                <p className="text-xs font-medium text-slate-200 line-clamp-1">{req.location}</p>
                {req.government_reference && (
                  <p className="text-[10px] font-mono text-purple-400 bg-purple-950/40 px-1.5 py-0.5 rounded border border-purple-800/40">
                    Ref: {req.government_reference}
                  </p>
                )}
                <div className="flex items-center justify-end pt-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRequest(req);
                      setActionStage('allocate');
                    }}
                    className="px-2 py-0.5 rounded bg-amber-600/30 hover:bg-amber-600 text-amber-300 hover:text-white text-[10px] font-semibold transition"
                  >
                    Allocate Units →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Resource Allocated & In Transit */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 className="text-xs font-bold text-amber-300 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span>3. Dispatch & Transit ({inAllocation.length + inTransit.length})</span>
            </h4>
          </div>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {[...inAllocation, ...inTransit].map((req) => (
              <div
                key={req.id}
                onClick={() => onSelectRequest(req)}
                className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800/80 border border-orange-500/20 hover:border-orange-500/50 cursor-pointer transition shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-orange-300 text-xs">{req.request_id}</span>
                  <StatusBadge status={req.status} />
                </div>
                <p className="text-xs font-medium text-slate-200 line-clamp-1">{req.location}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{req.affected_people_count} People</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRequest(req);
                      setActionStage(req.status === 'RESOURCE_ALLOCATED' ? 'transit' : 'delivered');
                    }}
                    className="px-2 py-0.5 rounded bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[10px] font-semibold transition"
                  >
                    {req.status === 'RESOURCE_ALLOCATED' ? 'In Transit →' : 'Mark Delivered ✓'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Column 4: Delivered / Resolved */}
        <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h4 className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>4. Delivered & Resolved ({delivered.length})</span>
            </h4>
          </div>

          <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
            {delivered.map((req) => (
              <div
                key={req.id}
                onClick={() => onSelectRequest(req)}
                className="p-3 rounded-xl bg-slate-900/60 border border-emerald-500/20 cursor-pointer transition hover:bg-slate-800/80 space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-emerald-400 text-xs">{req.request_id}</span>
                  <StatusBadge status={req.status} />
                </div>
                <p className="text-xs font-medium text-slate-200 line-clamp-1">{req.location}</p>
                <p className="text-[10px] text-slate-400 flex items-center space-x-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  <span>Resolved: {formatDate(req.updated_at)}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
