#!/usr/bin/env bash
# snapshot-apis.sh — Fetch all Aperture API endpoints and save responses
# as numbered markdown files in debug/api-snapshot-<timestamp>/
#
# Usage:
#   ./scripts/snapshot-apis.sh
#   LAT=54.0 LON=-2.1 LOCATION=Malham ./scripts/snapshot-apis.sh
#
# Environment variables (all optional, defaults to Leeds):
#   LAT          — latitude  (default: 53.82703)
#   LON          — longitude (default: -1.570755)
#   TIMEZONE     — timezone  (default: Europe/London)
#   ICAO         — METAR station (default: EGNM)
#   NASA_API_KEY — NASA DONKI key (default: DEMO_KEY)
#   SUNSETHUE_API_KEY — SunsetHue key (default: empty, header omitted)

set -euo pipefail

# Source keys from home .env if available and not already set
ENV_FILE="${ENV_FILE:-$HOME/Documents/vscode/home/.env}"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

LAT="${PHOTO_WEATHER_LAT:-${LAT:-53.82703}}"
LON="${PHOTO_WEATHER_LON:-${LON:--1.570755}}"
TIMEZONE="${PHOTO_WEATHER_TIMEZONE:-${TIMEZONE:-Europe/London}}"
ICAO="${PHOTO_WEATHER_ICAO:-${ICAO:-EGNM}}"
NASA_API_KEY="${NASA_API_KEY:-DEMO_KEY}"
SUNSETHUE_API_KEY="${SUNSETHUE_API_KEY:-}"

TZ_ENC=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$TIMEZONE'))")

STAMP=$(date -u +%Y-%m-%dT%H%M%S)
DIR="debug/api-snapshot-${STAMP}"
mkdir -p "$DIR"

# NASA DONKI date range: 3 days ago to 4 days ahead
if [[ "$(uname)" == "Darwin" ]]; then
  DONKI_START=$(date -u -v-3d +%Y-%m-%d)
  DONKI_END=$(date -u -v+4d +%Y-%m-%d)
else
  DONKI_START=$(date -u -d '-3 days' +%Y-%m-%d)
  DONKI_END=$(date -u -d '+4 days' +%Y-%m-%d)
fi

