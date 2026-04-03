import type { HomeLocation } from '../contracts/home-location.js';

export const DEFAULT_HOME_LOCATION: HomeLocation = {
  name: 'Leeds',
  lat: 53.82703,
  lon: -1.570755,
  timezone: 'Europe/London',
  icao: 'EGNM',
};

export const DEFAULT_BRIEF_WORKFLOW_VERSION = 'debug-trace-v1';

export function resolveHomeLatitude(input?: {
  homeLatitude?: number | null;
  location?: {
    latitude?: number | null;
  };
  debugContext?: {
    metadata?: {
      latitude?: number | null;
    };
  };
}): number {
  if (typeof input?.homeLatitude === 'number' && Number.isFinite(input.homeLatitude)) {
    return input.homeLatitude;
  }
  if (typeof input?.location?.latitude === 'number' && Number.isFinite(input.location.latitude)) {
    return input.location.latitude;
  }
  if (typeof input?.debugContext?.metadata?.latitude === 'number' && Number.isFinite(input.debugContext.metadata.latitude)) {
    return input.debugContext.metadata.latitude;
  }
  return DEFAULT_HOME_LOCATION.lat;
}

export function resolveHomeLocationName(input?: {
  location?: {
    name?: string | null;
  };
  debugContext?: {
    metadata?: {
      location?: string | null;
    };
  };
}): string {
  if (typeof input?.location?.name === 'string' && input.location.name.trim().length > 0) {
    return input.location.name.trim();
  }
  if (typeof input?.debugContext?.metadata?.location === 'string' && input.debugContext.metadata.location.trim().length > 0) {
    return input.debugContext.metadata.location.trim();
  }
  return DEFAULT_HOME_LOCATION.name;
}
