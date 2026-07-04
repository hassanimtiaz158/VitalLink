"use client";

import { useEffect, useRef } from "react";
import type { ActiveRequest } from "@/lib/api";

interface Props {
  requests: ActiveRequest[];
}

const urgencyColor: Record<string, string> = {
  critical: "#C8102E",
  high: "#C77E1B",
  routine: "#1B7F79",
};

export default function LiveMap({ requests }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstance = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Dynamic import — Leaflet must only run client-side
    import("leaflet").then((L) => {
      const map = L.map(mapRef.current!, {
        center: [40.7128, -74.006],
        zoom: 12,
        zoomControl: false,
        attributionControl: true,
      });

      L.control.zoom({ position: "bottomright" }).addTo(map);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      mapInstance.current = map;
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, []);

  // Add/update markers when requests change
  useEffect(() => {
    if (!mapInstance.current) return;

    import("leaflet").then((L) => {
      const map = mapInstance.current;

      // Clear existing markers (layers with _icon are marker instances)
      map.eachLayer((layer: { _icon?: unknown; _latlng?: unknown }) => {
        if (layer._icon) {
          map.removeLayer(layer);
        }
      });

      requests.forEach((r) => {
        const color = urgencyColor[r.urgency] ?? "#6b7280";
        const icon = L.divIcon({
          className: "",
          html: `<div style="
            width:14px; height:14px; border-radius:50%;
            background:${color}; border:2px solid #fff;
            box-shadow:0 0 0 4px ${color}33, 0 2px 8px rgba(0,0,0,0.2);
          "></div>`,
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        });

        L.marker([r.latitude, r.longitude], { icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:system-ui;min-width:140px">
              <strong>${r.hospital_name}</strong><br/>
              <span style="font-size:12px;color:#6b7280">${r.blood_type} x${r.units_needed} &middot; ${r.urgency}</span>
            </div>`,
          );
      });

      // Fit bounds if we have markers
      if (requests.length > 0) {
        const bounds = L.latLngBounds(
          requests.map((r) => [r.latitude, r.longitude] as [number, number]),
        );
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    });
  }, [requests]);

  return (
    <div>
      <div ref={mapRef} style={mapBox} />
      <div style={legend}>
        <span style={legendItem}>
          <span style={{ ...dot, backgroundColor: "#C8102E" }} /> Critical
        </span>
        <span style={legendItem}>
          <span style={{ ...dot, backgroundColor: "#C77E1B" }} /> High
        </span>
        <span style={legendItem}>
          <span style={{ ...dot, backgroundColor: "#1B7F79" }} /> Routine
        </span>
      </div>
    </div>
  );
}

const mapBox: React.CSSProperties = {
  height: 340,
  borderRadius: 8,
  overflow: "hidden",
  border: "1px solid #D8DFDA",
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
  width: 8,
  height: 8,
  borderRadius: "50%",
};
