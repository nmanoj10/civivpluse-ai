import React, { useEffect, useRef, useState } from 'react';
import { 
  Map, Filter, ShieldCheck, Activity, Locate, 
  Search, Info, AlertTriangle, Layers, Sliders 
} from 'lucide-react';

declare const L: any; // global Leaflet object from CDN

interface MapLandmark {
  name: string;
  type: string;
  distance: number;
  lat: number;
  lng: number;
}

interface MapIssue {
  _id: string;
  title: string;
  status: string;
  priorityScore?: number;
  severity?: string;
  trustScore?: number;
  supportCount?: number;
  rejectCount?: number;
  reportedCategory?: string;
  category?: string;
  thumbnail?: string;
  previewUrl?: string;
  location: { 
    lat: number; 
    lng: number; 
    address?: string;
    ward?: string;
    taluk?: string;
    district?: string;
  };
  description?: string;
  assignedOfficer?: any;
  mergedDuplicates?: any[];
}

interface LeafletMapProps {
  center: [number, number];
  zoom?: number;
  issues?: MapIssue[];
  landmarks?: MapLandmark[];
  jurisdictionRadius?: number; // in meters
  heatmapMode?: boolean;
  className?: string;
  onMarkerClick?: (issueId: string) => void;
  showDashboard?: boolean; // new prop to display filters and AI insights
}

