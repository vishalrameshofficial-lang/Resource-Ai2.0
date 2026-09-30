import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  Clock,
  Shield,
  PhoneCall,
  Users,
  CheckCircle,
  Truck,
  Building2,
  RefreshCw,
  Bell
} from 'lucide-react';
import { AuthProvider } from './hooks/useAuth';
import { useRealtimeEvents, RealtimeEvent } from './hooks/useRealtimeEvents';
import { api } from './lib/api';
import { EmergencyRequest, DashboardStats, ActiveLiveCall } from './types/emergency';

// UI Components
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { StatCard } from './components/dashboard/StatCard';
import { CategoryChart, StatusChart } from './components/dashboard/CategoryChart';
import { LiveCallsBanner } from './components/dashboard/LiveCallsBanner';
import { RequestTable } from './components/requests/RequestTable';
import { RequestDetailModal } from './components/requests/RequestDetailModal';
import { EmergencyMap } from './components/map/EmergencyMap';
import { LiveCallsView } from './components/calls/LiveCallsView';
import { GovernmentDispatchView } from './components/government/GovernmentDispatchView';
import { ExotelConfigGuide } from './components/voice/ExotelConfigGuide';
import { CitizenIntakeForm } from './components/citizen/CitizenIntakeForm';
import { SettingsView } from './components/settings/SettingsView';