# Azimuth sample point: 25km west (approximate)
AZ_LAT=$(python3 -c "print(round($LAT, 4))")
AZ_LON=$(python3 -c "
import math
lat_r = math.radians($LAT)
lon_r = math.radians($LON)
d = 25 / 6371
brng = math.radians(270)
lat2 = math.asin(math.sin(lat_r)*math.cos(d) + math.cos(lat_r)*math.sin(d)*math.cos(brng))
lon2 = lon_r + math.atan2(math.sin(brng)*math.sin(d)*math.cos(lat_r), math.cos(d)-math.sin(lat_r)*math.sin(lat2))
print(round(math.degrees(lon2), 4))
")

# Alt location: first nearby alternative (Malham Cove hardcoded as representative)
ALT_LAT="${ALT_LAT:-54.069}"
ALT_LON="${ALT_LON:--2.158}"
ALT_NAME="${ALT_NAME:-Malham Cove}"

# ─── API definitions ─────────────────────────────────────────────────────────
# Each entry: number|label|url
APIS=(
  "01|Weather (UKMO)|https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&models=ukmo_seamless&hourly=cloudcover,cloudcover_low,cloudcover_mid,cloudcover_high,visibility,temperature_2m,relativehumidity_2m,dewpoint_2m,precipitation,windspeed_10m,windgusts_10m,winddirection_10m,cape,vapour_pressure_deficit,direct_radiation,diffuse_radiation,soil_temperature_0cm&daily=sunrise,sunset&timezone=${TZ_ENC}&forecast_days=5"
  "02|Air Quality|https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${LAT}&longitude=${LON}&hourly=aerosol_optical_depth,dust,uv_index,european_aqi,pm2_5,alder_pollen,birch_pollen,grass_pollen&timezone=${TZ_ENC}&forecast_days=5"
  "03|METAR (${ICAO})|https://aviationweather.gov/api/data/metar?ids=${ICAO}&format=json&taf=false"
  "04|SunsetHue|https://api.sunsethue.com/forecast?latitude=${LAT}&longitude=${LON}"
  "05|Precip Prob|https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=precipitation_probability,lightning_potential&timezone=${TZ_ENC}&forecast_days=5"
  "06|Ensemble|https://ensemble-api.open-meteo.com/v1/ensemble?latitude=${LAT}&longitude=${LON}&hourly=cloudcover&models=ecmwf_ifs025&timezone=${TZ_ENC}&forecast_days=5"
  "07|Alt Weather (${ALT_NAME})|https://api.open-meteo.com/v1/forecast?latitude=${ALT_LAT}&longitude=${ALT_LON}&models=ukmo_seamless&hourly=cloudcover,cloudcover_low,cloudcover_mid,cloudcover_high,visibility,temperature_2m,relativehumidity_2m,dewpoint_2m,precipitation_probability,precipitation,windspeed_10m,windgusts_10m,total_column_integrated_water_vapour,snowfall,snow_depth&daily=sunrise,sunset&timezone=${TZ_ENC}&forecast_days=5"
  "08|Azimuth Weather (25km west)|https://api.open-meteo.com/v1/forecast?latitude=${AZ_LAT}&longitude=${AZ_LON}&hourly=cloudcover,cloudcover_low,cloudcover_mid,cloudcover_high,precipitation_probability,precipitation,visibility,windspeed_10m&timezone=${TZ_ENC}&forecast_days=5"
  "09|Kp Index|https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json"
  "10|AuroraWatch UK|https://aurorawatch.lancs.ac.uk/api/0.1/status.xml"
  "11|NASA DONKI CME|https://api.nasa.gov/DONKI/CME?startDate=${DONKI_START}&endDate=${DONKI_END}&api_key=${NASA_API_KEY}"
  "12|ECMWF Supplement|https://api.open-meteo.com/v1/ecmwf?latitude=${LAT}&longitude=${LON}&hourly=soil_temperature_0cm,boundary_layer_height&models=ecmwf_ifs025&timezone=${TZ_ENC}&forecast_days=5"
  "13|Satellite Radiation|https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=shortwave_radiation,shortwave_radiation_instant&hourly=shortwave_radiation,shortwave_radiation_instant&models=icon_seamless&forecast_days=1&forecast_hours=6"
  "14|Marine|https://marine-api.open-meteo.com/v1/marine?latitude=${LAT}&longitude=${LON}&hourly=wave_height,wave_direction,wave_period,wave_peak_period&timezone=${TZ_ENC}&forecast_days=5"
)

echo "Snapshot → ${DIR}/"
echo "Location: lat=${LAT} lon=${LON} tz=${TIMEZONE} icao=${ICAO}"
echo ""

for entry in "${APIS[@]}"; do
  IFS='|' read -r num label url <<< "$entry"
  file="${DIR}/${num}-$(echo "$label" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/-$//').md"

  echo -n "  ${num} ${label} ... "

  # Build curl args
  CURL_ARGS=(-s -w '\n%{http_code}' --max-time 30)

  # Add SunsetHue API key header if available
  if [[ "$label" == "SunsetHue" && -n "$SUNSETHUE_API_KEY" ]]; then
    CURL_ARGS+=(-H "x-api-key: ${SUNSETHUE_API_KEY}")
  fi

  # Fetch
  RESPONSE=$(curl "${CURL_ARGS[@]}" "$url" 2>/dev/null || echo -e "\nERROR")
  HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
  BODY=$(echo "$RESPONSE" | sed '$d')

  # Detect content type for formatting
  if echo "$BODY" | head -c1 | grep -q '<'; then
    LANG=""
  else
    LANG=""
  fi

  # Write markdown
  cat > "$file" <<EOF
# HTTP: ${label} — ${STAMP}

**URL:** \`${url}\`
**HTTP status:** ${HTTP_CODE}

\`\`\`
${BODY}
\`\`\`
EOF

  echo "${HTTP_CODE} → $(basename "$file")"

  # Small delay to be polite to rate-limited APIs
  sleep 0.3
done

echo ""
echo "Done. ${#APIS[@]} snapshots saved to ${DIR}/"