export default function LeafletMap({
  center,
  zoom = 13,
  issues = [],
  landmarks = [],
  jurisdictionRadius,
  heatmapMode = false,
  className = '',
  onMarkerClick,
  showDashboard = false
}: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersGroupRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const heatLayerRef = useRef<any>(null);
  const radiusCircleRef = useRef<any>(null);

  // Dashboard state controls
  const [isHeatmap, setIsHeatmap] = useState(heatmapMode);
  const [showMarkers, setShowMarkers] = useState(true);
  const [useClustering, setUseClustering] = useState(true);
  const [tileType, setTileType] = useState<'road' | 'satellite'>('road');
  const [drawRadiusActive, setDrawRadiusActive] = useState(false);
  const [radiusMeters, setRadiusMeters] = useState(1000);
  const [radiusCenter, setRadiusCenter] = useState<[number, number] | null>(null);

  // Sidebar dynamic filters state
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterWard, setFilterWard] = useState('');
  const [filterTaluk, setFilterTaluk] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || typeof L === 'undefined') return;

    // Create Leaflet Map Instance
    mapInstanceRef.current = L.map(mapContainerRef.current).setView(center, zoom);

    // Add native fullscreen support if control is present from CDN
    if (typeof L.control.fullscreen === 'function') {
      mapInstanceRef.current.addControl(L.control.fullscreen({
        position: 'topleft',
        title: 'View Fullscreen',
        titleCancel: 'Exit Fullscreen'
      }));
    }

    // Group layer for all items
    markersGroupRef.current = L.featureGroup().addTo(mapInstanceRef.current);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Handle map base layer tile switching
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof L === 'undefined') return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (tileType === 'satellite') {
      tileLayerRef.current = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; GIS User Community',
        maxZoom: 19
      });
    } else {
      // Light premium road view matching the white/light theme
      tileLayerRef.current = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
      });
    }

    tileLayerRef.current.addTo(map);
  }, [tileType]);

  // 3. Update center view
  useEffect(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView(center, zoom);
    }
  }, [center, zoom]);

  // 4. Locate user handler
  const handleLocateUser = () => {
    const map = mapInstanceRef.current;
    if (!map) return;
    map.locate({ setView: true, maxZoom: 16 });
    map.once('locationfound', (e: any) => {
      L.marker(e.latlng, {
        icon: L.divIcon({
          html: `<div style="font-size: 24px; animation: pulse 2s infinite;">🔵</div>`,
          className: '',
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      })
      .bindPopup('Your Current Location')
      .addTo(map);
    });
    map.once('locationerror', () => {
      alert('Could not locate user position.');
    });
  };

  // 5. Dynamic issues filter computation
  const filteredIssues = issues.filter(issue => {
    const cat = issue.reportedCategory || issue.category || '';
    if (filterCategory && cat !== filterCategory) return false;
    
    if (filterStatus && issue.status !== filterStatus) return false;
    
    const sev = issue.severity || 'LOW';
    if (filterSeverity && sev.toUpperCase() !== filterSeverity.toUpperCase()) return false;
    
    const ward = issue.location?.ward || '';
    if (filterWard && ward !== filterWard) return false;
    
    const taluk = issue.location?.taluk || '';
    if (filterTaluk && taluk !== filterTaluk) return false;
    
    const district = issue.location?.district || '';
    if (filterDistrict && district !== filterDistrict) return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const titleMatch = (issue.title || '').toLowerCase().includes(q);
      const descMatch = (issue.description || '').toLowerCase().includes(q);
      const addrMatch = (issue.location?.address || '').toLowerCase().includes(q);
      if (!titleMatch && !descMatch && !addrMatch) return false;
    }

    return true;
  });

  // Helper config for status colors
  const getStatusColor = (status: string, severity?: string) => {
    const s = status.toUpperCase();
    if (s.includes('RESOLVED') || s.includes('CLOSED')) return '#3b82f6'; // Blue
    
    const sev = (severity || '').toUpperCase();
    if (sev === 'CRITICAL') return '#ef4444'; // Red
    if (sev === 'HIGH') return '#f97316'; // Orange
    if (sev === 'MEDIUM') return '#eab308'; // Yellow
    return '#10b981'; // Green (Low)
  };

  // Helper for landmark config
  const getLandmarkConfig = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('hospital')) return { color: '#ef4444', emoji: '🏥' };
    if (t.includes('school')) return { color: '#f59e0b', emoji: '🏫' };
    if (t.includes('highway') || t.includes('motorway')) return { color: '#3b82f6', emoji: '🛣️' };
    return { color: '#a855f7', emoji: '📍' };
  };

  // Helper to compute GIS priority intensity score (0.0 to 1.0)
  const getIntensity = (issue: MapIssue) => {
    let base = 0.4;
    const sev = (issue.severity || '').toUpperCase();
    if (sev === 'CRITICAL') base += 0.3;
    else if (sev === 'HIGH') base += 0.2;
    else if (sev === 'MEDIUM') base += 0.1;

    const priority = issue.priorityScore || 50;
    base += (priority / 100) * 0.2;

    const supports = issue.supportCount || 0;
    base += Math.min(0.1, (supports / 10) * 0.1);

    if (issue.mergedDuplicates && issue.mergedDuplicates.length > 0) base += 0.1;

    const trust = issue.trustScore || 80;
    base += (trust / 100) * 0.1;

    return Math.min(1.0, base);
  };

  // 6. Draw Radius Scanner click listeners
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof L === 'undefined') return;

    const handleMapClick = (e: any) => {
      if (!drawRadiusActive) return;

      const clickLatLng = [e.latlng.lat, e.latlng.lng] as [number, number];
      setRadiusCenter(clickLatLng);

      if (radiusCircleRef.current) {
        map.removeLayer(radiusCircleRef.current);
      }

      radiusCircleRef.current = L.circle(e.latlng, {
        radius: radiusMeters,
        color: '#6366f1',
        fillColor: '#6366f1',
        fillOpacity: 0.1,
        weight: 1.5,
        dashArray: '5, 5'
      }).addTo(map);

      // Count issues in range
      const issuesInRange = filteredIssues.filter(issue => {
        const issueLatLng = L.latLng(issue.location.lat, issue.location.lng);
        const dist = e.latlng.distanceTo(issueLatLng);
        return dist <= radiusMeters;
      });

      alert(`GIS RADIUS SCANNER:\nFound ${issuesInRange.length} reported issues within ${radiusMeters} meters of coordinate.`);
      setDrawRadiusActive(false);
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, [drawRadiusActive, radiusMeters, filteredIssues]);

  // 7. Update Heatmap layer
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof L === 'undefined') return;

    if (heatLayerRef.current) {
      map.removeLayer(heatLayerRef.current);
      heatLayerRef.current = null;
    }

    if (isHeatmap) {
      const heatPoints = filteredIssues.map(issue => [
        issue.location.lat,
        issue.location.lng,
        getIntensity(issue)
      ]);

      if (typeof L.heatLayer === 'function') {
        heatLayerRef.current = L.heatLayer(heatPoints, {
          radius: 25,
          blur: 15,
          maxZoom: 17,
          gradient: {
            0.2: 'green',
            0.4: 'yellow',
            0.6: 'orange',
            0.8: 'red',
            1.0: 'darkred'
          }
        }).addTo(map);
      } else {
        console.warn('Leaflet HeatLayer library not available.');
      }
    }
  }, [isHeatmap, filteredIssues]);

  // 8. Update Markers Group & Clustering
  useEffect(() => {
    const map = mapInstanceRef.current;
    const group = markersGroupRef.current;
    if (!map || !group || typeof L === 'undefined') return;

    group.clearLayers();

    // Re-draw radius circle if active
    if (radiusCenter) {
      radiusCircleRef.current = L.circle(radiusCenter, {
        radius: radiusMeters,
        color: '#6366f1',
        fillColor: '#6366f1',
        fillOpacity: 0.1,
        weight: 1.5,
        dashArray: '5, 5'
      }).addTo(group);
    }

    if (jurisdictionRadius) {
      L.circle(center, {
        radius: jurisdictionRadius,
        color: '#6366f1',
        fillColor: '#6366f1',
        fillOpacity: 0.05,
        weight: 1.5,
        dashArray: '4, 4'
      }).addTo(group);
    }

    if (!showMarkers) return;

    const clusterGroup = L.markerClusterGroup ? L.markerClusterGroup({
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true
    }) : null;

    filteredIssues.forEach((issue) => {
      const color = getStatusColor(issue.status, issue.severity);
      const mediaUrl = issue.thumbnail || issue.previewUrl;
      
      const markerHtml = `
        <div style="
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background-color: ${color};
          border: 2px solid white;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 8px;
          font-weight: 900;
        ">CP</div>
      `;

      const icon = L.divIcon({
        html: markerHtml,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const popupContent = `
        <div style="color: #0f172a; font-family: system-ui, sans-serif; font-size: 11px; width: 220px; line-height: 1.4;">
          ${mediaUrl ? `<img src="${mediaUrl}" style="width: 100%; height: 110px; object-fit: cover; border-radius: 12px; margin-bottom: 8px;" />` : ''}
          <h4 style="margin: 0 0 6px; font-weight: 850; font-size: 12px; color: #1e293b;">${issue.title}</h4>
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 8px; font-weight: bold; background: #f1f5f9; color: #475569; text-transform: uppercase; margin-bottom: 6px;">
            ${issue.reportedCategory || issue.category || 'Other'}
          </span>
          <div style="space-y: 2px;">
            <p style="margin: 2px 0;"><strong>Status:</strong> <span style="color: ${color}; font-weight: 700;">${issue.status.replace(/_/g, ' ')}</span></p>
            <p style="margin: 2px 0;"><strong>Severity:</strong> ${issue.severity || 'LOW'}</p>
            <p style="margin: 2px 0;"><strong>Priority Score:</strong> ${issue.priorityScore || 45}/100</p>
            <p style="margin: 2px 0;"><strong>Trust Score:</strong> ${issue.trustScore || 80}/100</p>
            <p style="margin: 2px 0;"><strong>Supporters:</strong> 👍 ${issue.supportCount || 0}</p>
            <p style="margin: 2px 0;"><strong>Officer:</strong> ${issue.assignedOfficer?.name || issue.assignedOfficer || 'None Assigned'}</p>
          </div>
          <p style="margin: 6px 0 0; font-size: 9px; color: #64748b;">📍 ${issue.location?.address || 'Address unavailable'}</p>
        </div>
      `;

      const marker = L.marker([issue.location.lat, issue.location.lng], { icon })
        .bindPopup(popupContent);

      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(issue._id));
      }

      if (useClustering && clusterGroup) {
        clusterGroup.addLayer(marker);
      } else {
        marker.addTo(group);
      }
    });

    if (useClustering && clusterGroup) {
      group.addLayer(clusterGroup);
    }

    // Draw landmarks
    landmarks.forEach((lm) => {
      const config = getLandmarkConfig(lm.type);
      const lmIcon = L.divIcon({
        html: `<div style="font-size: 20px; text-shadow: 0px 2px 4px rgba(0,0,0,0.8);">${config.emoji}</div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      L.marker([lm.lat, lm.lng], { icon: lmIcon })
        .bindPopup(`
          <div style="color: #0f172a; font-family: sans-serif; font-size: 11px;">
            <strong>${config.emoji} ${lm.name}</strong><br/>
            Type: ${lm.type}<br/>
            Distance: ${lm.distance} meters away
          </div>
        `)
        .addTo(group);

      L.circle([lm.lat, lm.lng], {
        radius: 100,
        color: config.color,
        fillColor: config.color,
        fillOpacity: 0.05,
        weight: 0.8
      }).addTo(group);
    });

  }, [filteredIssues, landmarks, jurisdictionRadius, showMarkers, useClustering, radiusCenter, radiusMeters]);

  // 9. Hotspot analysis generation (Phase 7)
  const getHotspotInsights = () => {
    const counts: Record<string, { count: number, maxScore: number, issues: any[] }> = {};
    
    filteredIssues.forEach(issue => {
      const wardName = issue.location?.ward || 'General Jurisdiction';
      const cat = issue.reportedCategory || issue.category || 'Other';
      const key = `${wardName}::${cat}`;
      if (!counts[key]) {
        counts[key] = { count: 0, maxScore: 0, issues: [] };
      }
      counts[key].count += 1;
      const score = issue.priorityScore || 45;
      if (score > counts[key].maxScore) {
        counts[key].maxScore = score;
      }
      counts[key].issues.push(issue);
    });

    const list = Object.entries(counts).map(([key, data]) => {
      const [wardName, cat] = key.split('::');
      const avgScore = data.issues.reduce((sum, i) => sum + (i.priorityScore || 45), 0) / data.issues.length;
      const hotspotScore = Math.min(100, Math.round(avgScore + Math.log2(data.count) * 10));

      let recommendation = 'Routine surveillance scheduled.';
      if (cat.toLowerCase().includes('road') || cat.toLowerCase().includes('transport')) {
        recommendation = hotspotScore > 75 ? 'Immediate Civil Engineering Inspection & Asphalt Repair' : 'Road surfacing assessment scheduled.';
      } else if (cat.toLowerCase().includes('water') || cat.toLowerCase().includes('sanitation')) {
        recommendation = hotspotScore > 75 ? 'Emergency Hydro-Sanitation Crew dispatch & sewer inspection' : 'Water lines validation scheduled.';
      } else if (cat.toLowerCase().includes('waste') || cat.toLowerCase().includes('garbage')) {
        recommendation = hotspotScore > 75 ? 'Sanitation clearance vehicle reroute & cleanup order' : 'General waste collection audit.';
      } else if (cat.toLowerCase().includes('electr') || cat.toLowerCase().includes('light')) {
        recommendation = hotspotScore > 75 ? 'Emergency Power Grid maintenance & transformer swap' : 'Line continuity checks scheduled.';
      }

      return {
        ward: wardName,
        category: cat,
        reports: data.count,
        score: hotspotScore,
        recommendation
      };
    });

    return list.sort((a, b) => b.score - a.score).slice(0, 3);
  };

  const hotspots = getHotspotInsights();

  // Unified rendering container
  const mapElement = (
    <div className="relative">
      <div
        ref={mapContainerRef}
        className={`rounded-2xl border border-slate-200/60 shadow-inner overflow-hidden ${className}`}
        style={{ height: '480px', background: '#f8fafc' }}
      />

      {/* Overlay Toolbar Controls */}
      <div className="absolute top-3 left-12 z-[1000] bg-white/95 backdrop-blur-md px-3 py-2 rounded-2xl border border-slate-200 shadow-lg flex flex-wrap gap-2.5 text-xs font-bold text-slate-700 max-w-[85%]">
        <select 
          value={tileType}
          onChange={(e) => setTileType(e.target.value as any)}
          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
        >
          <option value="road">Road Map</option>
          <option value="satellite">Satellite Imagery</option>
        </select>

        <label className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-650">
          <input type="checkbox" checked={isHeatmap} onChange={(e) => setIsHeatmap(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-350" />
          <span>Heatmap</span>
        </label>

        <label className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-650">
          <input type="checkbox" checked={showMarkers} onChange={(e) => setShowMarkers(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-350" />
          <span>Markers</span>
        </label>

        <label className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-650">
          <input type="checkbox" checked={useClustering} onChange={(e) => setUseClustering(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500 border-slate-350" />
          <span>Cluster</span>
        </label>

        <button 
          onClick={handleLocateUser}
          className="px-2.5 py-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg flex items-center gap-1 transition-all cursor-pointer"
        >
          <Locate className="w-3.5 h-3.5" /> Locate
        </button>

        <button 
          onClick={() => setDrawRadiusActive(!drawRadiusActive)}
          className={`px-2.5 py-1 border rounded-lg flex items-center gap-1 transition-all cursor-pointer ${
            drawRadiusActive ? 'bg-indigo-600 text-white border-indigo-655' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
          }`}
        >
          Draw Radius ({radiusMeters}m)
        </button>
      </div>

      {/* Radius setting slider (visible when draw radius is selected) */}
      {drawRadiusActive && (
        <div className="absolute top-16 left-12 z-[1000] bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200 shadow-lg text-[10px] font-bold text-slate-700 w-48 space-y-2">
          <div className="flex justify-between">
            <span>Scan Distance</span>
            <span>{radiusMeters}m</span>
          </div>
          <input 
            type="range" 
            min="200" 
            max="3000" 
            step="100" 
            value={radiusMeters} 
            onChange={(e) => setRadiusMeters(Number(e.target.value))}
            className="w-full cursor-pointer accent-indigo-600" 
          />
          <p className="text-[8px] text-slate-450 mt-1 leading-snug">Toggle active. Now click anywhere on map coordinate canvas to scan.</p>
        </div>
      )}

      {/* Legend Overlay */}
      <div className="absolute bottom-4 right-4 z-[1000] bg-white/95 backdrop-blur-md p-3.5 rounded-2xl border border-slate-200 shadow-lg text-[10px] font-bold text-slate-700 space-y-2 select-none">
        <div className="border-b border-slate-100 pb-1.5">
          <span className="uppercase text-[8px] text-slate-400 font-extrabold block tracking-wider">Map Legend</span>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] border border-white" /> <span>Critical</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f97316] border border-white" /> <span>High</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#eab308] border border-white" /> <span>Medium</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#10b981] border border-white" /> <span>Low</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] border border-white" /> <span>Resolved</span></div>
        </div>
        {isHeatmap && (
          <div className="border-t border-slate-100 pt-1.5">
            <span className="uppercase text-[8px] text-slate-400 font-extrabold block tracking-wider mb-1">Density Heat Scale</span>
            <div className="h-2 w-full rounded bg-gradient-to-r from-green-500 via-yellow-400 via-orange-500 to-red-650" />
          </div>
        )}
      </div>
    </div>
  );

  // Default rendering for simple/preview usage
  if (!showDashboard) {
    return mapElement;
  }

  // Dashboard layout rendering (Side filters & AI Hotspots)
  return (
    <div className="grid lg:grid-cols-12 gap-8 items-start">
      {/* Left side: Map canvas */}
      <div className="lg:col-span-8 space-y-4">
        {mapElement}
      </div>

      {/* Right side: Filters sidebar & Hotspot insights */}
      <div className="lg:col-span-4 space-y-6">
        {/* Interactive Filters Panel */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            GIS Map Filters
          </h3>

          <div className="space-y-3.5 text-[11px] font-bold text-slate-600">
            <div>
              <label className="block text-[9px] text-slate-400 uppercase font-extrabold tracking-wider mb-1.5">Search Text</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter by title/address..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] text-slate-400 uppercase font-extrabold tracking-wider mb-1.5">Category</label>
                <select 
                  value={filterCategory} 
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-2.5 focus:outline-none cursor-pointer"
                >
                  <option value="">All Categories</option>
                  <option value="Road & Transport">Road & Transport</option>
                  <option value="Water & Sanitation">Water & Sanitation</option>
                  <option value="Waste Management">Waste Management</option>
                  <option value="Electrical & Lighting">Electrical & Lighting</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[9px] text-slate-400 uppercase font-extrabold tracking-wider mb-1.5">Severity</label>
                <select 
                  value={filterSeverity} 
                  onChange={(e) => setFilterSeverity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-2.5 focus:outline-none cursor-pointer"
                >
                  <option value="">All Severity</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] text-slate-400 uppercase font-extrabold tracking-wider mb-1.5">District</label>
                <input 
                  type="text" 
                  value={filterDistrict} 
                  onChange={(e) => setFilterDistrict(e.target.value)}
                  placeholder="e.g. Bangalore"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-2.5 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] text-slate-400 uppercase font-extrabold tracking-wider mb-1.5">Taluk</label>
                <input 
                  type="text" 
                  value={filterTaluk} 
                  onChange={(e) => setFilterTaluk(e.target.value)}
                  placeholder="e.g. South"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-2.5 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] text-slate-400 uppercase font-extrabold tracking-wider mb-1.5">Ward</label>
                <input 
                  type="text" 
                  value={filterWard} 
                  onChange={(e) => setFilterWard(e.target.value)}
                  placeholder="e.g. Ward 2"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-2.5 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[9px] text-slate-400 uppercase font-extrabold tracking-wider mb-1.5">Status</label>
                <select 
                  value={filterStatus} 
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-2.5 focus:outline-none cursor-pointer"
                >
                  <option value="">All Status</option>
                  <option value="SUBMITTED">Submitted</option>
                  <option value="OPEN_FOR_COMMUNITY_VERIFICATION">In Verification</option>
                  <option value="ASSIGNED_TO_AUTHORITY">Assigned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="RESOLVED">Resolved</option>
                </select>
              </div>
            </div>

            <button 
              onClick={() => {
                setFilterCategory('');
                setFilterSeverity('');
                setFilterStatus('');
                setFilterWard('');
                setFilterTaluk('');
                setFilterDistrict('');
                setSearchQuery('');
              }}
              className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-655 rounded-xl text-xs transition-colors cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        </div>

        {/* AI Hotspots Analysis Insights Panel */}
        <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm space-y-4">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 border-b border-slate-100 pb-2">
            <Activity className="w-4 h-4 text-rose-500 animate-pulse" />
            AI GIS Hotspot Analysis
          </h3>
          
          {hotspots.length === 0 ? (
            <p className="text-[11px] text-slate-450 py-6 text-center font-medium bg-slate-50 rounded-2xl border border-slate-100">No concentrated density clusters found in selected coordinates.</p>
          ) : (
            <div className="space-y-4">
              {hotspots.map((hs, i) => (
                <div key={i} className="bg-slate-50/50 border border-slate-100 p-4 rounded-[20px] space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[8px] font-bold uppercase rounded-full">
                      {hs.ward}
                    </span>
                    <span className="text-[10px] font-extrabold text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                      Score: {hs.score}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-[11px] font-black text-slate-900">{hs.category}</h4>
                    <p className="text-[10px] text-slate-505 font-semibold mt-0.5">{hs.reports} cluster reports detected</p>
                  </div>
                  <div className="bg-white border border-slate-100 p-2.5 rounded-xl flex items-start gap-1.5 text-[9px] font-bold text-slate-700 leading-snug">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-slate-450 block uppercase text-[7px] font-extrabold tracking-wider">AI Recommendation</span>
                      <span>{hs.recommendation}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
