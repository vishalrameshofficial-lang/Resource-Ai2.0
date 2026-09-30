// Strict validation for Emergency Request extracted by AI or Web Intake
export const VALID_CATEGORIES = [
  'flood',
  'landslide',
  'fire',
  'earthquake',
  'medical',
  'cyclone',
  'building_collapse',
  'drowning',
  'other'
];

export const VALID_URGENCIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const VALID_LANGUAGES = [
  'English',
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Bengali',
  'Odia'
];

export const VALID_STATUSES = [
  'NEW',
  'VERIFIED',
  'FORWARDED_TO_GOVERNMENT',
  'ACCEPTED',
  'RESOURCE_ALLOCATED',
  'DELIVERY_IN_PROGRESS',
  'DELIVERED',
  'REJECTED',
  'CANCELLED'
];

export function validateEmergencyRequest(data) {
  const errors = [];

  if (!data) {
    return { valid: false, errors: ['Missing request payload'] };
  }

  // Caller phone normalization & validation
  const phone = (data.phone || data.caller_phone || '').toString().trim();
  if (!phone || phone.length < 5) {
    errors.push('Valid caller phone number is required');
  }

  // Location validation
  const location = (data.location || '').trim();
  if (!location || location.length < 2) {
    errors.push('Valid location or landmark is required');
  }

  // Category validation
  let category = (data.category || data.emergency_category || 'other').toString().toLowerCase().trim();
  if (!VALID_CATEGORIES.includes(category)) {
    category = 'other';
  }

  // Description
  const description = (data.description || data.what_happened || '').trim();
  if (!description && !data.category && !data.emergency_category) {
    errors.push('Description or nature of emergency is required');
  }

  // Affected people count
  let affectedPeople = parseInt(data.affectedPeople || data.affected_people_count || 1, 10);
  if (isNaN(affectedPeople) || affectedPeople < 1) {
    affectedPeople = 1;
  }

  // Urgency validation
  let urgency = (data.urgency || 'HIGH').toString().toUpperCase().trim();
  if (!VALID_URGENCIES.includes(urgency)) {
    urgency = 'HIGH';
  }

  // Resources needed
  let resources = [];
  if (Array.isArray(data.requirements || data.resources_needed)) {
    resources = data.requirements || data.resources_needed;
  } else if (typeof (data.requirements || data.resources_needed) === 'string') {
    try {
      resources = JSON.parse(data.requirements || data.resources_needed);
    } catch {
      resources = [{ item: data.requirements || data.resources_needed, quantity: 1, unit: 'units' }];
    }
  }

  // Language
  let language = data.language || data.caller_language || 'English';
  const matchedLang = VALID_LANGUAGES.find(l => l.toLowerCase() === language.toLowerCase());
  if (matchedLang) {
    language = matchedLang;
  }

  const normalized = {
    caller_name: (data.name || data.caller_name || 'Anonymous Caller').trim(),
    caller_phone: phone,
    caller_language: language,
    emergency_category: category,
    description: description || `Emergency request for ${category} assistance in ${location}`,
    location: location,
    landmark: (data.landmark || '').trim() || null,
    latitude: typeof data.latitude === 'number' ? data.latitude : null,
    longitude: typeof data.longitude === 'number' ? data.longitude : null,
    affected_people_count: affectedPeople,
    resources_needed: JSON.stringify(resources.length > 0 ? resources : [{ item: 'General Relief / Food & Water', quantity: affectedPeople, unit: 'units' }]),
    urgency: urgency,
    immediate_danger: data.immediateDanger || data.immediate_danger ? 1 : 0,
    source: data.source || 'WEB',
    confirmed: Boolean(data.confirmed)
  };

  return {
    valid: errors.length === 0,
    errors,
    data: normalized
  };
}
