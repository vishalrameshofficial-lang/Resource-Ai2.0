import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Send,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  WifiOff,
  RefreshCw,
  Clock,
  Phone,
  Languages,
  Users
} from 'lucide-react';
import { emergencyQueue, QueuedEmergencyRequest } from '../../lib/emergencyQueue';

export function CitizenIntakeForm() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    language: 'Tamil',
    category: 'flood',
    location: '',
    landmark: '',
    affectedPeople: 1,
    description: '',
    urgency: 'HIGH',
    immediateDanger: false,
    selectedResources: ['Food & Meals', 'Drinking Water']
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [queue, setQueue] = useState<QueuedEmergencyRequest[]>([]);
  const [lastSubmittedId, setLastSubmittedId] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    const unsubscribe = emergencyQueue.subscribe((updatedQueue) => {
      setQueue(updatedQueue);
    });
    return unsubscribe;
  }, []);

  const resourceOptions = [
    'Food & Meals',
    'Drinking Water',
    'Rescue Boat',
    'Medical First Aid',
    'Tarpaulin & Shelter',
    'Emergency Evacuation',
    'Blankets / Clothing'
  ];

  const toggleResource = (item: string) => {
    setFormData((prev) => ({
      ...prev,
      selectedResources: prev.selectedResources.includes(item)
        ? prev.selectedResources.filter((r) => r !== item)
        : [...prev.selectedResources, item]
    }));
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        if (!formData.location) {
          setFormData((prev) => ({
            ...prev,
            location: `GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
          }));
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err.message);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.phone || !formData.location) {
      alert('Please fill in your phone number and location.');
      return;
    }

    setIsSubmitting(true);

    const payload = {
      name: formData.name || 'Citizen User',
      phone: formData.phone,
      language: formData.language,
      category: formData.category,
      location: formData.location,
      landmark: formData.landmark || null,
      latitude: gpsCoords?.lat || null,
      longitude: gpsCoords?.lng || null,
      affectedPeople: Number(formData.affectedPeople) || 1,
      description: formData.description || `Emergency assistance needed in ${formData.location}`,
      urgency: formData.urgency,
      immediateDanger: formData.immediateDanger,
      requirements: formData.selectedResources.map((r) => ({
        item: r,
        quantity: formData.affectedPeople,
        unit: 'units'
      })),
      source: 'WEB'
    };

    try {
      const queuedItem = await emergencyQueue.enqueue(payload);
      setLastSubmittedId(queuedItem.tempId);
      // Reset form
      setFormData({
        name: '',
        phone: '',
        language: 'Tamil',
        category: 'flood',
        location: '',
        landmark: '',
        affectedPeople: 1,
        description: '',
        urgency: 'HIGH',
        immediateDanger: false,
        selectedResources: ['Food & Meals', 'Drinking Water']
      });
      setGpsCoords(null);
    } catch (err: any) {
      alert(`Submission error: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-900/60 via-indigo-900/50 to-slate-900 border border-blue-500/40 text-center space-y-4 shadow-2xl">
        <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-400/40 mx-auto flex items-center justify-center text-blue-400">
          <ShieldAlert className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Citizen Emergency Assistance Intake
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto mt-1">
            Need immediate disaster assistance? Fill out this emergency form or call our 24/7 AI helpline directly.
            Web submissions work <strong className="text-emerald-400">even if offline</strong>.
          </p>
        </div>

        {/* Prominent Direct Phone Helpline Callout */}
        <div className="max-w-2xl mx-auto p-4 rounded-xl bg-slate-950/80 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-left shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Phone className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Prefer to speak by phone?</span>
              <span className="text-[11px] text-slate-400 block">Multilingual AI voice assistance in 8 Indian languages</span>
            </div>
          </div>

          <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-between sm:justify-end">
            <span className="font-mono text-sm sm:text-base font-black text-emerald-400 tracking-wide">
              +91 44 4761 5477
            </span>
            <a
              href="tel:+914447615477"
              aria-label="Call Emergency Support at +91 44 4761 5477"
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] border border-emerald-400/40 whitespace-nowrap"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call Emergency Support</span>
            </a>
          </div>
        </div>
      </div>

      {/* Offline Queue Status Tray */}
      {queue.length > 0 && (
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/40 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-amber-300 flex items-center space-x-2">
              <WifiOff className="w-4 h-4 text-amber-400" />
              <span>Offline & In-Flight Dispatch Queue ({queue.length} items)</span>
            </h4>
            <button
              onClick={() => emergencyQueue.processQueue()}
              className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-semibold flex items-center space-x-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry Sync</span>
            </button>
          </div>

          <div className="space-y-2">
            {queue.map((item) => (
              <div
                key={item.tempId}
                className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="font-semibold text-slate-200">
                    {item.payload.location} ({item.payload.category})
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Queued: {new Date(item.queuedAt).toLocaleTimeString()} · Attempts: {item.attempts}
                  </div>
                </div>

                <div>
                  {item.deliveryStatus === 'CONFIRMED' ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirmed: {item.confirmedRequestId}</span>
                    </span>
                  ) : item.deliveryStatus === 'SYNCING' ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[11px]">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Syncing with ResourceAI...</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold text-[11px]">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Saved locally — waiting for network</span>
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Intake Form */}
      <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Caller Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Your Name (Optional):
            </label>
            <input
              type="text"
              placeholder="e.g. Ramesh Kumar"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Caller Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Contact Phone Number <span className="text-red-400">*</span>:
            </label>
            <input
              type="tel"
              required
              placeholder="e.g. +91 98765 43210"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Language Preference */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Preferred Language:
            </label>
            <select
              value={formData.language}
              onChange={(e) => setFormData({ ...formData, language: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            >
              {['English', 'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Bengali', 'Odia'].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Emergency Category:
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 capitalize focus:outline-none focus:border-blue-500"
            >
              <option value="flood">Flood</option>
              <option value="landslide">Landslide</option>
              <option value="cyclone">Cyclone / Storm</option>
              <option value="medical">Medical Emergency</option>
              <option value="building_collapse">Building Collapse</option>
              <option value="fire">Fire Incident</option>
              <option value="other">Other Crisis</option>
            </select>
          </div>
        </div>

        {/* Location & Landmark with GPS Auto-locate */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-300">
                Current Location / Area <span className="text-red-400">*</span>:
              </label>
              <button
                type="button"
                onClick={handleGetLocation}
                disabled={isLocating}
                className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center space-x-1"
              >
                <MapPin className="w-3 h-3" />
                <span>{isLocating ? 'Locating...' : 'Use My GPS'}</span>
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="e.g. Kurukkuthoorai, Tirunelveli"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nearby Landmark:
            </label>
            <input
              type="text"
              placeholder="e.g. Near Murugan Temple Ghat"
              value={formData.landmark}
              onChange={(e) => setFormData({ ...formData, landmark: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Number of affected people & Urgency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Number of People Affected / Stranded:
            </label>
            <input
              type="number"
              min="1"
              max="5000"
              value={formData.affectedPeople}
              onChange={(e) => setFormData({ ...formData, affectedPeople: parseInt(e.target.value, 10) || 1 })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Urgency Level:
            </label>
            <select
              value={formData.urgency}
              onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-blue-500"
            >
              <option value="CRITICAL">CRITICAL (Life-Threatening / Trapped)</option>
              <option value="HIGH">HIGH (Severe Flood / Rising Water)</option>
              <option value="MEDIUM">MEDIUM (Needs Food & Water within 24h)</option>
              <option value="LOW">LOW (General Inquiry / Stable)</option>
            </select>
          </div>
        </div>

        {/* Resources Needed Checkboxes */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-2">
            Resources Needed:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {resourceOptions.map((res) => {
              const isSelected = formData.selectedResources.includes(res);
              return (
                <button
                  type="button"
                  key={res}
                  onClick={() => toggleResource(res)}
                  className={`p-2 rounded-xl text-xs font-medium border text-left transition ${
                    isSelected
                      ? 'bg-blue-600/30 border-blue-500 text-blue-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {res}
                </button>
              );
            })}
          </div>
        </div>

        {/* Immediate Danger Checkbox */}
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center space-x-3">
          <input
            type="checkbox"
            id="immediateDanger"
            checked={formData.immediateDanger}
            onChange={(e) => setFormData({ ...formData, immediateDanger: e.target.checked })}
            className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
          />
          <label htmlFor="immediateDanger" className="text-xs text-red-200 font-semibold cursor-pointer">
            Immediate life-threatening danger exists (e.g. rising water rapidly entering, trapped under debris).
          </label>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1">
            Brief Description of Emergency:
          </label>
          <textarea
            rows={3}
            placeholder="Describe what happened, water level, current safety, or specific instructions for rescue responders..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-100 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-600/20 transition flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
          <span>{isSubmitting ? 'Recording Emergency...' : 'Submit Emergency Assistance Request'}</span>
        </button>
      </form>
    </div>
  );
}
