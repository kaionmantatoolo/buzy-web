// Bus company types
export type BusCompany = 'KMB' | 'CTB' | 'Both';

// Route model - matches Swift Route struct
export interface Route {
  id: string;
  routeNumber: string;
  originEn: string;
  originTc: string;
  destinationEn: string;
  destinationTc: string;
  bound: string;
  serviceType: string;
  stops: StopDetail[];
  isFavorite?: boolean;
  distance?: number;
  company: BusCompany;
  // CTB specific information for joint routes
  ctbOriginEn?: string;
  ctbOriginTc?: string;
  ctbDestinationEn?: string;
  ctbDestinationTc?: string;
}

// Stop detail model - matches Swift StopDetail struct
export interface StopDetail {
  id: string;
  nameEn: string;
  nameTc: string;
  nameSc: string;
  lat: string;
  long: string;
  sequence: number;
  ctbStopId?: string;
  // CTB-specific stop names for joint routes
  ctbNameEn?: string;
  ctbNameTc?: string;
  ctbNameSc?: string;
  // Route context
  routeNumber?: string;
  bound?: string;
}

// Computed helpers for StopDetail
export function getStopUniqueId(stop: StopDetail): string {
  if (stop.routeNumber && stop.bound) {
    return `${stop.routeNumber}-${stop.bound}-${stop.id}-${stop.sequence}`;
  }
  return `${stop.id}-${stop.sequence}`;
}

export function getStopLocation(stop: StopDetail): { lat: number; lng: number } {
  return {
    lat: parseFloat(stop.lat) || 0,
    lng: parseFloat(stop.long) || 0,
  };
}

export function getStopName(stop: StopDetail, locale: string, useCTBInfo: boolean = false): string {
  const isChineseLanguage = locale.startsWith('zh');
  
  // If this is a joint route and the preference is to use CTB info
  if (useCTBInfo && stop.routeNumber && stop.bound) {
    const ctbName = isChineseLanguage ? stop.ctbNameTc : stop.ctbNameEn;
    if (ctbName && ctbName.trim()) {
      return ctbName;
    }
  }
  
  return isChineseLanguage ? stop.nameTc : stop.nameEn;
}

// Route helpers
export function getRouteUniqueIdentifier(route: Route): string {
  return `${route.routeNumber}-${route.bound}-${route.serviceType}-${route.company}`;
}

export function getRouteOrigin(route: Route, locale: string, useCTBInfo: boolean = false): string {
  const isChineseLanguage = locale.startsWith('zh');
  
  if (route.company === 'Both' && useCTBInfo) {
    const ctbOrigin = isChineseLanguage ? route.ctbOriginTc : route.ctbOriginEn;
    if (ctbOrigin && ctbOrigin.trim()) {
      return ctbOrigin;
    }
  }
  
  return isChineseLanguage ? route.originTc : route.originEn;
}

export function getRouteDestination(route: Route, locale: string, useCTBInfo: boolean = false): string {
  const isChineseLanguage = locale.startsWith('zh');
  
  if (route.company === 'Both' && useCTBInfo) {
    const ctbDest = isChineseLanguage ? route.ctbDestinationTc : route.ctbDestinationEn;
    if (ctbDest && ctbDest.trim()) {
      return ctbDest;
    }
  }
  
  return isChineseLanguage ? route.destinationTc : route.destinationEn;
}

// Raw data types from GitHub
export interface HKBusRoute {
  routeNumber: string;
  originEn: string;
  originTc: string;
  destinationEn: string;
  destinationTc: string;
  bound: string;
  serviceType: string;
  company?: string;
  companies?: string[];
  stops: HKBusStop[];
  // CTB-specific fields
  originEnCTB?: string;
  originTcCTB?: string;
  originScCTB?: string;
  destinationEnCTB?: string;
  destinationTcCTB?: string;
  destinationScCTB?: string;
}

export interface HKBusStop {
  id: string;
  nameEn: string;
  nameTc: string;
  nameSc: string;
  lat: number;
  long: number;
  sequence: number;
  ctbStopId?: string;
  // CTB-specific fields
  nameEnCTB?: string;
  nameTcCTB?: string;
  nameScCTB?: string;
}
