import React, { useEffect, useMemo, useRef } from 'react';
import {
  DimensionValue,
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Colors, Radius } from '@/constants/theme';

export interface TagoMapMarker {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  badgeText?: string; // e.g. "★ 4.9 · 0.8km" or "Ca 1 · 08:00"
  badge?: string;
  color?: string;
  isSelected?: boolean;
  stepNumber?: number; // e.g. 1, 2, 3 for Provider daily route
  tone?: 'primary' | 'amber' | 'emerald' | 'muted';
}

export type MapMarkerItem = TagoMapMarker;

export interface TagoMapViewProps {
  center: { lat: number; lng: number };
  zoom?: number;
  height?: DimensionValue;
  style?: StyleProp<ViewStyle>;
  userLocation?: { lat: number; lng: number; label?: string } | null;
  markers?: TagoMapMarker[];
  selectedMarkerId?: string | null;
  onSelectMarker?: (id: string) => void;
  onMarkerPress?: (id: string) => void;
  interactivePin?: { lat: number; lng: number; label?: string } | null;
  onPinChange?: (coord: { lat: number; lng: number }) => void;
  onUserGpsDetected?: (coord: { lat: number; lng: number }) => void;
  radiusCircle?: { lat: number; lng: number; radiusKm: number } | null;
  routePoints?: Array<[number, number]> | null;
  routeLine?: {
    from: { lat: number; lng: number };
    to: { lat: number; lng: number };
    points?: Array<[number, number] | { lat: number; lng: number }>;
    color?: string;
  } | null;
  fitRouteBounds?: boolean;
}

