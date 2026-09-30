import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { EmergencyRequest } from '../../types/emergency';
import { UrgencyBadge, StatusBadge } from '../common/Badge';

interface EmergencyMapProps {
  requests: EmergencyRequest[];
  onSelectRequest: (request: EmergencyRequest) => void;
}

export function EmergencyMap({ requests, onSelectRequest }: EmergencyMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Filter requests that have valid non-null coordinates
  const validRequests = requests.filter(
    (r) => typeof r.latitude === 'number' && typeof r.longitude === 'number'
  );

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default center around India disaster coordinates (e.g. 20.5937, 78.9629)
      const map = L.map(mapContainerRef.current, {
        center: [17.5, 78.5],
        zoom: 5,
        attributionControl: false
      });

      // Dark theme map tiles
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(map);

      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!markersLayer) return;

    markersLayer.clearLayers();

    const bounds = L.latLngBounds([]);

    validRequests.forEach((req) => {
      const lat = req.latitude!;
      const lng = req.longitude!;
      bounds.extend([lat, lng]);

      // Urgency color determination
      let color = '#3b82f6';
      if (req.urgency === 'CRITICAL') color = '#ef4444';
      else if (req.urgency === 'HIGH') color = '#f97316';
      else if (req.urgency === 'MEDIUM') color = '#eab308';
      else if (req.urgency === 'LOW') color = '#10b981';

      // Custom pulse HTML icon
      const customIcon = L.divIcon({
        className: 'custom-emergency-pin',
        html: `
          <div style="position: relative; width: 24px; height: 24px;">
            <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: ${color}; opacity: 0.3; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: absolute; top: 4px; left: 4px; width: 16px; height: 16px; border-radius: 50%; background-color: ${color}; border: 2px solid white; box-shadow: 0 0 10px ${color};"></div>
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      const popupContent = `
        <div style="font-family: sans-serif; padding: 4px; min-width: 180px;">
          <div style="font-weight: 800; font-size: 13px; color: #60a5fa; margin-bottom: 4px;">${req.request_id}</div>
          <div style="font-size: 12px; font-weight: 600; color: #f8fafc; margin-bottom: 2px;">${req.location}</div>
          <div style="font-size: 11px; color: #94a3b8; text-transform: capitalize; margin-bottom: 6px;">Category: ${req.emergency_category}</div>
          <div style="display: flex; gap: 4px; margin-bottom: 6px;">
            <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(59,130,246,0.2); color: #93c5fd;">${req.affected_people_count} People</span>
            <span style="font-size: 10px; padding: 2px 6px; border-radius: 4px; background: rgba(239,68,68,0.2); color: #fca5a5;">${req.urgency}</span>
          </div>
          <div style="font-size: 10px; color: #38bdf8; font-weight: 500;">Status: ${req.status}</div>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on('click', () => {
        onSelectRequest(req);
      });

      markersLayer.addLayer(marker);
    });

    if (validRequests.length > 0 && map) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [validRequests.length]);

  return (
    <div className="relative w-full h-full min-h-[500px] rounded-2xl overflow-hidden border border-slate-800 glass-panel">
      <div ref={mapContainerRef} className="w-full h-full min-h-[500px]" />

      {/* Floating Map Legend */}
      <div className="absolute top-4 right-4 z-[1000] p-3 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-xs shadow-xl space-y-2">
        <h5 className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
          Urgency Legend
        </h5>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
          <span className="text-slate-300">Critical ({requests.filter((r) => r.urgency === 'CRITICAL').length})</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
          <span className="text-slate-300">High ({requests.filter((r) => r.urgency === 'HIGH').length})</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-yellow-400 shadow-sm shadow-yellow-400/50" />
          <span className="text-slate-300">Medium ({requests.filter((r) => r.urgency === 'MEDIUM').length})</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
          <span className="text-slate-300">Low ({requests.filter((r) => r.urgency === 'LOW').length})</span>
        </div>
        <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400">
          Showing {validRequests.length} geo-tagged of {requests.length} total
        </div>
      </div>
    </div>
  );
}
