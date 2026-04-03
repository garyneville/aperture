export interface SiteDocumentOptions {
  title: string;
  generatedAt: string;
  canonicalUrl?: string;
}

export function renderSiteDocument(content: string, options: SiteDocumentOptions): string {
  const { title, generatedAt, canonicalUrl } = options;
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="generator" content="Aperture photo-brief">
  <title>${title}</title>
  ${canonicalUrl ? `<link rel="canonical" href="${canonicalUrl}">` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&display=swap" rel="stylesheet">
  <style>
    /* ── Design tokens ─────────────────────────────────────────────── */
    :root {
      /* Structural/adaptive — override in dark mode */
      --c-page:             #faf9f6;
      --c-surface:          #ffffff;
      --c-surface-variant:  #f4efe8;
      --c-outline:          #e2d9cf;
      --c-outline-muted:    rgba(226,217,207,0.6);
      --c-shadow:           rgba(26,22,20,0.10);
      --c-shadow-lg:        rgba(26,22,20,0.16);
      --c-ink:              #1a1614;
      --c-muted:            #685e56;
      --c-subtle:           #706a63;

      /* Brand & semantic — same in both modes */
      --c-brand:            #e07b2a;
      --c-primary:          #2563eb;
      --c-primary-container:    #dbeafe;
      --c-on-primary-container: #1d4ed8;
      --c-secondary:        #047857;
      --c-secondary-container:  #d1fae5;
      --c-on-secondary-container: #047857;
      --c-tertiary:         #7c3aed;
      --c-tertiary-container:   #ede9fe;
      --c-warning:          #92400e;
      --c-warning-container:    #fef3c7;
      --c-success:          #047857;
      --c-success-container:    #d1fae5;
      --c-error:            #991b1b;
      --c-error-container:  #fee2e2;
      --c-accent:           #7c3aed;
      --c-accent-container: #ede9fe;

      /* Hero card — always dark */
      --c-hero-start:       #100e0c;
      --c-hero-end:         #1c1713;

      /* Spacing (Carbon-ish 4px base) */
      --sp-1: 4px;
      --sp-2: 8px;
      --sp-3: 12px;
      --sp-4: 16px;
      --sp-5: 20px;
      --sp-6: 24px;

      /* Layout */
      --content-width: 720px;
      --card-radius:   10px;
      --card-padding:  16px 18px;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --c-page:            #0c0a08;
        --c-surface:         #1a1612;
        --c-surface-variant: #231e18;
        --c-outline:         #2e2822;
        --c-outline-muted:   rgba(46,40,34,0.6);
        --c-shadow:          rgba(0,0,0,0.30);
        --c-shadow-lg:       rgba(0,0,0,0.45);
        --c-ink:             #f0ebe3;
        --c-muted:           #a89e96;
        --c-subtle:          #706a63;

        /* Semantic containers adapt for legibility on dark surfaces */
        --c-primary-container:    #1e3a8a;
        --c-on-primary-container: #93c5fd;
        --c-secondary-container:  #064e3b;
        --c-on-secondary-container: #6ee7b7;
        --c-tertiary-container:   #4c1d95;
        --c-warning-container:    #451a03;
        --c-warning:              #fbbf24;
        --c-success-container:    #064e3b;
        --c-success:              #34d399;
        --c-error-container:      #7f1d1d;
        --c-error:                #f87171;
        --c-primary:              #60a5fa;
        --c-on-primary-container: #93c5fd;
        --c-tertiary:             #a78bfa;
        --c-accent:               #a78bfa;
        --c-accent-container:     #4c1d95;
      }
    }

    /* ── Reset & base ───────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html { font-size: 16px; }

    body {
      background: var(--c-page);
      color: var(--c-ink);
      font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI',
                   'Noto Sans', Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* ── Layout ─────────────────────────────────────────────────────── */
    .page-wrap {
      min-height: 100vh;
      padding: 20px 16px 56px;
    }

    .content {
      max-width: var(--content-width);
      margin: 0 auto;
    }

    .section-stack {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }

    .section-group {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
    }

    .section-group + .section-group,
    .section-group + .section-stack {
      margin-top: var(--sp-6);
    }

    .section-stack + .section-group,
    .section-stack + .section-stack {
      margin-top: var(--sp-6);
    }

    /* ── Section heading (GitHub Primer UnderlineNav style) ──────────── */
    .section-heading {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--c-muted);
      padding-bottom: var(--sp-2);
      border-bottom: 2px solid var(--c-outline);
      margin-bottom: var(--sp-1);
    }

    /* ── Card ────────────────────────────────────────────────────────── */
    .card {
      background: var(--c-surface);
      border: 1px solid var(--c-outline);
      border-radius: var(--card-radius);
      padding: var(--card-padding);
      box-shadow: 0 1px 2px var(--c-shadow);
    }

    .card + .card { margin-top: 0; } /* gaps handled by flex parent */

    .card--top {
      border-top-width: 3px;
    }

    .card--left {
      border-left-width: 3px;
    }

    .card--hero {
      background: linear-gradient(160deg, var(--c-hero-start) 0%, var(--c-hero-end) 100%);
      border-color: rgba(255,255,255,0.08);
    }

    .card--surface-variant {
      background: var(--c-surface-variant);
      border-color: var(--c-outline-muted);
      box-shadow: none;
    }

    /* ── Card internals ──────────────────────────────────────────────── */
    .card-overline {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--c-subtle);
      margin-bottom: 4px;
    }

    .card-headline {
      font-size: 18px;
      font-weight: 600;
      line-height: 1.24;
      letter-spacing: -0.01em;
      color: var(--c-ink);
    }

    .card-headline--lg {
      font-size: 22px;
      letter-spacing: -0.02em;
    }

    .card-body {
      font-size: 13px;
      line-height: 1.55;
      color: var(--c-muted);
    }

    .card-divider {
      border: none;
      border-top: 1px solid var(--c-outline);
      margin: 14px 0;
    }

    /* ── Hero card internals ─────────────────────────────────────────── */
    .hero-brand {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .hero-brand-left {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .hero-brand-name {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #ffffff;
    }

    .hero-location {
      font-size: 12px;
      color: rgba(255,255,255,0.38);
    }

    .hero-divider {
      border: none;
      border-top: 1px solid rgba(255,255,255,0.10);
      margin: 14px 0;
    }

    .hero-score-row {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 16px;
      align-items: start;
    }

    .hero-score-block {
      min-width: 80px;
    }

    .hero-score-number {
      font-size: 64px;
      font-weight: 700;
      line-height: 1;
      letter-spacing: -0.04em;
      color: var(--c-brand);
    }

    .hero-score-denom {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.35);
      margin-top: 4px;
    }

    .hero-detail {
      border-left: 1px solid rgba(255,255,255,0.10);
      padding-left: 16px;
    }

    .hero-grade {
      font-size: 17px;
      font-weight: 700;
      letter-spacing: 0.02em;
      text-transform: uppercase;
      color: #ffffff;
    }

    .hero-window-label {
      font-size: 13px;
      font-weight: 600;
      line-height: 1.5;
      color: rgba(255,255,255,0.70);
      margin-top: 8px;
    }

    .hero-window-range {
      font-size: 12px;
      font-weight: 400;
      color: rgba(255,255,255,0.45);
    }

    .hero-date {
      font-size: 11px;
      color: rgba(255,255,255,0.38);
      margin-top: 10px;
    }

    /* ── Stat grid (Carbon-inspired 2-col grid) ──────────────────────── */
    .stat-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.10);
      border-radius: 8px;
      overflow: hidden;
      margin-top: 6px;
    }

    .stat-grid--light {
      background: var(--c-surface-variant);
      border-color: var(--c-outline);
    }

    .stat-cell {
      padding: 10px 12px;
    }

    .stat-cell + .stat-cell {
      border-left: 1px solid rgba(255,255,255,0.12);
    }

    .stat-grid--light .stat-cell + .stat-cell {
      border-left-color: var(--c-outline);
    }

    .stat-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.7);
    }

    .stat-grid--light .stat-label {
      color: var(--c-subtle);
    }

    .stat-value {
      font-size: 15px;
      font-weight: 600;
      line-height: 1.3;
      color: #ffffff;
      margin-top: 4px;
    }

    .stat-grid--light .stat-value {
      color: var(--c-ink);
    }

    /* ── Pill ─────────────────────────────────────────────────────────── */
    .pill {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      border-width: 1px;
      border-style: solid;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.4;
      white-space: nowrap;
    }

    /* ── Chip ─────────────────────────────────────────────────────────── */
    .chip {
      display: inline-block;
      margin: 2px 4px 2px 0;
      padding: 3px 8px;
      border-radius: 6px;
      background: var(--c-surface-variant);
      border: 1px solid var(--c-outline);
      font-size: 11px;
      line-height: 1.4;
      color: var(--c-ink);
      white-space: nowrap;
    }

    .chip-label {
      font-weight: 600;
    }

    /* ── Score pill variants (Primer semantic colours) ───────────────── */
    .score-excellent { color: #047857; background: #d1fae5; border-color: #A3D9B1; }
    .score-good      { color: #1d4ed8; background: #dbeafe; border-color: #A8D4FB; }
    .score-marginal  { color: #92400e; background: #fef3c7; border-color: #EDD17B; }
    .score-poor      { color: #991b1b; background: #fee2e2; border-color: #ECACA5; }

    @media (prefers-color-scheme: dark) {
      .score-excellent { color: #34d399; background: #064e3b; border-color: #065f46; }
      .score-good      { color: #93c5fd; background: #1e3a8a; border-color: #1e40af; }
      .score-marginal  { color: #fbbf24; background: #451a03; border-color: #78350f; }
      .score-poor      { color: #f87171; background: #7f1d1d; border-color: #991b1b; }
    }

    /* ── Chip group ──────────────────────────────────────────────────── */
    .chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      align-items: center;
    }

    /* ── Inline text metrics (Carbon dot-separated) ──────────────────── */
    .metric-run {
      font-size: 13px;
      line-height: 1.5;
      color: var(--c-ink);
    }

    .metric-run-sep {
      color: var(--c-subtle);
      padding: 0 3px;
    }

    /* ── Hourly table (kept as proper table for tabular data) ────────── */
    .hourly-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    .hourly-table caption {
      font-size: 0;
      line-height: 0;
      visibility: hidden;
      caption-side: top;
    }

    .hourly-table th {
      padding: 6px 8px;
      border-bottom: 2px solid var(--c-outline);
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--c-muted);
      text-align: left;
      white-space: nowrap;
    }

    .hourly-table td {
      padding: 6px 8px;
      color: var(--c-ink);
      white-space: nowrap;
      vertical-align: middle;
    }

    .hourly-table tr + tr td {
      border-top: 1px solid var(--c-outline-muted);
    }

    .hourly-table .col-sky { text-align: center; }

    .hourly-table .col-comfort { color: var(--c-muted); }

    .hourly-scroll {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      margin-top: 12px;
    }

    /* ── AI briefing ─────────────────────────────────────────────────── */
    .ai-overline {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.10em;
      text-transform: uppercase;
      color: var(--c-subtle);
      margin-bottom: 8px;
    }

    .ai-body p {
      font-size: 14px;
      line-height: 1.6;
      color: var(--c-ink);
      margin: 0 0 10px;
    }

    .ai-body p:last-child { margin-bottom: 0; }

    /* ── Creative spark (Georgia serif quote) ────────────────────────── */
    .spark-overline {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--c-brand);
      margin-bottom: 12px;
    }

    .spark-quote-mark {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 38px;
      line-height: 0.75;
      color: var(--c-brand);
      opacity: 0.22;
      margin-bottom: 4px;
    }

    .spark-text {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 15px;
      line-height: 1.7;
      color: var(--c-ink);
      font-style: italic;
    }

    /* ── Daylight utility bar ────────────────────────────────────────── */
    .utility-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: var(--sp-2);
    }

    .utility-bar-left {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .utility-label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.09em;
      text-transform: uppercase;
      color: var(--c-subtle);
    }

    .utility-window {
      font-size: 13px;
      font-weight: 600;
      color: var(--c-ink);
    }

    /* ── Composition bullets ─────────────────────────────────────────── */
    .bullet-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .bullet-list li {
      font-size: 13px;
      line-height: 1.5;
      color: var(--c-ink);
      padding-left: 14px;
      position: relative;
      margin-bottom: 6px;
    }

    .bullet-list li:last-child { margin-bottom: 0; }

    .bullet-list li::before {
      content: "•";
      position: absolute;
      left: 0;
      color: var(--c-muted);
    }

    /* ── Kit advisory ────────────────────────────────────────────────── */
    .kit-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .kit-list li {
      font-size: 13px;
      line-height: 1.5;
      color: var(--c-ink);
      padding-left: 16px;
      position: relative;
    }

    .kit-list li::before {
      content: "•";
      position: absolute;
      left: 0;
      color: var(--c-tertiary);
    }

    /* ── Location list (alternatives, long range) ────────────────────── */
    .location-item {
      padding-bottom: 12px;
      margin-bottom: 12px;
      border-bottom: 1px solid var(--c-outline);
    }

    .location-item:last-child {
      padding-bottom: 0;
      margin-bottom: 0;
      border-bottom: none;
    }

    .location-name {
      font-size: 16px;
      font-weight: 600;
      line-height: 1.3;
      color: var(--c-ink);
      margin-bottom: 8px;
    }

    .location-meta {
      font-size: 14px;
      line-height: 1.4;
      color: var(--c-muted);
      margin-top: 4px;
    }

    .location-note {
      font-size: 13px;
      line-height: 1.5;
      color: var(--c-muted);
      margin-top: 8px;
    }

    /* ── Days ahead forecast grid ────────────────────────────────────── */
    .forecast-day-heading {
      font-size: 16px;
      font-weight: 600;
      line-height: 1.3;
      color: var(--c-ink);
      margin-bottom: 8px;
    }

    .forecast-best-line {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.5;
      color: var(--c-ink);
      margin-bottom: 10px;
    }

    /* ── Moon context ────────────────────────────────────────────────── */
    .moon-context {
      font-size: 11px;
      color: rgba(255,255,255,0.36);
      margin-top: 6px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* ── Footer ──────────────────────────────────────────────────────── */
    .page-footer {
      margin-top: 48px;
      padding-top: 20px;
      border-top: 1px solid var(--c-outline);
    }

    .footer-inner {
      max-width: var(--content-width);
      margin: 0 auto;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .footer-brand {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--c-brand);
    }

    .footer-ts {
      font-size: 12px;
      color: var(--c-subtle);
    }

    .footer-sep {
      color: var(--c-outline);
    }

    /* ── Footer score key ────────────────────────────────────────────── */
    .footer-key {
      font-size: 11px;
      line-height: 1.7;
      color: var(--c-subtle);
      margin-top: 10px;
    }

    /* ── Responsive ──────────────────────────────────────────────────── */
    @media (max-width: 480px) {
      .page-wrap { padding: 12px 12px 48px; }
      .hero-score-number { font-size: 52px; }
      .hero-score-row { gap: 10px; }
      .stat-grid { grid-template-columns: 1fr 1fr; }
    }
  </style>
</head>
<body>
  <div class="page-wrap">
    <div class="content">
      ${content}
    </div>
    <footer class="page-footer">
      <div class="footer-inner">
        <span class="footer-brand">Aperture</span>
        <span class="footer-sep">&middot;</span>
        <span class="footer-ts">Generated ${generatedAt}</span>
      </div>
    </footer>
  </div>
</body>
</html>`;
}