function AppContent() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [requests, setRequests] = useState<EmergencyRequest[]>([]);
  const [activeCalls, setActiveCalls] = useState<ActiveLiveCall[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<EmergencyRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);

  // Load all dashboard data
  const fetchData = useCallback(async () => {
    try {
      const [statsData, reqsData, callsData] = await Promise.all([
        api.getStats(),
        api.getRequests(),
        api.getActiveCalls()
      ]);
      setStats(statsData);
      setRequests(reqsData);
      setActiveCalls(callsData);
    } catch (err) {
      console.warn('Dashboard fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time Server-Sent Events listener
  const handleRealtimeEvent = useCallback(
    (event: RealtimeEvent) => {
      console.log('[SSE Event Received]', event.type, event.data);

      if (event.type === 'NEW_REQUEST') {
        const newReq: EmergencyRequest = event.data;
        setRequests((prev) => [newReq, ...prev.filter((r) => r.id !== newReq.id)]);
        setNotification(`🚨 NEW EMERGENCY: ${newReq.request_id} recorded in ${newReq.location}!`);
        // Refresh stats
        api.getStats().then(setStats);
      } else if (event.type === 'REQUEST_UPDATED') {
        const updatedReq: EmergencyRequest = event.data;
        setRequests((prev) =>
          prev.map((r) => (r.id === updatedReq.id ? updatedReq : r))
        );
        if (selectedRequest && selectedRequest.id === updatedReq.id) {
          setSelectedRequest(updatedReq);
        }
        api.getStats().then(setStats);
      } else if (event.type === 'CALL_STARTED' || event.type === 'CALL_UPDATED') {
        api.getActiveCalls().then(setActiveCalls);
      } else if (event.type === 'CALL_ENDED' || event.type === 'CALL_COMPLETED') {
        api.getActiveCalls().then(setActiveCalls);
        fetchData();
      }
    },
    [selectedRequest, fetchData]
  );

  const { isConnected: isRealtimeConnected } = useRealtimeEvents(handleRealtimeEvent);

  // Auto-dismiss notification toast
  useEffect(() => {
    if (notification) {
      const t = setTimeout(() => setNotification(null), 6000);
      return () => clearTimeout(t);
    }
  }, [notification]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isRealtimeConnected={isRealtimeConnected}
        liveCallsCount={activeCalls.length}
      />

      {/* Real-time Notification Banner */}
      {notification && (
        <div className="bg-gradient-to-r from-red-600 to-amber-600 text-white px-6 py-2.5 text-xs font-bold flex items-center justify-between shadow-lg animate-bounce">
          <div className="flex items-center space-x-2">
            <Bell className="w-4 h-4" />
            <span>{notification}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-white/80 hover:text-white font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Layout Container */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left SaaS Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          liveCallsCount={activeCalls.length}
          newRequestsCount={stats?.newRequests || 0}
        />

        {/* Central Content Area */}
        <main className="flex-1 p-6 overflow-y-auto max-h-[calc(100vh-61px)]">
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              {/* Prominent Emergency Hotline Banner with Call Emergency Support Button */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-red-950/70 via-slate-900/90 to-blue-950/70 border border-red-500/40 shadow-xl shadow-red-950/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3.5">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 shadow-inner">
                      <PhoneCall className="w-6 h-6 animate-bounce" />
                    </div>
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-950 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base sm:text-lg font-black text-white tracking-tight">
                        24/7 AI Disaster Helpline
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/30 text-[10px] font-bold uppercase tracking-wider">
                        EXOTEL TELEPHONY
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Immediate multilingual voice assistance for stranded citizens and rescue teams.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
                  <div className="text-left sm:text-right">
                    <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium block">
                      Helpline Number:
                    </span>
                    <span className="text-base sm:text-lg font-black font-mono text-emerald-400 tracking-wide">
                      +91 44 4761 5477
                    </span>
                  </div>

                  <a
                    href="tel:+914447615477"
                    aria-label="Call Emergency Support at +91 44 4761 5477"
                    className="w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-red-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] border border-red-400/40"
                  >
                    <PhoneCall className="w-4 h-4 text-white" />
                    <span>Call Emergency Support</span>
                  </a>
                </div>
              </div>

              {/* Active Voice Calls Banner */}
              <LiveCallsBanner
                calls={activeCalls}
                onViewCalls={() => setActiveTab('calls')}
              />

              {/* 6 Key Performance Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <StatCard
                  title="Total Requests"
                  value={stats?.total ?? requests.length}
                  subtitle="Recorded across all channels"
                  icon={AlertTriangle}
                  color="blue"
                  onClick={() => setActiveTab('requests')}
                />
                <StatCard
                  title="New Requests"
                  value={stats?.newRequests ?? 0}
                  subtitle="Awaiting relief officer review"
                  icon={Clock}
                  color="red"
                  badge="NEEDS TRIAGE"
                  onClick={() => setActiveTab('requests')}
                />
                <StatCard
                  title="High Urgency"
                  value={stats?.highUrgency ?? 0}
                  subtitle="High / Critical severity"
                  icon={Shield}
                  color="amber"
                  onClick={() => setActiveTab('requests')}
                />
                <StatCard
                  title="Active Emergencies"
                  value={stats?.activeEmergencies ?? 0}
                  subtitle="In-flight relief operations"
                  icon={Users}
                  color="purple"
                  onClick={() => setActiveTab('requests')}
                />
                <StatCard
                  title="Govt Pending"
                  value={stats?.governmentPending ?? 0}
                  subtitle="Disaster agencies assigned"
                  icon={Building2}
                  color="cyan"
                  onClick={() => setActiveTab('dispatch')}
                />
                <StatCard
                  title="Delivered"
                  value={stats?.delivered ?? 0}
                  subtitle="Resolved relief operations"
                  icon={CheckCircle}
                  color="emerald"
                  onClick={() => setActiveTab('requests')}
                />
              </div>

              {/* Middle Row: Visual Analytics Progress Charts & Quick Map */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <CategoryChart
                  title="Disaster Category Breakdown"
                  data={stats?.byCategory || []}
                  total={stats?.total || 1}
                />
                <StatusChart
                  title="Relief Dispatch Pipeline"
                  data={stats?.byStatus || []}
                  total={stats?.total || 1}
                />

                {/* Quick Map Widget */}
                <div className="glass-panel p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-slate-200">
                      Disaster Heatmap Preview
                    </h4>
                    <button
                      onClick={() => setActiveTab('map')}
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                    >
                      Expand Map →
                    </button>
                  </div>
                  <div className="flex-1 min-h-[220px] rounded-xl overflow-hidden">
                    <EmergencyMap
                      requests={requests.slice(0, 10)}
                      onSelectRequest={(r) => setSelectedRequest(r)}
                    />
                  </div>
                </div>
              </div>

              {/* Recent Emergency Requests Table */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-extrabold text-white">
                    Recent Emergency Incidents
                  </h3>
                  <button
                    onClick={() => setActiveTab('requests')}
                    className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                  >
                    View All {requests.length} Requests →
                  </button>
                </div>
                <RequestTable
                  requests={requests.slice(0, 6)}
                  onSelectRequest={(r) => setSelectedRequest(r)}
                  isLoading={isLoading}
                />
              </div>
            </div>
          )}

          {/* TAB 2: ALL EMERGENCY REQUESTS */}
          {activeTab === 'requests' && (
            <div className="space-y-4 max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-extrabold text-white">
                    Emergency Assistance Requests
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Filter, inspect, verify, and escalate citizen crisis reports from Phone and Web channels.
                  </p>
                </div>
                <button
                  onClick={fetchData}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center space-x-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
              </div>

              <RequestTable
                requests={requests}
                onSelectRequest={(r) => setSelectedRequest(r)}
                isLoading={isLoading}
              />
            </div>
          )}

          {/* TAB 3: LIVE CALLS */}
          {activeTab === 'calls' && (
            <div className="max-w-7xl mx-auto">
              <LiveCallsView
                activeCalls={activeCalls}
                onOpenSimulator={() => setActiveTab('simulator')}
              />
            </div>
          )}

          {/* TAB 4: DISASTER MAP */}
          {activeTab === 'map' && (
            <div className="space-y-4 max-w-7xl mx-auto h-[calc(100vh-120px)] flex flex-col">
              <div className="flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-xl font-extrabold text-white">
                    Geographic Disaster Map
                  </h2>
                  <p className="text-xs text-slate-400">
                    Real-time geo-located emergency incident clusters and relief distribution points.
                  </p>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {requests.filter((r) => r.latitude).length} Geo-tagged Incidents
                </span>
              </div>
              <div className="flex-1 min-h-[500px]">
                <EmergencyMap
                  requests={requests}
                  onSelectRequest={(r) => setSelectedRequest(r)}
                />
              </div>
            </div>
          )}

          {/* TAB 5: GOVERNMENT DISPATCH WORKFLOW */}
          {activeTab === 'dispatch' && (
            <div className="max-w-7xl mx-auto">
              <GovernmentDispatchView
                requests={requests}
                onSelectRequest={(r) => setSelectedRequest(r)}
                onRefresh={fetchData}
              />
            </div>
          )}

          {/* TAB 6: TELEPHONY & EXOTEL INTEGRATION */}
          {activeTab === 'simulator' && (
            <div className="space-y-6 max-w-7xl mx-auto">
              <ExotelConfigGuide />
            </div>
          )}

          {/* TAB 7: CITIZEN INTAKE PORTAL */}
          {activeTab === 'citizen' && (
            <div className="max-w-7xl mx-auto">
              <CitizenIntakeForm />
            </div>
          )}

          {/* TAB 8: SETTINGS & ARCHITECTURE */}
          {activeTab === 'settings' && (
            <div className="max-w-7xl mx-auto">
              <SettingsView />
            </div>
          )}
        </main>
      </div>

      {/* Request Detail Modal */}
      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onUpdated={(updated) => {
            setSelectedRequest(updated);
            setRequests((prev) =>
              prev.map((r) => (r.id === updated.id ? updated : r))
            );
            api.getStats().then(setStats);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
