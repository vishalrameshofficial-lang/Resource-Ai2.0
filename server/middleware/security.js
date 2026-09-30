export function maskPhoneNumber(phone) {
  if (!phone || typeof phone !== 'string') return 'N/A';
  const clean = phone.trim();
  if (clean.length <= 4) return '****';
  const last4 = clean.slice(-4);
  const prefix = clean.slice(0, 3);
  return `${prefix} ******${last4}`;
}

export function sanitizeObject(obj, isAuthorizedAdmin = false) {
  if (!obj || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, isAuthorizedAdmin));
  }

  const copy = { ...obj };

  // If user is not authorized or wants masked output
  if (!isAuthorizedAdmin) {
    if (copy.caller_phone) {
      copy.masked_phone = maskPhoneNumber(copy.caller_phone);
      // keep caller_phone masked unless specifically requested by authenticated admin
      copy.caller_phone = maskPhoneNumber(copy.caller_phone);
    }
    if (copy.phone) {
      copy.phone = maskPhoneNumber(copy.phone);
    }
  } else {
    if (copy.caller_phone) {
      copy.masked_phone = maskPhoneNumber(copy.caller_phone);
    }
  }

  return copy;
}

export function sanitizeLog(message) {
  if (typeof message !== 'string') return message;
  return message
    .replace(/(api[_-]?key|token|secret|password)=([^\s&]+)/gi, '$1=***REDACTED***')
    .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1***REDACTED_JWT***');
}