export function TagoMapView({
  center,
  zoom = 14,
  height = 300,
  style,
  userLocation,
  markers = [],
  selectedMarkerId,
  onSelectMarker,
  onMarkerPress,
  interactivePin,
  onPinChange,
  onUserGpsDetected,
  radiusCircle,
  routePoints,
  routeLine,
  fitRouteBounds = false,
}: TagoMapViewProps) {
  const webViewRef = useRef<WebView | null>(null);

  const normalizedRoutePoints = useMemo(() => {
    if (routePoints && routePoints.length >= 2) return routePoints;
    if (routeLine) {
      if (routeLine.points && routeLine.points.length >= 2) {
        return routeLine.points.map((pt) =>
          Array.isArray(pt) ? pt : ([pt.lat, pt.lng] as [number, number]),
        );
      }
      return [
        [routeLine.from.lat, routeLine.from.lng] as [number, number],
        [routeLine.to.lat, routeLine.to.lng] as [number, number],
      ];
    }
    return null;
  }, [routePoints, routeLine]);

  const normalizedMarkers = useMemo(
    () =>
      markers.map((m) => ({
        ...m,
        badgeText: m.badgeText ?? m.badge ?? m.subtitle,
      })),
    [markers],
  );

  const effectiveSelectedId = useMemo(
    () => selectedMarkerId ?? markers.find((m) => m.isSelected)?.id ?? null,
    [selectedMarkerId, markers],
  );

  const payload = useMemo(
    () => ({
      center,
      zoom,
      userLocation: userLocation ?? null,
      markers: normalizedMarkers,
      selectedMarkerId: effectiveSelectedId,
      interactivePin: interactivePin ?? null,
      radiusCircle: radiusCircle ?? null,
      routePoints: normalizedRoutePoints,
      fitRouteBounds,
    }),
    [
      center,
      zoom,
      userLocation,
      normalizedMarkers,
      effectiveSelectedId,
      interactivePin,
      radiusCircle,
      normalizedRoutePoints,
      fitRouteBounds,
    ],
  );

  // Push live state updates into the Leaflet instance without reloading the WebView
  useEffect(() => {
    if (!webViewRef.current) return;
    const script = `window.__updateTagoMap && window.__updateTagoMap(${JSON.stringify(payload)}); true;`;
    webViewRef.current.injectJavaScript(script);
  }, [payload]);

  const initialHtml = useMemo(() => {
    const initialDataJson = JSON.stringify(payload);
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    html, body, #map { width: 100%; height: 100%; background: #F7F2EC; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .leaflet-control-attribution { font-size: 9px !important; opacity: 0.7; }

    /* Pulsing User GPS Dot */
    .tago-user-dot-wrap {
      position: relative;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .tago-user-pulse {
      position: absolute;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: rgba(37, 99, 235, 0.28);
      animation: tagoPulse 2s infinite ease-out;
    }
    .tago-user-core {
      position: relative;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: #2563EB;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 2px 6px rgba(37, 99, 235, 0.55);
    }
    @keyframes tagoPulse {
      0% { transform: scale(0.65); opacity: 0.95; }
      100% { transform: scale(2.1); opacity: 0; }
    }

    /* Compact Marker Pin for Unselected Stores (No Overlap!) */
    .tago-compact-pin {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 8px;
      border-radius: 999px;
      background: #FFFFFF;
      color: #1F1316;
      border: 1.8px solid #BA0049;
      box-shadow: 0 3px 8px rgba(27, 20, 22, 0.22);
      font-size: 10.5px;
      font-weight: 800;
      white-space: nowrap;
      transform: translate(-50%, -100%);
      transition: all 0.18s ease;
    }
    .tago-compact-pin::after {
      content: "";
      position: absolute;
      bottom: -5px;
      left: 50%;
      transform: translateX(-50%);
      border-width: 5px 4px 0;
      border-style: solid;
      border-color: #BA0049 transparent transparent;
    }
    .tago-compact-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #BA0049;
      flex-shrink: 0;
    }

    /* Floating Pill Marker for Selected Store (Grab / Traveloka style) */
    .tago-pill-marker {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: 999px;
      background: #BA0049;
      color: #FFFFFF;
      border: 2px solid #FFFFFF;
      box-shadow: 0 6px 18px rgba(186, 0, 73, 0.45);
      font-size: 11.5px;
      font-weight: 700;
      white-space: nowrap;
      transform: translate(-50%, -110%) scale(1.04);
      z-index: 9999 !important;
      transition: all 0.18s ease;
    }
    .tago-pill-marker::after {
      content: "";
      position: absolute;
      bottom: -7px;
      left: 50%;
      transform: translateX(-50%);
      border-width: 7px 6px 0;
      border-style: solid;
      border-color: #BA0049 transparent transparent;
    }
    .tago-compact-pin.tone-amber {
      border-color: #D97706;
      background: #FFFBEB;
      color: #92400E;
    }
    .tago-compact-pin.tone-emerald {
      border-color: #059669;
      background: #ECFDF5;
      color: #065F46;
    }
    .tago-compact-pin.tone-muted {
      border-color: #9CA3AF;
      background: #F3F4F6;
      color: #4B5563;
      opacity: 0.85;
    }
    .tago-step-circle {
      width: 18px;
      height: 18px;
      border-radius: 9px;
      background: #BA0049;
      color: #FFFFFF;
      font-size: 10px;
      font-weight: 800;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .tago-pill-marker.is-selected .tago-step-circle {
      background: #FFFFFF;
      color: #BA0049;
    }

    /* Draggable Center Pin */
    .tago-pin-drop {
      width: 34px;
      height: 34px;
      border-radius: 50% 50% 50% 0;
      background: #BA0049;
      transform: rotate(-45deg);
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 6px 16px rgba(186, 0, 73, 0.42);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .tago-pin-drop::after {
      content: "";
      width: 11px;
      height: 11px;
      border-radius: 50%;
      background: #FFFFFF;
    }

    /* Floating Locate Me Button inside Map */
    .tago-locate-btn {
      position: absolute;
      right: 12px;
      bottom: 24px;
      z-index: 900;
      width: 38px;
      height: 38px;
      border-radius: 19px;
      background: #FFFFFF;
      border: 1px solid #EADCE1;
      box-shadow: 0 4px 12px rgba(0,0,0,0.14);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 16px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <button type="button" class="tago-locate-btn" id="locateBtn" title="Vị trí của tôi" aria-label="Định vị">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BA0049" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="7.5"></circle>
      <line x1="12" y1="2" x2="12" y2="5.5"></line>
      <line x1="12" y1="18.5" x2="12" y2="22"></line>
      <line x1="2" y1="12" x2="5.5" y2="12"></line>
      <line x1="18.5" y1="12" x2="22" y2="12"></line>
      <circle cx="12" cy="12" r="2.5" fill="#BA0049"></circle>
    </svg>
  </button>
  <script>
    (function() {
      var initial = ${initialDataJson};
      var map = L.map('map', {
        zoomControl: false,
        attributionControl: true
      }).setView([initial.center.lat, initial.center.lng], initial.zoom || 14);

      L.control.zoom({ position: 'topleft' }).addTo(map);

      var osmLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      });

      var esriStreetLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap & Esri'
      });

      var fallbackTriggered = false;
      osmLayer.on('tileerror', function() {
        if (!fallbackTriggered) {
          fallbackTriggered = true;
          map.removeLayer(osmLayer);
          esriStreetLayer.addTo(map);
        }
      });
      osmLayer.addTo(map);

      var markerLayer = L.layerGroup().addTo(map);
      var routeLayer = L.layerGroup().addTo(map);
      var radiusLayer = L.layerGroup().addTo(map);
      var userLayer = L.layerGroup().addTo(map);
      var pinMarker = null;
      var lastCenterKey = initial.center.lat.toFixed(5) + ',' + initial.center.lng.toFixed(5);

      function postToRN(data) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(data));
        }
      }

      document.getElementById('locateBtn').addEventListener('click', function(e) {
        e.stopPropagation();
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(function(pos) {
            var lat = pos.coords.latitude;
            var lng = pos.coords.longitude;
            map.flyTo([lat, lng], 15, { duration: 0.5 });
            postToRN({ type: 'GPS_DETECTED', lat: lat, lng: lng, manual: true });
          }, function() {
            postToRN({ type: 'GPS_FALLBACK_REQUEST' });
          }, { enableHighAccuracy: true, timeout: 6000 });
        } else {
          postToRN({ type: 'GPS_FALLBACK_REQUEST' });
        }
      });

      // Attempt auto GPS detection on load
      setTimeout(function() {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(function(pos) {
            postToRN({
              type: 'GPS_DETECTED',
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              auto: true
            });
          }, function() {}, { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 });
        }
      }, 500);

      map.on('click', function(e) {
        postToRN({
          type: 'MAP_CLICK',
          lat: Number(e.latlng.lat.toFixed(6)),
          lng: Number(e.latlng.lng.toFixed(6))
        });
      });

      function renderState(state) {
        if (!state) return;

        // 1. Center changes
        var nextCenterKey = state.center.lat.toFixed(5) + ',' + state.center.lng.toFixed(5);
        if (nextCenterKey !== lastCenterKey) {
          lastCenterKey = nextCenterKey;
          map.flyTo([state.center.lat, state.center.lng], state.zoom || map.getZoom(), { duration: 0.45 });
        }

        // 2. User GPS Dot
        userLayer.clearLayers();
        if (state.userLocation && typeof state.userLocation.lat === 'number') {
          var userIcon = L.divIcon({
            className: '',
            html: '<div class="tago-user-dot-wrap"><div class="tago-user-pulse"></div><div class="tago-user-core"></div></div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
          });
          var uMarker = L.marker([state.userLocation.lat, state.userLocation.lng], { icon: userIcon }).addTo(userLayer);
          if (state.userLocation.label) {
            uMarker.bindTooltip(state.userLocation.label, { direction: 'top', offset: [0, -10] });
          }
        }

        // 3. Radius Circle
        radiusLayer.clearLayers();
        if (state.radiusCircle && state.radiusCircle.radiusKm > 0) {
          L.circle([state.radiusCircle.lat, state.radiusCircle.lng], {
            radius: state.radiusCircle.radiusKm * 1000,
            color: '#BA0049',
            weight: 2,
            dashArray: '6, 6',
            fillColor: '#BA0049',
            fillOpacity: 0.09,
            interactive: false
          }).addTo(radiusLayer);
        }

        // 4. Route Polyline
        routeLayer.clearLayers();
        if (Array.isArray(state.routePoints) && state.routePoints.length >= 2) {
          // Outer white halo
          L.polyline(state.routePoints, {
            color: '#FFFFFF',
            weight: 8,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(routeLayer);
          // Main TàGo crimson road route
          var poly = L.polyline(state.routePoints, {
            color: '#BA0049',
            weight: 5,
            opacity: 0.92,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(routeLayer);

          if (state.fitRouteBounds) {
            try {
              map.fitBounds(poly.getBounds(), { padding: [42, 42], maxZoom: 16 });
            } catch (err) {}
          }
        }

        // 5. Store / Spot / Schedule Markers (with automatic anti-overlap spread)
        markerLayer.clearLayers();
        if (Array.isArray(state.markers)) {
          var isCrowded = state.markers.length > 3;
          var placedPositions = [];

          state.markers.forEach(function(m, idx) {
            var isSelected = (state.selectedMarkerId && state.selectedMarkerId === m.id) || (!state.selectedMarkerId && idx === 0);
            var toneClass = m.tone ? ' tone-' + m.tone : '';
            var stepHtml = typeof m.stepNumber === 'number'
              ? '<span class="tago-step-circle">' + m.stepNumber + '</span>'
              : '';

            // De-overlap markers that share identical or very close coordinates
            var displayLat = m.lat;
            var displayLng = m.lng;
            for (var p = 0; p < placedPositions.length; p++) {
              var dLat = Math.abs(displayLat - placedPositions[p].lat);
              var dLng = Math.abs(displayLng - placedPositions[p].lng);
              if (dLat < 0.0022 && dLng < 0.0032) {
                var angle = (idx * 137.5) * (Math.PI / 180); // Golden angle spiral
                var ring = 0.0018 + Math.floor(idx / 4) * 0.0014;
                displayLat = m.lat + Math.sin(angle) * ring;
                displayLng = m.lng + Math.cos(angle) * ring * 1.25;
              }
            }
            placedPositions.push({ lat: displayLat, lng: displayLng });

            var htmlContent = '';
            if (isSelected || !isCrowded) {
              var fullText = m.badgeText ? m.title + ' · ' + m.badgeText : m.title;
              var safeFull = String(fullText).replace(/</g, '&lt;').replace(/>/g, '&gt;');
              htmlContent = '<div class="tago-pill-marker">' + stepHtml + '<span>' + safeFull + '</span></div>';
            } else {
              // Compact badge for unselected markers when crowded (Grab / Traveloka style)
              var shortBadge = m.badgeText || m.title || '';
              var parts = String(shortBadge).split('·');
              var distPart = parts[parts.length - 1].trim();
              var shortTitle = String(m.title || '').replace(/^(Tiệm Áo Dài|Áo Dài|Studio|Cổ Phục|Nhiếp Ảnh)\s+/i, '').slice(0, 9);
              var compactLabel = distPart ? shortTitle + ' · ' + distPart : shortTitle;
              var safeCompact = String(compactLabel).replace(/</g, '&lt;').replace(/>/g, '&gt;');
              htmlContent = '<div class="tago-compact-pin' + toneClass + '">' + (stepHtml || '<span class="tago-compact-dot"></span>') + '<span>' + safeCompact + '</span></div>';
            }

            var icon = L.divIcon({
              className: '',
              html: htmlContent,
              iconSize: [0, 0],
              iconAnchor: [0, 0]
            });

            var leafletMarker = L.marker([displayLat, displayLng], {
              icon: icon,
              zIndexOffset: isSelected ? 2500 : (100 - idx)
            }).addTo(markerLayer);
            leafletMarker.on('click', function(ev) {
              L.DomEvent.stopPropagation(ev);
              postToRN({ type: 'MARKER_PRESS', id: m.id, lat: m.lat, lng: m.lng });
            });
          });
        }

        // 6. Interactive Draggable Pin
        if (state.interactivePin && typeof state.interactivePin.lat === 'number') {
          var pinIcon = L.divIcon({
            className: '',
            html: '<div class="tago-pin-drop"></div>',
            iconSize: [34, 34],
            iconAnchor: [17, 34]
          });
          if (!pinMarker) {
            pinMarker = L.marker([state.interactivePin.lat, state.interactivePin.lng], {
              draggable: true,
              icon: pinIcon
            }).addTo(map);
            pinMarker.on('dragend', function() {
              var pos = pinMarker.getLatLng();
              postToRN({
                type: 'PIN_CHANGE',
                lat: Number(pos.lat.toFixed(6)),
                lng: Number(pos.lng.toFixed(6))
              });
            });
          } else {
            pinMarker.setLatLng([state.interactivePin.lat, state.interactivePin.lng]);
          }
        } else if (pinMarker) {
          map.removeLayer(pinMarker);
          pinMarker = null;
        }
      }

      window.__updateTagoMap = renderState;
      renderState(initial);
    })();
  </script>
</body>
</html>`;
  }, []);

  const handleMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'MARKER_PRESS') {
        if (onSelectMarker) onSelectMarker(String(data.id));
        if (onMarkerPress) onMarkerPress(String(data.id));
      } else if (
        (data.type === 'PIN_CHANGE' || data.type === 'MAP_CLICK') &&
        onPinChange &&
        typeof data.lat === 'number' &&
        typeof data.lng === 'number'
      ) {
        onPinChange({ lat: data.lat, lng: data.lng });
      } else if (
        data.type === 'GPS_DETECTED' &&
        onUserGpsDetected &&
        typeof data.lat === 'number' &&
        typeof data.lng === 'number'
      ) {
        onUserGpsDetected({ lat: data.lat, lng: data.lng });
      } else if (data.type === 'GPS_FALLBACK_REQUEST' && onUserGpsDetected) {
        onUserGpsDetected(center);
      }
    } catch {
      // ignore malformed WebView message
    }
  };

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { height }, style]}>
        <iframe
          title="TagoMap"
          srcDoc={initialHtml}
          style={{ width: '100%', height: '100%', border: 'none' }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { height }, style]}>
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: initialHtml, baseUrl: 'https://tago.vn' }}
        userAgent="Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 TagoApp/1.0"
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        scrollEnabled={false}
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: '#F7F2EC',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
