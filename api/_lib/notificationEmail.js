// Builds the actual subject/html/text for a notification email, given
// day-grouped matches. Shared by the daily cron (real data) and the manual
// admin test-send (fabricated data), so both exercise the exact same
// rendering code.
//
// dayBlocks: [{ dateStr, dayLabel, isToday, spots: [{ name, score, narrative }] }]
// sorted chronologically.

const INK = '#1B2A3A';
const INK_SOFT = '#9FB0BE';
const BORDER = '#E4E1D8';
const TEXT_MUTED = '#6B7785';
const GO = '#3F8F5F';
const MARGINAL = '#C98A3B';

function pill(score) {
  const color = score === 'good' ? GO : MARGINAL;
  const label = score === 'good' ? 'Go' : 'Marginal';
  return `<span style="background: ${color}; color: #FFFFFF; font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 999px;">${label}</span>`;
}

function dayBlockHtml(block) {
  const rows = block.spots
    .map(
      (s, i) => `
        <div style="padding: 8px 0; ${i > 0 ? `border-top: 0.5px solid ${block.isToday ? '#33465A' : BORDER};` : ''}">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <p style="font-size: 14px; color: ${block.isToday ? '#FFFFFF' : INK}; margin: 0; font-weight: 700;">${s.name}</p>
            ${pill(s.score)}
          </div>
          <p style="font-size: 13px; color: ${block.isToday ? INK_SOFT : TEXT_MUTED}; margin: 6px 0 0; line-height: 1.6;">${s.narrative}</p>
        </div>`
    )
    .join('');

  if (block.isToday) {
    return `
      <div style="background: ${INK}; border-radius: 8px; padding: 14px 16px;">
        <p style="font-size: 13px; color: ${INK_SOFT}; margin: 0 0 4px; font-weight: 700;">${block.dayLabel}</p>
        ${rows}
      </div>`;
  }
  return `
    <div style="border: 0.5px solid ${BORDER}; border-radius: 8px; padding: 14px 16px;">
      <p style="font-size: 13px; color: ${TEXT_MUTED}; margin: 0 0 4px; font-weight: 700;">${block.dayLabel}</p>
      ${rows}
    </div>`;
}

function dayBlockText(block) {
  const lines = block.spots.map((s) => `  ${s.name} (${s.score === 'good' ? 'Go' : 'Marginal'}): ${s.narrative}`);
  return [`${block.dayLabel}:`, ...lines].join('\n');
}

export function buildNotificationEmail({ dayBlocks, manageUrl, siteUrl }) {
  const totalMatches = dayBlocks.reduce((n, b) => n + b.spots.length, 0);
  const subject =
    totalMatches === 1
      ? `${dayBlocks[0].spots[0].name} looks good ${dayBlocks[0].dayLabel}`
      : 'Good wind coming up';

  const html = `
    <div style="background: #FFFFFF; border-radius: 12px; border: 0.5px solid ${BORDER}; overflow: hidden; max-width: 480px; margin: 0 auto; font-family: sans-serif;">
      <div style="background: ${INK}; padding: 20px 24px;">
        <p style="font-size: 17px; font-weight: 700; color: #FFFFFF; margin: 0;">Launch Conditions</p>
        <p style="font-size: 13px; color: ${INK_SOFT}; margin: 4px 0 0;">Your spots are lining up</p>
      </div>
      <div style="padding: 20px 24px 8px;">
        <p style="font-size: 14px; color: ${TEXT_MUTED}; margin: 0;">Here's what's coming up:</p>
      </div>
      <div style="padding: 4px 24px 8px; display: flex; flex-direction: column; gap: 10px;">
        ${dayBlocks.map(dayBlockHtml).join('')}
      </div>
      <div style="padding: 12px 24px 24px;">
        <a href="${siteUrl}" style="display: block; text-align: center; background: ${INK}; color: #FFFFFF; font-size: 14px; font-weight: 700; padding: 12px; border-radius: 8px; text-decoration: none;">View full forecast</a>
      </div>
      <div style="border-top: 0.5px solid ${BORDER}; padding: 14px 24px; text-align: center;">
        <p style="font-size: 12px; color: #9AA3AA; margin: 0;">
          <a href="${manageUrl}" style="color: ${TEXT_MUTED};">Manage notifications</a>, unsubscribe any time
        </p>
      </div>
    </div>`;

  const text =
    `Launch Conditions \u2014 your spots are lining up\n\n` +
    dayBlocks.map(dayBlockText).join('\n\n') +
    `\n\nView full forecast: ${siteUrl}\nManage your settings: ${manageUrl}`;

  return { subject, html, text };
}
