'use client';

import { useEffect, useRef } from 'react';
import { StopDetail, getStopLocation, getStopName } from '@/lib/types';
import { useSettingsStore } from '@/lib/stores';

// Leaflet types
declare global {
  interface Window {
    L: typeof import('leaflet');
  }
}

interface RouteMapProps {
  stops: StopDetail[];
  selectedStopId?: string | null;
  userLocation?: { lat: number; lng: number } | null;
  onStopSelect?: (stopId: string) => void;
}

export function RouteMap({
  stops,
  selectedStopId,
  userLocation,
  onStopSelect,
}: RouteMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const userMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  
  const locale = useSettingsStore(state => state.locale);
  const useCTBInfo = useSettingsStore(state => state.useCTBInfoForJointRoutes);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    
    // Dynamic import of Leaflet
    const initMap = async () => {
      // Load Leaflet CSS
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      
      // Load Leaflet JS
      if (!window.L) {
        await new Promise<void>((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      }
      
      const L = window.L;
      
      // Default center (Hong Kong)
      const defaultCenter: [number, number] = [22.3193, 114.1694];
      
      // Initialize map
      const map = L.map(mapRef.current!, {
        center: defaultCenter,
        zoom: 14,
        zoomControl: false,
      });
      
      // Add tile layer (OpenStreetMap)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      
      // Add zoom control to top right
      L.control.zoom({ position: 'topright' }).addTo(map);
      
      mapInstanceRef.current = map;
      
      // Add markers for stops
      updateMarkers(stops, selectedStopId);
      
      // Fit bounds to show all stops
      if (stops.length > 0) {
        fitBoundsToStops(stops);
      }
    };
    
    initMap();
    
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers when stops change
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    updateMarkers(stops, selectedStopId);
  }, [stops, selectedStopId, locale, useCTBInfo]);

  // Update user location marker
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L) return;
    
    const L = window.L;
    
    if (userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
      } else {
        // Create user location marker with pulsing effect
        const userIcon = L.divIcon({
          className: 'user-location-marker',
          html: `
            <div class="relative">
              <div class="absolute w-8 h-8 bg-blue-500/30 rounded-full animate-ping"></div>
              <div class="relative w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg"></div>
            </div>
          `,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });
        
        userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
          icon: userIcon,
          zIndexOffset: 1000,
        }).addTo(mapInstanceRef.current);
      }
    } else if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
  }, [userLocation]);

  // Update route polyline
  useEffect(() => {
    if (!mapInstanceRef.current || !window.L || stops.length < 2) return;
    
    const L = window.L;
    
    // Remove existing polyline
    if (polylineRef.current) {
      polylineRef.current.remove();
    }
    
    // Create polyline from stop coordinates
    const coordinates = stops.map(stop => {
      const loc = getStopLocation(stop);
      return [loc.lat, loc.lng] as [number, number];
    });
    
    polylineRef.current = L.polyline(coordinates, {
      color: '#3b82f6',
      weight: 4,
      opacity: 0.7,
      lineJoin: 'round',
    }).addTo(mapInstanceRef.current);
  }, [stops]);

  // Pan to selected stop
  useEffect(() => {
    if (!mapInstanceRef.current || !selectedStopId) return;
    
    const selectedStop = stops.find(s => 
      s.id === selectedStopId || 
      `${s.routeNumber}-${s.bound}-${s.id}-${s.sequence}` === selectedStopId
    );
    
    if (selectedStop) {
      const loc = getStopLocation(selectedStop);
      mapInstanceRef.current.setView([loc.lat, loc.lng], 16, {
        animate: true,
        duration: 0.5,
      });
    }
  }, [selectedStopId, stops]);

  const updateMarkers = (stops: StopDetail[], selectedId?: string | null) => {
    if (!mapInstanceRef.current || !window.L) return;
    
    const L = window.L;
    
    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();
    
    // Add markers for each stop
    stops.forEach((stop, index) => {
      const loc = getStopLocation(stop);
      const stopName = getStopName(stop, locale, useCTBInfo);
      const uniqueId = `${stop.routeNumber}-${stop.bound}-${stop.id}-${stop.sequence}`;
      const isSelected = selectedId === stop.id || selectedId === uniqueId;
      const isFirst = index === 0;
      const isLast = index === stops.length - 1;
      
      // Create custom icon
      const icon = L.divIcon({
        className: 'stop-marker',
        html: `
          <div class="flex items-center justify-center w-6 h-6 rounded-full border-2 text-xs font-bold
            ${isSelected 
              ? 'bg-primary-500 border-primary-500 text-white' 
              : isFirst || isLast
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'bg-white border-gray-400 text-gray-700'
            }">
            ${stop.sequence}
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      
      const marker = L.marker([loc.lat, loc.lng], { icon })
        .addTo(mapInstanceRef.current!)
        .bindPopup(`
          <div class="text-sm">
            <strong>${stop.sequence}. ${stopName}</strong>
          </div>
        `);
      
      marker.on('click', () => {
        onStopSelect?.(uniqueId);
      });
      
      markersRef.current.set(uniqueId, marker);
    });
  };

  const fitBoundsToStops = (stops: StopDetail[]) => {
    if (!mapInstanceRef.current || !window.L || stops.length === 0) return;
    
    const L = window.L;
    
    const bounds = L.latLngBounds(
      stops.map(stop => {
        const loc = getStopLocation(stop);
        return [loc.lat, loc.lng] as [number, number];
      })
    );
    
    mapInstanceRef.current.fitBounds(bounds, {
      padding: [50, 50],
      maxZoom: 16,
    });
  };

  return (
    <div ref={mapRef} className="w-full h-full min-h-[300px] bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden" />
  );
}
