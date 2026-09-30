import React, { useState } from 'react';
import {
  X,
  MapPin,
  Users,
  AlertTriangle,
  PhoneCall,
  Calendar,
  CheckCircle,
  Clock,
  Shield,
  Send,
  Truck,
  Box,
  FileText,
  Eye,
  EyeOff,
  Volume2
} from 'lucide-react';
import { EmergencyRequest, RequestStatus } from '../../types/emergency';
import { UrgencyBadge, StatusBadge, SourceBadge } from '../common/Badge';
import { formatDate, maskPhone, formatStatusLabel } from '../../lib/utils';
import { api } from '../../lib/api';

interface RequestDetailModalProps {
  request: EmergencyRequest | null;
  onClose: () => void;
  onUpdated: (updated: EmergencyRequest) => void;
}

export function RequestDetailModal({ request, onClose, onUpdated }: RequestDetailModalProps) {
  if (!request) return null;

  const [phoneRevealed, setPhoneRevealed] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'transcript' | 'timeline'>('details');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminNotes, setAdminNotes] = useState(request.admin_notes || '');
  const [govtRef, setGovtRef] = useState(request.government_reference || '');
  const [actionError, setActionError] = useState<string | null>(null);

  const displayPhone = maskPhone(request.caller_phone || request.masked_phone || '', phoneRevealed);

  const handleStatusChange = async (newStatus: RequestStatus) => {
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await api.updateRequestStatus(request.id, newStatus, adminNotes, govtRef);
      if (res.data) {
        onUpdated(res.data);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to update status');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
      <div className="glass-panel w-full max-w-4xl rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-xl font-bold text-blue-400">
              {request.request_id}
            </span>
            <UrgencyBadge urgency={request.urgency} />
            <StatusBadge status={request.status} />
            <SourceBadge source={request.source} />
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Error Message */}
        {actionError && (
          <div className="p-3 bg-red-500/20 border-b border-red-500/40 text-red-300 text-xs flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5">
          <button
            onClick={() => setActiveTab('details')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition ${
              activeTab === 'details'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Emergency Overview & Actions
          </button>
          <button
            onClick={() => setActiveTab('transcript')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'transcript'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>AI Voice Transcript & Summary</span>
            {request.callSession?.transcript && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-[10px] text-cyan-300">
                {request.callSession.transcript.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition flex items-center space-x-1.5 ${
              activeTab === 'timeline'
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Dispatch Timeline Audit</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
          {activeTab === 'details' && (
            <>
              {/* Emergency Summary Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Card: Location & Category */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Emergency Location & Type
                  </h4>
                  <div>
                    <div className="flex items-start space-x-2 text-slate-100 font-semibold text-base">
                      <MapPin className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                      <span>{request.location}</span>
                    </div>
                    {request.landmark && (
                      <p className="text-xs text-slate-400 mt-0.5 ml-6">
                        Landmark: <span className="text-slate-300">{request.landmark}</span>
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Category:</span>
                    <span className="capitalize font-semibold text-white px-2 py-0.5 rounded bg-slate-800">
                      {request.emergency_category.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Affected People:</span>
                    <span className="font-bold text-white flex items-center space-x-1">
                      <Users className="w-3.5 h-3.5 text-blue-400" />
                      <span>{request.affected_people_count} individuals</span>
                    </span>
                  </div>

                  {request.immediate_danger && (
                    <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center space-x-2">
                      <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
                      <span>Immediate Life Danger Flagged by AI Triage</span>
                    </div>
                  )}
                </div>

                {/* Right Card: Caller Information */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Caller Details (PII Safeguards)
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Name:</span>
                      <span className="font-semibold text-slate-200">
                        {request.caller_name || 'Anonymous'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Phone:</span>
                      <div className="flex items-center space-x-1.5 font-mono">
                        <span className="text-slate-200 font-semibold">{displayPhone}</span>
                        <button
                          onClick={() => setPhoneRevealed(!phoneRevealed)}
                          className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-slate-200 transition"
                        >
                          {phoneRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Spoken Language:</span>
                      <span className="font-semibold text-blue-400">{request.caller_language}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Recorded At:</span>
                      <span className="text-slate-300">{formatDate(request.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1.5">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Situation Description
                </h4>
                <p className="text-sm text-slate-200 leading-relaxed">{request.description}</p>
              </div>

              {/* Resources Needed */}
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                  <Box className="w-3.5 h-3.5 text-amber-400" />
                  <span>Required Relief Resources</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {request.resources_needed && request.resources_needed.length > 0 ? (
                    request.resources_needed.map((item, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-xs flex items-center justify-between"
                      >
                        <span className="text-slate-200 font-medium">{item.item}</span>
                        {item.quantity && (
                          <span className="font-mono font-bold text-amber-400">
                            {item.quantity} {item.unit || ''}
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">General emergency relief requested</span>
                  )}
                </div>
              </div>

              {/* Government Dispatch Workflow Controls */}
              <div className="p-5 rounded-xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-purple-950/40 border border-blue-500/30 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <h4 className="text-sm font-bold text-white">Government Dispatch Coordination</h4>
                  </div>
                  <span className="text-xs text-slate-400">
                    Current Status: <strong className="text-blue-300">{formatStatusLabel(request.status)}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Government Reference # (e.g. TN-SDRF-2026-4421):
                    </label>
                    <input
                      type="text"
                      placeholder="Enter official agency reference code"
                      value={govtRef}
                      onChange={(e) => setGovtRef(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Admin Dispatch Notes:
                    </label>
                    <input
                      type="text"
                      placeholder="Add operational notes or responding team"
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-100 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Workflow Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
                  {request.status === 'NEW' && (
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleStatusChange('VERIFIED')}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition disabled:opacity-50"
                    >
                      Verify Request
                    </button>
                  )}

                  {['NEW', 'VERIFIED'].includes(request.status) && (
                    <button
                      disabled={isSubmitting || !govtRef.trim()}
                      onClick={() => handleStatusChange('FORWARDED_TO_GOVERNMENT')}
                      className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow transition disabled:opacity-50 flex items-center space-x-1.5"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Forward to Government</span>
                    </button>
                  )}

                  {request.status === 'FORWARDED_TO_GOVERNMENT' && (
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleStatusChange('ACCEPTED')}
                      className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition disabled:opacity-50"
                    >
                      Mark Accepted by Govt
                    </button>
                  )}

                  {['ACCEPTED', 'FORWARDED_TO_GOVERNMENT'].includes(request.status) && (
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleStatusChange('RESOURCE_ALLOCATED')}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow transition disabled:opacity-50 flex items-center space-x-1.5"
                    >
                      <Box className="w-3.5 h-3.5" />
                      <span>Allocate Resources</span>
                    </button>
                  )}

                  {request.status === 'RESOURCE_ALLOCATED' && (
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleStatusChange('DELIVERY_IN_PROGRESS')}
                      className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold shadow transition disabled:opacity-50 flex items-center space-x-1.5"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Mark Delivery in Progress</span>
                    </button>
                  )}

                  {request.status === 'DELIVERY_IN_PROGRESS' && (
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleStatusChange('DELIVERED')}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition disabled:opacity-50 flex items-center space-x-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Mark Delivered / Resolved</span>
                    </button>
                  )}

                  <button
                    disabled={isSubmitting}
                    onClick={() => handleStatusChange('REJECTED')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-900/60 text-slate-400 hover:text-red-300 text-xs font-medium transition disabled:opacity-50 ml-auto"
                  >
                    Reject Duplicate / Invalid
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Transcript Tab */}
          {activeTab === 'transcript' && (
            <div className="space-y-4">
              {request.callSession?.recording_url && (
                <div className="p-3.5 rounded-xl bg-slate-900 border border-cyan-500/30 text-xs space-y-2">
                  <span className="font-bold text-cyan-300 block flex items-center space-x-1.5">
                    <Volume2 className="w-4 h-4 text-cyan-400" />
                    <span>Authoritative Voice Call Recording</span>
                  </span>
                  <audio
                    controls
                    src={request.callSession.recording_url}
                    className="w-full h-8 rounded-lg bg-slate-950"
                  />
                </div>
              )}

              {request.callSession?.ai_summary && (
                <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-500/30 text-xs">
                  <span className="font-bold text-blue-300 block mb-1">AI Call Summary:</span>
                  <p className="text-slate-200">{request.callSession.ai_summary}</p>
                </div>
              )}

              <div className="space-y-3">
                {request.callSession?.transcript && Array.isArray(request.callSession.transcript) && request.callSession.transcript.length > 0 ? (
                  request.callSession.transcript.map((msg, i) => {
                    const isAssistant = msg.role === 'assistant';
                    return (
                      <div
                        key={i}
                        className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
                      >
                        <span className="text-[10px] text-slate-400 mb-0.5 px-1">
                          {isAssistant ? 'ResourceAI Agent' : `Caller (${request.caller_language})`}
                        </span>
                        <div
                          className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${
                            isAssistant
                              ? 'bg-slate-900 border border-slate-700 text-slate-100 rounded-tl-sm'
                              : 'bg-blue-600 text-white rounded-tr-sm shadow-md'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400 text-center py-8">
                    No voice recording transcript available for this request (created via {request.source}).
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Timeline Tab */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {request.timeline && request.timeline.length > 0 ? (
                <div className="relative border-l-2 border-slate-800 ml-4 space-y-6 py-2">
                  {request.timeline.map((item) => (
                    <div key={item.id} className="relative pl-6">
                      <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-slate-950 border-2 border-blue-500" />
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">{item.title}</span>
                        <StatusBadge status={item.status} />
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{item.description}</p>
                      <div className="flex items-center space-x-3 text-[11px] text-slate-400 mt-1.5">
                        <span>Actor: <strong className="text-slate-300">{item.actor}</strong></span>
                        {item.government_reference && (
                          <span>Govt Ref: <strong className="text-purple-400 font-mono">{item.government_reference}</strong></span>
                        )}
                        <span>{formatDate(item.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-8">No timeline entries yet.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
