import { useEffect, useRef, useState } from 'react';
import L, { type Map as LeafletMap, type Marker as LeafletMarker } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, MapPin, Search } from 'lucide-react';
import type { LocationSelection } from '../types/photographer.types';
import './PhotographyLocationPicker.css';

interface PhotographyLocationPickerProps {
  value: LocationSelection | null;
  onSelect: (location: LocationSelection) => void;
  title?: string;
  hint?: string;
  radiusKm?: number | null;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

const isValidLatitude = (value: number) => Number.isFinite(value) && value >= -90 && value <= 90;
const isValidLongitude = (value: number) => Number.isFinite(value) && value >= -180 && value <= 180;
const DEFAULT_CENTER: [number, number] = [16.4637, 107.5847];
const NOMINATIM_MIN_INTERVAL_MS = 1_100;
let lastNominatimRequestAt = 0;

const waitForNominatimSlot = async () => {
  const waitMs = Math.max(0, lastNominatimRequestAt + NOMINATIM_MIN_INTERVAL_MS - Date.now());
  if (waitMs > 0) await new Promise<void>((resolve) => window.setTimeout(resolve, waitMs));
  lastNominatimRequestAt = Date.now();
};

/** OSM map writes to the provider-neutral booking contract: address + lat/lng. */
export const PhotographyLocationPicker = ({
  value,
  onSelect,
  title = 'Pin chính xác địa điểm chụp',
  hint = 'Địa điểm này được kiểm tra theo bán kính phục vụ trước khi giữ lịch.',
  radiusKm,
}: PhotographyLocationPickerProps) => {
  const [address, setAddress] = useState(value?.address ?? '');
  const [latitude, setLatitude] = useState(value?.latitude?.toString() ?? '');
  const [longitude, setLongitude] = useState(value?.longitude?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const radiusCircleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    setAddress(value?.address ?? '');
    setLatitude(value?.latitude?.toString() ?? '');
    setLongitude(value?.longitude?.toString() ?? '');
  }, [value]);

