/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// แก้ปัญหา default marker icon ไม่โหลดเมื่อ bundle ด้วย Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

const DEFAULT_CENTER = { lat: 15.87, lng: 100.9925 }; // ศูนย์กลางประเทศไทย (fallback)

function ClickHandler({ onPick }) {
    useMapEvents({
        click(e) { onPick({ lat: e.latlng.lat, lng: e.latlng.lng }); },
    });
    return null;
}

function MapController({ position }) {
    const map = useMap();

    useEffect(() => {
        if (position) map.flyTo(position, 16, { duration: 0.5 });
    }, [map, position]);

    return null;
}

/**
 * แผนที่ปักหมุดพิกัด — ปักหมุดตำแหน่งปัจจุบันอัตโนมัติเมื่อเปิดครั้งแรก แต่เลื่อนหมุดเองได้ (ลาก หรือคลิกบนแผนที่)
 */
export default function LocationPicker({ value, onChange }) {
    const [position, setPosition] = useState(value || null);
    const [locating, setLocating] = useState(!value);

    useEffect(() => {
        if (value || !navigator.geolocation) { setLocating(false); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setPosition(next);
                onChange(next);
                setLocating(false);
            },
            () => setLocating(false),
            { enableHighAccuracy: true, timeout: 8000 }
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePick = (next) => { setPosition(next); onChange(next); };
    const center = position || DEFAULT_CENTER;

    return (
        <div className="space-y-1.5">
            <div className="h-64 rounded-lg overflow-hidden border border-gray-300">
                <MapContainer center={center} zoom={position ? 16 : 6} style={{ height: '100%', width: '100%' }}>
                    <MapController position={position} />
                    <TileLayer
                        attribution='&copy; OpenStreetMap contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <ClickHandler onPick={handlePick} />
                    {position && (
                        <Marker
                            position={position}
                            draggable
                            eventHandlers={{
                                dragend: (e) => handlePick({ lat: e.target.getLatLng().lat, lng: e.target.getLatLng().lng }),
                            }}
                        />
                    )}
                </MapContainer>
            </div>
            <p className="text-xs text-gray-500">
                {locating ? 'กำลังค้นหาตำแหน่งปัจจุบัน...' : position ? `พิกัด: ${position.lat.toFixed(6)}, ${position.lng.toFixed(6)} (คลิกหรือลากหมุดเพื่อปรับตำแหน่ง)` : 'คลิกบนแผนที่เพื่อปักหมุด'}
            </p>
        </div>
    );
}
