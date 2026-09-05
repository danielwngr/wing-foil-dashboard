import React from 'react';
import { COLORS } from './theme.js';
import { sectorsToLabel } from './compass.js';

export default function DirectoryPage({ spots }) {
  const sorted = [...spots].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '56px 24px 80px' }}>
      <h1 className="sg" style={{ fontSize: 26, marginBottom: 8 }}>Spot directory</h1>
      <p style={{ color: COLORS.inkSoft, fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
        Every spot on the dashboard, alphabetically, with its working wind directions and any notes from submitters.
      </p>

      {sorted.length === 0 && <p style={{ color: COLORS.inkSoft }}>No spots yet.</p>}

      {sorted.map((s) => (
        <div key={s.id} style={{ borderBottom: `1px solid ${COLORS.paperLine}`, padding: '16px 0' }}>
          <div className="sg" style={{ fontWeight: 700, fontSize: 16 }}>{s.name}</div>
          <div className="mono" style={{ fontSize: 12, color: COLORS.teal, marginTop: 4 }}>
            {sectorsToLabel(s.sectors)}
          </div>
          {s.description && (
            <div style={{ fontSize: 14, color: COLORS.inkSoft, marginTop: 6, lineHeight: 1.5 }}>
              {s.description}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