  const setMapPin = (nextLatitude: number, nextLongitude: number, shouldFly = true) => {
    if (!mapRef.current || !markerRef.current) return;
    const point: [number, number] = [nextLatitude, nextLongitude];
    markerRef.current.setLatLng(point);
    radiusCircleRef.current?.setLatLng(point);
    if (shouldFly) mapRef.current.flyTo(point, Math.max(mapRef.current.getZoom(), 14), { duration: 0.35 });
  };

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const initialLatitude = value?.latitude ?? DEFAULT_CENTER[0];
    const initialLongitude = value?.longitude ?? DEFAULT_CENTER[1];
    const map = L.map(mapContainerRef.current, { scrollWheelZoom: false }).setView([initialLatitude, initialLongitude], value ? 14 : 11);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(map);
    const marker = L.marker([initialLatitude, initialLongitude], {
      draggable: true,
      icon: L.divIcon({ className: 'pd-osm-marker', html: '<span></span>', iconSize: [28, 36], iconAnchor: [14, 36] }),
    }).addTo(map);
    const updatePinFromMap = (latitude: number, longitude: number) => {
      marker.setLatLng([latitude, longitude]);
      radiusCircleRef.current?.setLatLng([latitude, longitude]);
      setLatitude(latitude.toFixed(6));
      setLongitude(longitude.toFixed(6));
      setError(null);
    };
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      updatePinFromMap(lat, lng);
    });
    map.on('click', (event: any) => updatePinFromMap(event.latlng.lat, event.latlng.lng));
    mapRef.current = map;
    markerRef.current = marker;

    const invalidateSize = () => map.invalidateSize({ pan: false, animate: false });
    const animationFrame = window.requestAnimationFrame(invalidateSize);
    const delayedInvalidate = window.setTimeout(invalidateSize, 220);
    const resizeObserver = new ResizeObserver(invalidateSize);
    resizeObserver.observe(mapContainerRef.current);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(delayedInvalidate);
      resizeObserver.disconnect();
      radiusCircleRef.current?.remove();
      map.remove();
      markerRef.current = null;
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (isValidLatitude(value?.latitude ?? Number.NaN) && isValidLongitude(value?.longitude ?? Number.NaN)) {
      setMapPin(value!.latitude, value!.longitude, false);
    }
  }, [value?.latitude, value?.longitude]);


  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const radius = Number(radiusKm);
    if (!Number.isFinite(radius) || radius <= 0) {
      radiusCircleRef.current?.remove();
      radiusCircleRef.current = null;
      return;
    }
    const point = markerRef.current.getLatLng();
    if (!radiusCircleRef.current) {
      radiusCircleRef.current = L.circle(point, {
        radius: radius * 1_000,
        color: '#a11e22',
        weight: 2,
        fillColor: '#a11e22',
        fillOpacity: 0.1,
        interactive: false,
      }).addTo(mapRef.current);
    } else {
      radiusCircleRef.current.setLatLng(point).setRadius(radius * 1_000);
    }
  }, [radiusKm]);
  const publish = (nextAddress = address, nextLatitude = Number(latitude), nextLongitude = Number(longitude)) => {
    if (!nextAddress.trim()) {
      setError('Vui lòng nhập địa chỉ hoặc tên địa điểm chụp.');
      return;
    }
    if (!isValidLatitude(nextLatitude) || !isValidLongitude(nextLongitude)) {
      setError('Vui lòng chọn pin hợp lệ: vĩ độ từ -90 đến 90, kinh độ từ -180 đến 180.');
      return;
    }
    setError(null);
    onSelect({ address: nextAddress.trim(), latitude: nextLatitude, longitude: nextLongitude });
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Trình duyệt không hỗ trợ lấy vị trí hiện tại.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLatitude = position.coords.latitude;
        const nextLongitude = position.coords.longitude;
        const nextAddress = address.trim() || 'Vị trí hiện tại';
        setAddress(nextAddress);
        setLatitude(nextLatitude.toFixed(6));
        setLongitude(nextLongitude.toFixed(6));
        setMapPin(nextLatitude, nextLongitude);
        setIsLocating(false);
        publish(nextAddress, nextLatitude, nextLongitude);
      },
      () => {
        setIsLocating(false);
        setError('Không thể lấy vị trí hiện tại. Hãy cho phép quyền vị trí hoặc nhập tọa độ.');
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const searchAddress = async () => {
    const query = address.trim();
    if (!query) {
      setError('Vui lòng nhập địa chỉ hoặc tên địa điểm để tìm trên bản đồ.');
      return;
    }
    setIsSearching(true);
    setError(null);
    try {
      await waitForNominatimSlot();
      const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', countrycodes: 'vn', 'accept-language': 'vi' });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      if (!response.ok) throw new Error('Không thể tìm kiếm địa điểm');
      const matches = await response.json() as NominatimResult[];
      setResults(matches);
      if (!matches.length) setError('Không tìm thấy địa điểm phù hợp. Hãy thử tên hoặc địa chỉ chi tiết hơn.');
    } catch {
      setError('Không thể tìm địa chỉ lúc này. Bạn vẫn có thể kéo pin hoặc nhập tọa độ.');
    } finally {
      setIsSearching(false);
    }
  };

  const chooseResult = (result: NominatimResult) => {
    const nextLatitude = Number(result.lat);
    const nextLongitude = Number(result.lon);
    if (!isValidLatitude(nextLatitude) || !isValidLongitude(nextLongitude)) return;
    setAddress(result.display_name);
    setLatitude(nextLatitude.toFixed(6));
    setLongitude(nextLongitude.toFixed(6));
    setResults([]);
    setMapPin(nextLatitude, nextLongitude);
    publish(result.display_name, nextLatitude, nextLongitude);
  };

  const updateLatitude = (nextValue: string) => {
    setLatitude(nextValue);
    const nextLatitude = Number(nextValue);
    const nextLongitude = Number(longitude);
    if (isValidLatitude(nextLatitude) && isValidLongitude(nextLongitude)) setMapPin(nextLatitude, nextLongitude, false);
  };

  const updateLongitude = (nextValue: string) => {
    setLongitude(nextValue);
    const nextLatitude = Number(latitude);
    const nextLongitude = Number(nextValue);
    if (isValidLatitude(nextLatitude) && isValidLongitude(nextLongitude)) setMapPin(nextLatitude, nextLongitude, false);
  };

  return (
    <div className="pd-location-picker">
      <div className="pd-location-picker-heading"><MapPin size={17} /><span>{title}</span></div>
      <p className="pd-location-picker-hint">{hint}</p>
      <div className="pd-location-picker-fields">
        <label>
          Địa chỉ / tên địa điểm
          <div className="pd-location-search">
            <input value={address} onChange={(event) => { setAddress(event.target.value); setResults([]); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void searchAddress(); } }} placeholder="Ví dụ: Lăng Khải Định, Huế" maxLength={500} />
            <button type="button" className="vh-btn vh-btn-sm" onClick={() => void searchAddress()} disabled={isSearching}><Search size={15} />{isSearching ? 'Đang tìm...' : 'Tìm'}</button>
          </div>
          {results.length > 0 && <div className="pd-location-search-results">{results.map((result) => <button type="button" key={result.place_id} onClick={() => chooseResult(result)}>{result.display_name}</button>)}</div>}
        </label>
        <label>
          Vĩ độ
          <input value={latitude} onChange={(event) => updateLatitude(event.target.value)} inputMode="decimal" placeholder="16.4520" />
        </label>
        <label>
          Kinh độ
          <input value={longitude} onChange={(event) => updateLongitude(event.target.value)} inputMode="decimal" placeholder="107.5610" />
        </label>
      </div>
      <div ref={mapContainerRef} className="pd-location-map" aria-label="Bản đồ chọn địa điểm" />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        <button type="button" className="vh-btn vh-btn-sm" onClick={useCurrentLocation} disabled={isLocating}>
          <Crosshair size={15} /> {isLocating ? 'Đang lấy vị trí...' : 'Dùng vị trí hiện tại'}
        </button>
        <button type="button" className="vh-btn vh-btn-sm" onClick={() => publish()}>
          Xác nhận pin
        </button>
      </div>
      {error && <p className="pd-location-picker-error">{error}</p>}
    </div>
  );
};