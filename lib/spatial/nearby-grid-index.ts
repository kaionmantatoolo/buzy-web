import { Route, StopDetail } from '@/lib/types';
import { calculateDistance } from '@/lib/services/github-data';

type IndexedStop = {
  routeId: string;
  stop: StopDetail;
  lat: number;
  lng: number;
};

type QueryResult = {
  nearbyRoutes: Route[];
  routeToNearestStop: Map<string, { stop: StopDetail; distance: number }>;
  routeDistances: Map<string, number>;
};

// Approx HK latitude for stable lng scaling.
const HK_LAT_DEG = 22.3;
const METERS_PER_DEG_LAT = 111_320;

function metersToLatDeg(meters: number): number {
  return meters / METERS_PER_DEG_LAT;
}

function metersToLngDeg(meters: number): number {
  // Adjust longitude degree length by latitude.
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((HK_LAT_DEG * Math.PI) / 180);
  return meters / metersPerDegLng;
}

function makeCellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function cellCoords(lat: number, lng: number, cellLatDeg: number, cellLngDeg: number): { x: number; y: number } {
  const x = Math.floor(lng / cellLngDeg);
  const y = Math.floor(lat / cellLatDeg);
  return { x, y };
}

class NearbyGridIndex {
  private cellLatDeg: number;
  private cellLngDeg: number;
  private buckets: Map<string, IndexedStop[]>;
  private routeById: Map<string, Route>;

  constructor(cellSizeMeters = 200) {
    this.cellLatDeg = metersToLatDeg(cellSizeMeters);
    this.cellLngDeg = metersToLngDeg(cellSizeMeters);
    this.buckets = new Map();
    this.routeById = new Map();
  }

  rebuild(routes: Route[]) {
    this.buckets.clear();
    this.routeById = new Map(routes.map((r) => [r.id, r]));

    for (const route of routes) {
      for (const stop of route.stops) {
        const lat = parseFloat(stop.lat);
        const lng = parseFloat(stop.long);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        const { x, y } = cellCoords(lat, lng, this.cellLatDeg, this.cellLngDeg);
        const key = makeCellKey(x, y);
        const arr = this.buckets.get(key) ?? [];
        arr.push({ routeId: route.id, stop, lat, lng });
        this.buckets.set(key, arr);
      }
    }
  }

  query(lat: number, lng: number, radiusMeters: number): QueryResult {
    const routeToNearestStop = new Map<string, { stop: StopDetail; distance: number }>();
    const routeDistances = new Map<string, number>();

    const latRadiusDeg = metersToLatDeg(radiusMeters);
    const lngRadiusDeg = metersToLngDeg(radiusMeters);

    const minLat = lat - latRadiusDeg;
    const maxLat = lat + latRadiusDeg;
    const minLng = lng - lngRadiusDeg;
    const maxLng = lng + lngRadiusDeg;

    const minCell = cellCoords(minLat, minLng, this.cellLatDeg, this.cellLngDeg);
    const maxCell = cellCoords(maxLat, maxLng, this.cellLatDeg, this.cellLngDeg);

    for (let y = minCell.y; y <= maxCell.y; y++) {
      for (let x = minCell.x; x <= maxCell.x; x++) {
        const key = makeCellKey(x, y);
        const bucket = this.buckets.get(key);
        if (!bucket) continue;

        for (const item of bucket) {
          const d = calculateDistance(lat, lng, item.lat, item.lng);
          if (d > radiusMeters) continue;

          const prev = routeDistances.get(item.routeId);
          if (prev == null || d < prev) {
            routeDistances.set(item.routeId, d);
            routeToNearestStop.set(item.routeId, { stop: item.stop, distance: d });
          }
        }
      }
    }

    const nearbyRoutes: Route[] = [];
    for (const routeId of routeDistances.keys()) {
      const r = this.routeById.get(routeId);
      if (r) nearbyRoutes.push(r);
    }

    // Sort by distance to closest stop (same as iOS GitHubDataService.fetchNearbyRoutes)
    nearbyRoutes.sort((a, b) => (routeDistances.get(a.id) ?? Infinity) - (routeDistances.get(b.id) ?? Infinity));

    return { nearbyRoutes, routeToNearestStop, routeDistances };
  }
}

// Singleton (in-memory). Rebuilt whenever routes change.
const index = new NearbyGridIndex(200);

export function rebuildNearbyGridIndex(routes: Route[]) {
  index.rebuild(routes);
}

export function queryNearbyRoutesFromGridIndex(lat: number, lng: number, radiusMeters: number): QueryResult {
  return index.query(lat, lng, radiusMeters);
}

