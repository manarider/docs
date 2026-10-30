/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { LocateFixed } from 'lucide-react';
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
    const [accuracy, setAccuracy] = useState(null);
    const [locationError, setLocationError] = useState('');

    useEffect(() => {
        if (value || !navigator.geolocation) { setLocating(false); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setPosition(next);
                setAccuracy(pos.coords.accuracy);
                onChange(next);
                setLocating(false);
            },
            () => setLocating(false),
            { enableHighAccuracy: true, timeout: 8000 }
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handlePick = (next) => { setPosition(next); setAccuracy(null); onChange(next); };
    const locateCurrentPosition = () => {
        if (!navigator.geolocation) {
            setLocationError('อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง');
            return;
        }
        setLocating(true);
        setLocationError('');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setPosition(next);
                setAccuracy(pos.coords.accuracy);
                onChange(next);
                setLocating(false);
            },
            (error) => {
                setLocating(false);
                setLocationError(error.code === error.PERMISSION_DENIED
                    ? 'กรุณาอนุญาตการเข้าถึงตำแหน่ง และใช้หน้าเว็บผ่าน HTTPS'
                    : 'ค้นหาตำแหน่งไม่สำเร็จ กรุณาลองอีกครั้ง');
            },
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
        );
    };
    const center = position || DEFAULT_CENTER;

    return (
        <div className="space-y-1.5">
            <button
                type="button"
                onClick={locateCurrentPosition}
                disabled={locating}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
            >
                <LocateFixed size={16} aria-hidden="true" />
                {locating ? 'กำลังค้นหาตำแหน่ง...' : 'ตำแหน่งปัจจุบัน'}
            </button>
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
                {locationError || (locating ? 'กำลังค้นหาตำแหน่งปัจจุบัน...' : position ? `พิกัด: ${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}${accuracy !== null ? ` (คลาดเคลื่อนประมาณ ${Math.round(accuracy)} ม.)` : ''} (คลิกหรือลากหมุดเพื่อปรับตำแหน่ง)` : 'คลิกบนแผนที่เพื่อปักหมุด')}
            </p>
        </div>
    );
}
