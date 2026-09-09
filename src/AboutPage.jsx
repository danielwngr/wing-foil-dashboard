import React from 'react';
import { COLORS } from './theme.js';
import * as ui from './ui.js';

export default function AboutPage() {
  const pStyle = { color: COLORS.inkSoft, fontSize: 15 };

  return (
    <div style={{ ...ui.page, lineHeight: 1.7 }}>
      <h1 className="sg" style={ui.h1}>About this dashboard</h1>

      <div
        style={{
          background: COLORS.surface,
          borderLeft: `3px solid ${COLORS.teal}`,
          padding: '14px 18px',
          marginBottom: 28,
          fontSize: 14.5,
          color: COLORS.inkSoft,
        }}
      >
        <p style={{ margin: '0 0 12px' }}>
          A quick note before you dig in. I built this tool for myself, to cut down on the time I spend checking forecasts before deciding where to launch. It's a rough, personal project, and it will probably stay that way. That said, if there's a feature or data feed you'd find useful, let me know. Always happy to keep tinkering.
        </p>
        <p style={{ margin: '0 0 12px' }}>
          The weather forecasts are the best free options I can find, but I've also included Windfinder for manual validation (I can only include their widget, no API access).
        </p>
        <p style={{ margin: 0 }}>
          I've included a few spots to start and would love to get smarter about where else is worth winging/surfing. If you know a good public launch that isn't listed yet, please help build out the directory through the "Add a spot" tab.
        </p>
      </div>

      <h2 className="sg" style={ui.sectionHeading}>How to use it</h2>
      <p style={pStyle}>
        Pick a day from the tabs at the top. Each one lists which spots have at least two hours of reliably good conditions that day, sorted by how many hours qualify, with the most reliable window shown in parentheses. Click a spot on the map to see its full hourly breakdown: wind speed and gusts, direction, sky, and temperature, or tap a dot's marker to see the spot's launch description.
      </p>

      <h2 className="sg" style={ui.sectionHeading}>What counts as "good"</h2>
      <ul style={{ ...pStyle, paddingLeft: 20 }}>
        <li>Wind direction has to be within the spot's working range. This is a hard requirement, not a preference. Wrong direction always means no-go, regardless of speed.</li>
        <li>12 to 28 mph sustained wind, in a working direction, counts as Go.</li>
        <li>9 to 11 mph, 29+ mph, or under 9 mph with gusts over 20 mph counts as Marginal.</li>
        <li>Heavy rain or thunderstorms override everything to No-go.</li>
      </ul>
      <p style={pStyle}>
        The hourly chart shows all 24 hours (hours outside 6am to 8pm are shaded), but every summary on this site, including which spots look good, best windows, and day-tab highlights, only ever counts daylight hours toward "good."
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
