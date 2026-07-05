/**
 * LiveMap — Interactive Leaflet.js map showing donors and blood requests.
 *
 * - Request markers: urgency-coloured (red=critical, amber=high, teal=routine)
 *   with pulsing animation for critical requests.
 * - Donor markers: small blue dots showing available donors nearby.
 * - Auto-centers on user's detected location via browser geolocation.
 * - Falls back to Lahore center if geolocation is unavailable.
 * - Dark-themed CartoDB tiles for a modern look.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import type { ActiveRequest, DonorResponse } from "@/lib/api";

interface Props {
  requests: ActiveRequest[];
  donors: DonorResponse[];
}

const urgencyColor: Record<string, string> = {
  critical: "#C8102E",
  high: "#C77E1B",
  routine: "#1B7F79",
};

const urgencyLabel: Record<string, string> = {
  critical: "Critical",
  high: "Urgent",
  routine: "Routine",
};

const DEFAULT_CENTER: [number, number] = [31.5204, 74.3587];
const DEFAULT_ZOOM = 12;

export default function LiveMap({ requests, donors }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstance = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requestLayer = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const donorLayer = useRef<any>(null);
  const initLock = useRef(false);
  const [locationName, setLocationName] = useState<string | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current || initLock.current) return;
    initLock.current = true;

    import("leaflet").then((L) => {
      if (mapInstance.current) return;
      const map = L.map(mapRef.current!, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        maxZoom: 19,
        subdomains: "abcd",
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.control.attribution({ position: "bottomleft", prefix: false })
        .addAttribution("&copy; <a href='https://carto.com/'>CARTO</a> &copy; <a href='https://osm.org/copyright'>OSM</a>")
        .addTo(map);

      requestLayer.current = L.layerGroup().addTo(map);
      donorLayer.current = L.layerGroup().addTo(map);
      mapInstance.current = map;

      // Detect user location to center the map
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            map.setView([lat, lng], 12);

            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10`)
              .then((r) => r.json())
              .then((data) => {
                const city = data.address?.city || data.address?.town || data.address?.village || data.address?.county || "";
                const country = data.address?.country || "";
                if (city || country) {
                  setLocationName([city, country].filter(Boolean).join(", "));
                }
              })
              .catch(() => {});
          },
          () => {},
          { timeout: 8000, enableHighAccuracy: false, maximumAge: 120000 },
        );
      }
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Update request markers
  useEffect(() => {
    if (!mapInstance.current || !requestLayer.current) return;

    import("leaflet").then((L) => {
      const layer = requestLayer.current;
      layer.clearLayers();

      requests.forEach((r) => {
        const color = urgencyColor[r.urgency] ?? "#6b7280";
        const isCritical = r.urgency === "critical";

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="position:relative;width:28px;height:28px;">
              ${isCritical ? `<div style="
                position:absolute;inset:-6px;border-radius:50%;
                border:2px solid ${color};opacity:0.6;
                animation:pulse 2s ease-out infinite;
              "></div>` : ""}
              <div style="
                position:absolute;inset:0;border-radius:50%;
                background:${color}; border:2.5px solid #fff;
                box-shadow:0 2px 8px rgba(0,0,0,0.25);
                display:flex;align-items:center;justify-content:center;
              ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C12 2 5 10.5 5 15.5C5 19.09 8.13 22 12 22C15.87 22 19 19.09 19 15.5C19 10.5 12 2 12 2Z" fill="white"/>
                </svg>
              </div>
            </div>
          `,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const popupHtml = `
          <div style="font-family:'IBM Plex Sans',system-ui,sans-serif;min-width:160px;padding:2px;">
            <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${r.requester_name}</div>
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;">
              <span style="
                display:inline-block;padding:2px 8px;border-radius:4px;
                font-size:12px;font-weight:600;
                background:${color}18;color:${color};
              ">${r.blood_type}</span>
              <span style="font-size:12px;color:#6b7280;">${r.units_needed} unit${r.units_needed !== 1 ? "s" : ""}</span>
            </div>
            <div style="font-size:11px;color:#9CA3AF;border-top:1px solid #f3f4f6;padding-top:4px;">
              ${urgencyLabel[r.urgency] ?? r.urgency} &middot; ${r.match_count} donor${r.match_count !== 1 ? "s" : ""} notified
            </div>
          </div>
        `;

        L.marker([r.latitude, r.longitude], { icon })
          .addTo(layer)
          .bindPopup(popupHtml);
      });
    });
  }, [requests]);

  // Update donor markers
  useEffect(() => {
    if (!mapInstance.current || !donorLayer.current) return;

    import("leaflet").then((L) => {
      const layer = donorLayer.current;
      layer.clearLayers();

      donors.forEach((d) => {
        if (!d.available) return;

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="
              width:10px;height:10px;border-radius:50%;
              background:#3B82F6; border:1.5px solid #fff;
              box-shadow:0 1px 4px rgba(0,0,0,0.2);
              opacity:0.8;
            "></div>
          `,
          iconSize: [10, 10],
          iconAnchor: [5, 5],
        });

        const popupHtml = `
          <div style="font-family:'IBM Plex Sans',system-ui,sans-serif;min-width:120px;">
            <div style="font-weight:600;font-size:13px;">${d.name}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:2px;">
              ${d.blood_type} &middot; Available
            </div>
          </div>
        `;

        L.marker([d.latitude, d.longitude], { icon })
          .addTo(layer)
          .bindPopup(popupHtml);
      });
    });
  }, [donors]);

  // Fit bounds to all markers
  useEffect(() => {
    if (!mapInstance.current) return;
    if (requests.length === 0 && donors.length === 0) return;

    import("leaflet").then((L) => {
      const points: [number, number][] = [];
      requests.forEach((r) => points.push([r.latitude, r.longitude]));
      donors.forEach((d) => {
        if (d.available) points.push([d.latitude, d.longitude]);
      });
      if (points.length > 0) {
        const bounds = L.latLngBounds(points);
        mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
      }
    });
  }, [requests, donors]);

  return (
    <div style={wrapper}>
      <div ref={mapRef} style={mapBox} />
      {/* Location badge */}
      <div style={locationBadge}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
          <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" fill="#6B7280"/>
        </svg>
        <span style={{ fontSize: 12, color: "#374151" }}>
          {locationName ?? "Detecting location\u2026"}
        </span>
      </div>
      {/* Legend */}
      <div style={legend}>
        <span style={legendItem}>
          <span style={{ ...dot, backgroundColor: "#C8102E" }} /> Critical
        </span>
        <span style={legendItem}>
          <span style={{ ...dot, backgroundColor: "#C77E1B" }} /> Urgent
        </span>
        <span style={legendItem}>
          <span style={{ ...dot, backgroundColor: "#1B7F79" }} /> Routine
        </span>
        <span style={legendItem}>
          <span style={{ ...dot, backgroundColor: "#3B82F6" }} /> Donor
        </span>
      </div>
      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.6; }
          70% { transform: scale(1.8); opacity: 0; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const wrapper: React.CSSProperties = {
  position: "relative",
};

const mapBox: React.CSSProperties = {
  height: 400,
  borderRadius: 10,
  overflow: "hidden",
  border: "1px solid #D8DFDA",
};

const locationBadge: React.CSSProperties = {
  position: "absolute",
  top: 12,
  left: 12,
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  backgroundColor: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(8px)",
  borderRadius: 8,
  border: "1px solid #E5E7EB",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};

const legend: React.CSSProperties = {
  display: "flex",
  gap: 16,
  marginTop: 12,
  fontSize: 11.5,
  color: "#5C6D66",
  flexWrap: "wrap",
};

const legendItem: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
};

const dot: React.CSSProperties = {
  width: 9,
  height: 9,
  borderRadius: "50%",
};
