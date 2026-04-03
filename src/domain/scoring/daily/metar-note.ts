/**
 * Generates a human-readable METAR note from raw METAR observation data.
 */
export function buildMetarNote(metarRaw: Array<{ rawOb?: string }> | { rawOb?: string } | string): string {
  let metarNote = '';
  try {
    const metarArr = Array.isArray(metarRaw) ? metarRaw : [];
    const raw = (metarArr[0]?.rawOb ?? '') || '';
    if (/OVC0[0-2]\d/.test(raw))     metarNote = '\u26A0\uFE0F METAR: low overcast \u2014 model may be optimistic';
    else if (/BKN0[01]\d/.test(raw)) metarNote = '\u26A0\uFE0F METAR: broken low cloud';
    else if (/CAVOK|SKC|NSC/.test(raw)) metarNote = '\u2705 METAR: clear skies confirmed';
    else if (/FEW|SCT/.test(raw))    metarNote = '\u2705 METAR: partial cloud \u2014 horizon likely clear';
    else if (raw)                    metarNote = 'METAR: ' + raw.substring(0, 60);
  } catch (_e) { /* ignore */ }
  return metarNote;
}
