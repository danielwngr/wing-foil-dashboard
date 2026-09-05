import React from 'react';
import { COLORS } from './theme.js';
import * as ui from './ui.js';

export default function AboutPage() {
  const pStyle = { color: COLORS.inkSoft, fontSize: 15 };

  return (
    <div style={{ ...ui.page, lineHeight: 1.7 }}>
      <h1 className="sg" style={ui.h1}>About this dashboard</h1>
      <p style={pStyle}>
        This tool scores wing foiling launch spots by matching live wind forecasts against the wind directions and speeds each spot actually needs.
      </p>

      <h2 className="sg" style={ui.sectionHeading}>How to use it</h2>
      <p style={pStyle}>
        Pick a day from the tabs at the top — each one lists which spots have at least two hours of reliably good conditions that day, sorted by how many hours qualify, with the most reliable window shown in parentheses. Click a spot on the map to see its full hourly breakdown: wind speed and gusts, direction, sky, and temperature, or tap a dot's marker to see the spot's launch description.
      </p>

      <h2 className="sg" style={ui.sectionHeading}>What counts as "good"</h2>
      <ul style={{ ...pStyle, paddingLeft: 20 }}>
        <li>Wind direction has to be within the spot's working range — this is a hard requirement, not a preference. Wrong direction always means no-go, regardless of speed.</li>
        <li>12–28 mph sustained wind, in a working direction, counts as Go.</li>
        <li>9–11 mph, 29+ mph, or under 9 mph with gusts over 20 mph counts as Marginal.</li>
        <li>Heavy rain or thunderstorms override everything to No-go.</li>
      </ul>
      <p style={pStyle}>
        These bands are calibrated for intermediate riders, and informed by published wind-speed guidance for the sport — 12 mph as the practical minimum to reliably get up on the foil, 28 mph as roughly where most intermediate riders start to struggle without smaller gear.
      </p>

      <h2 className="sg" style={ui.sectionHeading}>Data sources</h2>
      <p style={pStyle}>
        Forecasts come from Open-Meteo, a free weather API that blends models from national weather services (NOAA GFS/HRRR, DWD ICON, ECMWF, and others). You can pick a specific forecast source per spot from the dropdown on the dashboard. Wind-direction rules for each launch were sourced from local wind-sport community knowledge where available, and otherwise reflect direct input from spot submitters. Forecasts run seven days out, though confidence drops off past the first few days, which the dashboard flags directly on those day tabs.
      </p>

      <h2 className="sg" style={ui.sectionHeading}>Get notified</h2>
      <p style={pStyle}>
        Head to the Notifications tab to choose which spots you care about, email or text, how strong a signal you want (Good only, or Good & Marginal), and how far in advance to hear about it.
      </p>
    </div>
  );
}
