const FONT_STACK = "DM Sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif";

export const MAIN_EMAIL_MJML = String.raw`<mjml>
  <mj-head>
    <mj-font
      name="DM Sans"
      href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap"
    />
    <mj-attributes>
      <mj-all font-family="${FONT_STACK}" />
      <mj-section padding="0" />
      <mj-column padding="0" />
    </mj-attributes>
    <mj-style>
      .card-shell > table,
      .hero-shell > table {
        box-shadow: 0 1px 3px rgba(26, 22, 20, 0.10), 0 1px 2px rgba(31, 35, 40, 0.06) !important;
      }

      @media (prefers-color-scheme: dark) {
        body {
          background: #0C0A08 !important;
        }

        .card-shell > table {
          background: #1A1612 !important;
          border-color: #2E2822 !important;
          box-shadow: none !important;
        }

        .hero-shell > table {
          background: #100E0C !important;
          border-color: #2E2822 !important;
          box-shadow: none !important;
        }

        [style*="color:#1A1614"] {
          color: #F0EBE3 !important;
        }

        [style*="color:#685E56"],
        [style*="color:#9E9289"] {
          color: #A89E96 !important;
        }

        [style*="color:#1D4ED8"] {
          color: #93C5FD !important;
        }
      }
    </mj-style>
    <mj-raw>
      <meta name="color-scheme" content="light dark" />
      <meta name="supported-color-schemes" content="light dark" />
      <meta name="x-apple-disable-message-reformatting" />
    </mj-raw>
    <mj-title>Aperture · Leeds</mj-title>
  </mj-head>
  <mj-body width="520px" background-color="#FAF9F6">
    <mj-section padding="16px 12px">
      <mj-column padding="0">
        <mj-raw>__CONTENT__</mj-raw>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

export const STANDARD_CARD_MJML = String.raw`<mjml>
  <mj-head>
    <mj-style>
      .card-shell > table {
        box-shadow: 0 1px 3px rgba(26, 22, 20, 0.10), 0 1px 2px rgba(31, 35, 40, 0.06) !important;
      }

      @media (prefers-color-scheme: dark) {
        .card-shell > table {
          background: #1A1612 !important;
          border-color: #2E2822 !important;
          box-shadow: none !important;
        }
      }
    </mj-style>
  </mj-head>
  <mj-body background-color="#FAF9F6" width="520px">
    <mj-raw><!--FRAGMENT_START--></mj-raw>
    <mj-section css-class="card-shell" padding="0" background-color="#FFFFFF" border="1px solid #E2D9CF" border-radius="12px">
      <mj-column padding="16px">
        <mj-raw>__INNER__</mj-raw>
      </mj-column>
    </mj-section>
    <mj-raw><!--FRAGMENT_END--></mj-raw>
  </mj-body>
</mjml>`;

export const HERO_CARD_MJML = String.raw`<mjml>
  <mj-head>
    <mj-style>
      .hero-shell > table {
        box-shadow: 0 1px 3px rgba(26, 22, 20, 0.12), 0 1px 2px rgba(31, 35, 40, 0.08) !important;
      }

      @media (prefers-color-scheme: dark) {
        .hero-shell > table {
          background: #100E0C !important;
          border-color: #2E2822 !important;
          box-shadow: none !important;
        }
      }
    </mj-style>
  </mj-head>
  <mj-body background-color="#FAF9F6" width="520px">
    <mj-raw><!--FRAGMENT_START--></mj-raw>
    <mj-section css-class="hero-shell" padding="0" background-color="#100E0C" border="1px solid #2E2822" border-radius="16px">
      <mj-column padding="16px">
        <mj-raw>__INNER__</mj-raw>
      </mj-column>
    </mj-section>
    <mj-raw><!--FRAGMENT_END--></mj-raw>
  </mj-body>
</mjml>`;

export const SECTION_TITLE_MJML = String.raw`<mjml>
  <mj-body background-color="#FAF9F6" width="520px">
    <mj-raw><!--FRAGMENT_START--></mj-raw>
    <mj-section padding="0">
      <mj-column padding="0">
        <mj-text padding="0 0 12px 0">
          <div style="Margin:0;font-family:${FONT_STACK};font-size:11px;font-weight:700;line-height:1.3;letter-spacing:0.09em;text-transform:uppercase;color:#1A1614;padding-left:11px;border-left:3px solid #E07B2A;">__TITLE__</div>
        </mj-text>
      </mj-column>
    </mj-section>
    <mj-raw><!--FRAGMENT_END--></mj-raw>
  </mj-body>
</mjml>`;
