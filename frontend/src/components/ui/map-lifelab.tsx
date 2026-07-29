import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Locate, Navigation } from "lucide-react";

interface Sede {
  name: string;
  address: string;
  phone: string;
  hours: string;
  lng: number;
  lat: number;
}

const sedes: Sede[] = [
  { name: "Sede Central", address: "Av. Salud 123, Miraflores", phone: "(01) 234-5678", hours: "Lun - Sáb: 7:00 am - 8:00 pm", lng: -77.0282, lat: -12.1218 },
  { name: "Sede San Isidro", address: "Calle Los Olivos 456, San Isidro", phone: "(01) 234-5679", hours: "Lun - Vie: 7:00 am - 7:00 pm", lng: -77.0356, lat: -12.0993 },
  { name: "Sede San Borja", address: "Av. Aviación 789, San Borja", phone: "(01) 234-5680", hours: "Lun - Sáb: 7:00 am - 8:00 pm", lng: -77.0081, lat: -12.1068 },
];

const sedeIcon = L.divIcon({
  className: "",
  html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,#0891B2,#066f8a);box-shadow:0 4px 12px rgba(8,145,178,0.4);cursor:pointer;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="white"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -40],
});

const userIcon = L.divIcon({
  className: "",
  html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:#10B981;border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,0.3);"><div style="width:10px;height:10px;border-radius:50%;background:white;"></div></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

export default function MapLifelab() {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [selectedSede, setSelectedSede] = useState<Sede | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ duration: string; distance: string } | null>(null);
  const [locating, setLocating] = useState(false);

  const userMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const sedeMarkersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-12.11, -77.025],
      zoom: 12,
      zoomControl: false,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapRef.current = map;

    sedes.forEach((sede) => {
      const marker = L.marker([sede.lat, sede.lng], { icon: sedeIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: system-ui, sans-serif; min-width: 200px;">
            <p style="font-weight: 700; font-size: 14px; margin: 0 0 4px;">${sede.name}</p>
            <p style="font-size: 12px; margin: 0 0 2px; color: #666;">${sede.address}</p>
            <p style="font-size: 12px; margin: 0 0 2px; color: #666;">${sede.phone}</p>
            <p style="font-size: 12px; margin: 0; color: #666;">${sede.hours}</p>
          </div>
        `);
      sedeMarkersRef.current.push(marker);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      sedeMarkersRef.current = [];
    };
  }, []);

  const fetchRoute = useCallback(async (from: [number, number], to: [number, number]) => {
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=geojson&steps=false`
      );
      const data = await res.json();
      if (!data.routes?.length) return;

      const route = data.routes[0];
      const coords: [number, number][] = route.geometry.coordinates.map(
        (c: [number, number]) => [c[1], c[0]] as [number, number]
      );

      const mins = Math.round(route.duration / 60);
      const dur = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
      const dist = route.distance < 1000
        ? `${Math.round(route.distance)} m`
        : `${(route.distance / 1000).toFixed(1)} km`;

      setRouteInfo({ duration: dur, distance: dist });

      const map = mapRef.current;
      if (!map) return;

      if (routeLineRef.current) {
        map.removeLayer(routeLineRef.current);
      }

      const line = L.polyline(coords, {
        color: "#0891B2",
        weight: 6,
        opacity: 0.9,
      }).addTo(map);

      routeLineRef.current = line;
      map.fitBounds(line.getBounds().pad(0.1));
    } catch (e) {
      console.error("Error obteniendo ruta:", e);
    }
  }, []);

  const locateUser = useCallback((onLocated?: (coords: [number, number]) => void) => {
    if (!mapRef.current) return;
    if (!("geolocation" in navigator)) return;

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUserLocation(coords);
        const map = mapRef.current!;

        if (userMarkerRef.current) map.removeLayer(userMarkerRef.current);

        const marker = L.marker([coords[1], coords[0]], { icon: userIcon })
          .addTo(map)
          .bindPopup("Tu ubicación");

        userMarkerRef.current = marker;
        map.flyTo([coords[1], coords[0]], 13, { duration: 1.5 });

        onLocated?.(coords);
        setLocating(false);
      },
      (err) => { console.error("Error de geolocalización:", err); setLocating(false); },
      { enableHighAccuracy: true },
    );
  }, []);

  const handleLocate = useCallback(() => {
    locateUser((coords) => {
      if (selectedSede) fetchRoute(coords, [selectedSede.lng, selectedSede.lat]);
    });
  }, [selectedSede, fetchRoute, locateUser]);

  const selectSede = (sede: Sede) => {
    setSelectedSede(sede);
    mapRef.current?.flyTo([sede.lat, sede.lng], 15, { duration: 1 });
    if (userLocation) {
      fetchRoute(userLocation, [sede.lng, sede.lat]);
    } else {
      locateUser((coords) => fetchRoute(coords, [sede.lng, sede.lat]));
    }
  };

  const clearRoute = () => {
    setRouteInfo(null);
    setSelectedSede(null);
    if (routeLineRef.current && mapRef.current) {
      mapRef.current.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }
  };

  return (
    <div className="w-full space-y-4">
      <div className="relative rounded-2xl overflow-hidden border border-border shadow-lg" style={{ height: "450px" }}>
        <div ref={containerRef} className="w-full h-full" />

        <button
          onClick={handleLocate}
          disabled={locating}
          className="absolute top-3 right-3 z-[1000] w-9 h-9 flex items-center justify-center rounded-lg bg-white dark:bg-[#0E1325] border border-border shadow-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50 cursor-pointer"
          title="Encontrar mi ubicación"
        >
          <Locate className={`w-4 h-4 text-primary ${locating ? "animate-spin" : ""}`} />
        </button>

        {routeInfo && (
          <div className="absolute bottom-3 left-3 right-3 z-[1000] flex items-center gap-3 px-4 py-3 rounded-xl bg-white/95 dark:bg-[#0E1325]/95 backdrop-blur-sm border border-border shadow-lg">
            <Navigation className="w-4 h-4 text-primary shrink-0" />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
              <span className="font-semibold text-foreground">{routeInfo.duration}</span>
              <span className="text-text-muted">{routeInfo.distance}</span>
              <span className="text-text-muted">•</span>
              <span className="text-text-muted">Tu ubicación</span>
              <span className="text-text-muted">→</span>
              <span className="text-primary font-medium">{selectedSede?.name}</span>
            </div>
            <button onClick={clearRoute} className="ml-auto text-xs text-text-muted hover:text-foreground transition-colors cursor-pointer">
              Limpiar
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {sedes.map((sede) => (
          <button
            key={sede.name}
            onClick={() => selectSede(sede)}
            className={`text-left p-4 rounded-xl border transition-all duration-200 group cursor-pointer ${
              selectedSede?.name === sede.name
                ? "border-primary/50 bg-primary/5 dark:bg-primary/10 shadow-md"
                : "border-border bg-surface dark:bg-[#0E1325] hover:border-primary/30 hover:shadow-lg hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{sede.name}</p>
                <p className="text-xs text-text-muted mt-1">{sede.address}</p>
                <p className="text-xs text-text-muted mt-0.5">{sede.phone}</p>
              </div>
              <Navigation className="w-4 h-4 text-primary shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-[10px] text-primary font-medium">{sede.hours}</span>
              <span className="text-[10px] text-text-muted">•</span>
              <span className="text-[10px] text-text-muted">Cómo llegar</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
