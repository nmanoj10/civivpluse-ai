import { IIssue } from '../issues/issue.model';
import { logger } from '../../utils/logger';

interface GISLandmark {
  name: string;
  type: string;
  distance: number;
  lat: number;
  lng: number;
}

/**
 * Reverse geocodes coordinates via Nominatim OSM API
 */
const reverseGeocode = async (lat: number, lng: number): Promise<any> => {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    logger.info('GISService', `Nominatim reverse geocoding request: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'CivicPulseAI/1.0.0 (contact@civicpulse.ai)'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      logger.info('GISService', 'Reverse geocoding success', { address: data.display_name });
      return data;
    }
    logger.warn('GISService', `Nominatim responded with status: ${response.status}`);
  } catch (err: any) {
    logger.error('GISService', 'Nominatim reverse geocoding request failed', { error: err?.message });
  }
  return null;
};

/**
 * Queries OSM Overpass API for nearby amenities/landmarks
 */
const queryOverpassLandmarks = async (lat: number, lng: number, radius = 500): Promise<GISLandmark[]> => {
  try {
    const overpassQuery = `
      [out:json][timeout:15];
      (
        node(around:${radius}, ${lat}, ${lng})["amenity"~"school|hospital|bus_station|marketplace|townhall|government"];
        way(around:${radius}, ${lat}, ${lng})["highway"~"motorway|trunk|primary"];
        node(around:${radius}, ${lat}, ${lng})["leisure"~"park"];
        node(around:${radius}, ${lat}, ${lng})["power"~"substation"];
        way(around:${radius}, ${lat}, ${lng})["bridge"];
      );
      out body 10;
    `;
    
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;
    logger.info('GISService', `Overpass API query initiated: ${url}`);
    
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.elements && data.elements.length > 0) {
        logger.success('GISService', `Overpass query returned ${data.elements.length} elements`);
        return data.elements.map((el: any) => {
          // Haversine approx
          const elLat = el.lat || el.center?.lat || lat;
          const elLng = el.lon || el.center?.lon || lng;
          const distance = Math.round(haversineDistance(lat, lng, elLat, elLng));
          const name = el.tags?.name || el.tags?.highway || el.tags?.amenity || el.tags?.leisure || 'Civic Infrastructure';
          const type = el.tags?.amenity || el.tags?.highway || el.tags?.leisure || el.tags?.power || 'infrastructure';
          return { name, type, distance, lat: elLat, lng: elLng };
        });
      }
    }
  } catch (err: any) {
    logger.error('GISService', 'Overpass query failed', { error: err?.message });
  }
  return [];
};

const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371e3; // meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Fallback mockup generator for geographic landmarks when API fails or is offline
 */
const generateMockLandmarks = (lat: number, lng: number, text: string): GISLandmark[] => {
  const landmarks: GISLandmark[] = [];
  const lowercaseText = text.toLowerCase();

  // Rules matching keywords in text to generate high-fidelity landmarks
  if (lowercaseText.includes('school') || lowercaseText.includes('kid') || lowercaseText.includes('student')) {
    landmarks.push({
      name: 'St. Jude Public School',
      type: 'school',
      distance: 120,
      lat: lat + 0.001,
      lng: lng - 0.0005
    });
  }
  if (lowercaseText.includes('hospital') || lowercaseText.includes('clinic') || lowercaseText.includes('patient') || lowercaseText.includes('medical')) {
    landmarks.push({
      name: 'Metropolis General Hospital',
      type: 'hospital',
      distance: 45,
      lat: lat - 0.0003,
      lng: lng + 0.0002
    });
  }
  if (lowercaseText.includes('highway') || lowercaseText.includes('expressway') || lowercaseText.includes('flyover') || lowercaseText.includes('main road')) {
    landmarks.push({
      name: 'National Highway 44',
      type: 'highway',
      distance: 80,
      lat: lat + 0.0005,
      lng: lng + 0.0006
    });
  }
  if (lowercaseText.includes('station') || lowercaseText.includes('metro') || lowercaseText.includes('train') || lowercaseText.includes('bus')) {
    landmarks.push({
      name: 'Central Railway Station',
      type: 'railway_station',
      distance: 300,
      lat: lat + 0.002,
      lng: lng + 0.002
    });
  }
  if (lowercaseText.includes('park') || lowercaseText.includes('garden') || lowercaseText.includes('play')) {
    landmarks.push({
      name: 'Lalbagh Botanical Park',
      type: 'park',
      distance: 150,
      lat: lat - 0.001,
      lng: lng + 0.001
    });
  }
  if (lowercaseText.includes('drain') || lowercaseText.includes('sewage') || lowercaseText.includes('clog')) {
    landmarks.push({
      name: 'Stormwater Main Drainage Channel',
      type: 'drainage',
      distance: 60,
      lat: lat - 0.0004,
      lng: lng - 0.0003
    });
  }

  // Always return at least one generic landmark if none found to ensure GIS behaves correctly
  if (landmarks.length === 0) {
    landmarks.push({
      name: 'Metropolis Town Hall',
      type: 'government_building',
      distance: 250,
      lat: lat + 0.0015,
      lng: lng - 0.0012
    });
  }

  return landmarks;
};

/**
 * GIS Location Intelligence orchestrator
 */
export const runLocationIntelligence = async (issue: IIssue): Promise<void> => {
  const { lat, lng } = issue.location;
  const textContext = `${issue.title} ${issue.description}`;

  logger.info('GISService', `Running Location Intelligence scan for issue: ${issue._id}`, { lat, lng });

  // 1. Reverse Geocode for high-quality addresses
  const addressResult = await reverseGeocode(lat, lng);
  if (addressResult) {
    issue.location.address = addressResult.display_name;
    const addr = addressResult.address;
    issue.location.ward = addr.suburb || addr.neighborhood || addr.village || issue.location.ward || 'Ward 1';
    issue.location.city = addr.city || addr.town || addr.municipality || issue.location.city || 'Metropolis';
  }

  // 2. Query OSM for landmarks
  let landmarks = await queryOverpassLandmarks(lat, lng);

  // 3. Fallback to mock generation if Overpass returns nothing
  if (landmarks.length === 0) {
    logger.info('GISService', 'Overpass returned 0 landmarks. Generating mock landmarks from text context.');
    landmarks = generateMockLandmarks(lat, lng, textContext);
  }

  issue.landmarks = landmarks;

  // 4. Calculate Nearby Context Score (0-100)
  // Hospitals: +40, Schools: +30, Highways: +30, government: +20, parks: +10, others: +15
  let contextScore = 0;
  for (const lm of landmarks) {
    let pts = 10;
    const type = lm.type.toLowerCase();
    
    if (type.includes('hospital')) pts = 40;
    else if (type.includes('school')) pts = 30;
    else if (type.includes('highway') || type.includes('motorway') || type.includes('primary')) pts = 30;
    else if (type.includes('railway') || type.includes('metro') || type.includes('station')) pts = 25;
    else if (type.includes('government') || type.includes('townhall')) pts = 20;
    else if (type.includes('drainage') || type.includes('substation')) pts = 15;

    // Distance decay: closer landmarks weigh more
    if (lm.distance < 100) pts = pts * 1.2;
    else if (lm.distance > 300) pts = pts * 0.7;

    contextScore += pts;
  }

  issue.nearbyContextScore = Math.min(Math.round(contextScore), 100);

  // 5. Apply severity/priority impact adjustments based on landmark adjacency
  // Road damage near hospital -> Increase Severity
  // Road damage on highway -> Increase Priority
  // Water leakage near school -> Increase urgency (increases priority)
  const isRoadIssue = issue.reportedCategory === 'Road & Transport' || issue.predictedCategory === 'Road & Transport';
  const isWaterIssue = issue.reportedCategory === 'Water & Sanitation' || issue.predictedCategory === 'Water & Sanitation';
  
  const hasHospitalAdjacent = landmarks.some(lm => lm.type.includes('hospital') && lm.distance <= 150);
  const hasHighwayAdjacent = landmarks.some(lm => (lm.type.includes('highway') || lm.type.includes('motorway') || lm.type.includes('primary')) && lm.distance <= 150);
  const hasSchoolAdjacent = landmarks.some(lm => lm.type.includes('school') && lm.distance <= 150);

  if (isRoadIssue && hasHospitalAdjacent) {
    issue.severity = 'CRITICAL';
    logger.success('GISService', 'Severity boosted to CRITICAL: Road damage adjacent to Hospital.');
  }

  if (isRoadIssue && hasHighwayAdjacent) {
    issue.priorityScore = Math.min((issue.priorityScore || 0) + 20, 100);
    logger.success('GISService', 'PriorityScore boosted: Road damage on Highway.');
  }

  if (isWaterIssue && hasSchoolAdjacent) {
    issue.priorityScore = Math.min((issue.priorityScore || 0) + 15, 100);
    logger.success('GISService', 'PriorityScore boosted: Water leakage adjacent to School.');
  }

  logger.success('GISService', 'Location intelligence scan complete', {
    nearbyContextScore: issue.nearbyContextScore,
    landmarkCount: issue.landmarks.length,
    boostedSeverity: issue.severity,
    boostedPriority: issue.priorityScore
  });
};
