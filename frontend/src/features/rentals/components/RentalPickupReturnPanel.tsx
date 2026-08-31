import { useEffect, useRef } from 'react';
import L, { type Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation } from 'lucide-react';
import './RentalPickupReturnPanel.css';

export interface RentalPickupReturnLocation {
  address: string;
  ward?: string | null;
  district?: string | null;
  city?: string | null;
  geo?: { type?: string; coordinates?: [number, number] } | null;
}

interface RentalPickupReturnPanelProps {
  location: RentalPickupReturnLocation;
  itemName?: string;
}

const hasCoordinates = (location: RentalPickupReturnLocation) => {
  const [longitude, latitude] = location.geo?.coordinates ?? [];
  return typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
};

export const RentalPickupReturnPanel = ({ location, itemName }: RentalPickupReturnPanelProps) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const canShowMap = hasCoordinates(location);
  const [longitude, latitude] = location.geo?.coordinates ?? [];
  const directionsUrl = canShowMap
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`;

  useEffect(() => {
    if (!canShowMap || !mapContainerRef.current || mapRef.current || latitude === undefined || longitude === undefined) return;
    const map = L.map(mapContainerRef.current, { scrollWheelZoom: false, dragging: false, zoomControl: false, attributionControl: true })
      .setView([latitude, longitude], 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
    }).addTo(map);
    L.marker([latitude, longitude], {
      icon: L.divIcon({ className: 'rental-pickup-marker', html: '<span></span>', iconSize: [24, 31], iconAnchor: [12, 31] }),
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [canShowMap, latitude, longitude]);

  return (
    <section className="rental-pickup-panel">
      <div className="rental-pickup-panel__heading"><MapPin size={17} /><div><strong>Điểm nhận và trả áo dài</strong>{itemName && <span>{itemName}</span>}</div></div>
      <p className="rental-pickup-panel__rule">MVP: nhận và trả tại cùng một điểm đã được lưu cùng booking.</p>
      <p className="rental-pickup-panel__address">{location.address}</p>
      {canShowMap && <div ref={mapContainerRef} className="rental-pickup-panel__map" aria-label="Bản đồ điểm nhận và trả áo dài" />}
      <a className="rental-pickup-panel__directions" href={directionsUrl} target="_blank" rel="noreferrer"><Navigation size={15} /> Chỉ đường đến điểm nhận/trả</a>
    </section>
  );
};