import React, { useState } from 'react';
import { COLORS } from './theme.js';

const inputStyle = {
  width: '100%',
  padding: '9px 10px',
  border: `1px solid ${COLORS.paperLine}`,
  borderRadius: 4,
  fontSize: 14,
  fontFamily: "'IBM Plex Sans', sans-serif",
  marginTop: 4,
  marginBottom: 14,
  boxSizing: 'border-box',
};
const labelStyle = { display: 'block', fontSize: 13, fontWeight: 600, color: COLORS.ink };

// Accepts named compass points ("NW, N, W") or explicit numeric ranges
// ("290-340"), and converts named points into a 45-degree-wide sector.
function parseDirections(text) {
  const COMPASS = {
    N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5,
    S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5,
  };
  const parts = text.split(',').map((p) => p.trim()).filter(Boolean);
  const sectors = [];
  for (const part of parts) {
    if (/^\d+(\.\d+)?\s*-\s*\d+(\.\d+)?$/.test(part)) {
      const [a, b] = part.split('-').map((n) => parseFloat(n.trim()));
      sectors.push([a, b]);
    } else {
      const center = COMPASS[part.toUpperCase()];
      if (center !== undefined) {
        const lo = (center - 22.5 + 360) % 360;
        const hi = (center + 22.5) % 360;
        sectors.push([lo, hi]);
      }
    }
  }
  return sectors;
}

export default function AddSpotPage({ onSubmitted }) {
  const [form, setForm] = useState({ name: '', lat: '', lon: '', directions: '', description: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Enter a spot name.');
      return;
    }
    const lat = parseFloat(form.lat);
    const lon = parseFloat(form.lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      setError('Latitude and longitude must be numbers.');
      return;
    }
    const sectors = parseDirections(form.directions);
    if (!sectors.length) {
      setError('Enter at least one working wind direction, e.g. "NW, N, W" or "290-340".');
      return;
    }

    setStatus('submitting');
    try {
      const res = await fetch('/api/spots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), lat, lon, sectors, description: form.description.trim() || null }),
      });
      if (!res.ok) throw new Error('submit failed');
      setStatus('done');
      if (onSubmitted) onSubmitted();
    } catch (err) {
      setStatus('error');
      setError("Couldn't submit right now — try again in a moment.");
    }
  }

  if (status === 'done') {
    return (
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '56px 24px' }}>
        <h1 className="sg" style={{ fontSize: 24, marginBottom: 10 }}>Thanks!</h1>
        <p style={{ color: COLORS.inkSoft, lineHeight: 1.6, fontSize: 15 }}>
          Your spot has been submitted for review. Once it's approved, it'll show up on the dashboard for everyone.
        </p>
        <button
          className="sg"
          onClick={() => {
            setStatus('idle');
            setForm({ name: '', lat: '', lon: '', directions: '', description: '' });
          }}
          style={{ background: COLORS.ink, color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, marginTop: 12 }}
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '56px 24px' }}>
      <h1 className="sg" style={{ fontSize: 24, marginBottom: 6 }}>Suggest a launch spot</h1>
      <p style={{ color: COLORS.inkSoft, lineHeight: 1.6, marginBottom: 28, fontSize: 14 }}>
        Submissions are reviewed before they appear on the shared dashboard, so take a moment to get the details right.
      </p>
      <form onSubmit={handleSubmit}>
        <label style={labelStyle}>
          Spot name
          <input style={inputStyle} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Sandy Point" />
        </label>
        <div style={{ display: 'flex', gap: 12 }}>
          <label style={{ ...labelStyle, flex: 1 }}>
            Latitude
            <input style={inputStyle} value={form.lat} onChange={(e) => update('lat', e.target.value)} placeholder="44.9343" />
          </label>
          <label style={{ ...labelStyle, flex: 1 }}>
            Longitude
            <input style={inputStyle} value={form.lon} onChange={(e) => update('lon', e.target.value)} placeholder="-93.3086" />
          </label>
        </div>
        <label style={labelStyle}>
          Working wind directions
          <input style={inputStyle} value={form.directions} onChange={(e) => update('directions', e.target.value)} placeholder='e.g. "NW, N, W" or "290-340"' />
        </label>
        <label style={labelStyle}>
          Launch description
          <textarea
            className="italicPlaceholder"
            style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder={'e.g. "Heavy weeds in the SE corner of the lake, best to launch from the north side."\nOr: "Avoid the area around the fishing dock \u2014 rocky bottom and low water at low tide."'}
          />
        </label>
        {error && <p style={{ color: COLORS.danger, fontSize: 13, marginTop: -8, marginBottom: 14 }}>{error}</p>}
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="sg"
          style={{ background: COLORS.ink, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 4, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}
        >
          {status === 'submitting' ? 'Submitting…' : 'Submit for review'}
        </button>
      </form>
    </div>
  );
}
