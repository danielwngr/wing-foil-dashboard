import React, { useState } from 'react';
import { COLORS } from './theme.js';
import * as ui from './ui.js';

const COMPASS_OPTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const COMPASS_CENTER = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

function directionsToSectors(selected) {
  return selected.map((name) => {
    const center = COMPASS_CENTER[name];
    const lo = (center - 22.5 + 360) % 360;
    const hi = (center + 22.5) % 360;
    return [lo, hi];
  });
}

const LATLON_RE = /^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/;

export default function AddSpotPage({ onSubmitted }) {
  const [form, setForm] = useState({ name: '', location: '', description: '' });
  const [directions, setDirections] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function toggleDirection(name) {
    setDirections((d) => (d.includes(name) ? d.filter((x) => x !== name) : [...d, name]));
  }

  async function resolveLocation(raw) {
    const text = raw.trim();
    const m = text.match(LATLON_RE);
    if (m) {
      return { lat: parseFloat(m[1]), lon: parseFloat(m[3]) };
    }
    if (/^https?:\/\//i.test(text)) {
      const res = await fetch('/api/resolve-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not resolve that link.');
      return { lat: data.lat, lon: data.lon };
    }
    throw new Error('Enter a Google Maps link, or coordinates like "44.9343, -93.3086".');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Enter a spot name.');
      return;
    }
    if (!form.location.trim()) {
      setError('Enter a location \u2014 a Google Maps link or lat, lon.');
      return;
    }
    if (!directions.length) {
      setError('Select at least one working wind direction.');
      return;
    }

    setStatus('submitting');
    try {
      const { lat, lon } = await resolveLocation(form.location);
      const sectors = directionsToSectors(directions);
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
      setError(err.message || "Couldn't submit right now \u2014 try again in a moment.");
    }
  }

  if (status === 'done') {
    return (
      <div style={ui.page}>
        <h1 className="sg" style={ui.h1}>Thanks!</h1>
        <p style={{ color: COLORS.inkSoft, lineHeight: 1.6, fontSize: 15, marginBottom: 20 }}>
          Your spot has been submitted for review. Once it's approved, it'll show up on the dashboard for everyone.
        </p>
        <button
          className="sg btnPrimary"
          onClick={() => {
            setStatus('idle');
            setForm({ name: '', location: '', description: '' });
            setDirections([]);
          }}
          style={ui.buttonPrimary}
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <div style={ui.page}>
      <h1 className="sg" style={ui.h1}>Suggest a launch</h1>
      <p style={ui.subtitle}>
        Submissions are reviewed before they appear on the shared dashboard, so take a moment to get the details right.
      </p>
      <form onSubmit={handleSubmit}>
        <label style={ui.label}>
          Name
          <input className="uiInput" style={{ ...ui.input, marginBottom: 14 }} value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Sandy Point" />
        </label>

        <label style={ui.label}>
          Location
          <input
            className="uiInput"
            style={{ ...ui.input, marginBottom: 14 }}
            value={form.location}
            onChange={(e) => update('location', e.target.value)}
            placeholder="Paste a Google Maps link, or enter lat, lon"
          />
        </label>

        <label style={ui.label}>Working wind direction</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6, marginBottom: 14 }}>
          {COMPASS_OPTIONS.map((name) => {
            const active = directions.includes(name);
            return (
              <button
                type="button"
                key={name}
                onClick={() => toggleDirection(name)}
                className="mono"
                style={{
                  padding: '8px 0',
                  borderRadius: 6,
                  border: `1px solid ${active ? COLORS.ink : COLORS.paperLine}`,
                  background: active ? COLORS.ink : '#fff',
                  color: active ? '#fff' : COLORS.ink,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                {name}
              </button>
            );
          })}
        </div>

        <label style={ui.label}>
          Launch description
          <textarea
            className="italicPlaceholder uiInput"
            style={{ ...ui.input, minHeight: 90, resize: 'vertical', marginBottom: 14 }}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder={'e.g. "Heavy weeds close to shore in summer \u2014 wade out about 30 yards before it clears."\nOr: "Rocky bottom right at the launch, watch your fins \u2014 keep clear of the fishing dock to the south."'}
          />
        </label>

        {error && <p style={ui.errorText}>{error}</p>}
        <button type="submit" disabled={status === 'submitting'} className="sg btnPrimary" style={ui.buttonPrimary}>
          {status === 'submitting' ? 'Submitting\u2026' : 'Submit for review'}
        </button>
      </form>
    </div>
  );
}
