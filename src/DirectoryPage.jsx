import React from 'react';
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { COLORS } from './theme.js';
import { sectorsToLabel } from './compass.js';
import * as ui from './ui.js';

function SpotCard({ spot }) {
  return (
    <div style={{ border: `1px solid ${COLORS.paperLine}`, borderRadius: 8, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 140, position: 'relative', background: COLORS.surface }}>
        <MapContainer
          center={[spot.lat, spot.lon]}
          zoom={11}
          zoomControl={false}
          dragging={false}
          scrollWheelZoom={false}
          doubleClickZoom={false}
          touchZoom={false}
          boxZoom={false}
          keyboard={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <CircleMarker
            center={[spot.lat, spot.lon]}
            radius={8}
            pathOptions={{ color: COLORS.ink, weight: 2, fillColor: COLORS.teal, fillOpacity: 1 }}
          />
        </MapContainer>
      </div>

      <div style={{ padding: '14px 16px 18px' }}>
        <h3 className="sg" style={{ fontSize: 16, fontWeight: 700, margin: '0 0 2px' }}>{spot.name}</h3>
        <div className="mono" style={{ fontSize: 11, color: COLORS.inkSoft, marginBottom: 10 }}>
          {spot.lat.toFixed(4)}, {spot.lon.toFixed(4)}
        </div>

        <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 10px', fontSize: 13, color: COLORS.ink }}>
          <li>
            <span style={{ color: COLORS.inkSoft }}>Wind directions: </span>
            <strong>{sectorsToLabel(spot.sectors)}</strong>
          </li>
        </ul>

        {spot.description && (
          <p style={{ fontSize: 13.5, color: COLORS.inkSoft, lineHeight: 1.55, margin: 0 }}>
            {spot.description}
          </p>
        )}
      </div>
    </div>
  );
}

export default function DirectoryPage({ spots }) {
  const sorted = [...spots].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={ui.pageWide}>
      <h1 className="sg" style={ui.h1}>Spot directory</h1>
      <p style={ui.subtitle}>
        Every spot on the dashboard, alphabetically, with its working wind directions and any notes from submitters.
      </p>

      {sorted.length === 0 && <p style={{ color: COLORS.inkSoft }}>No spots yet.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
        {sorted.map((s) => (
          <SpotCard key={s.id} spot={s} />
        ))}
      </div>
    </div>
  );
}
