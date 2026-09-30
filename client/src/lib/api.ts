const API_BASE = '/api';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('resourceai_token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const api = {
  // Health
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  // Stats
  async getStats() {
    const res = await fetch(`${API_BASE}/stats`);
    const json = await res.json();
    return json.data;
  },

  // Requests
  async getRequests(filters: Record<string, string> = {}) {
    const query = new URLSearchParams(filters).toString();
    const res = await fetch(`${API_BASE}/requests${query ? `?${query}` : ''}`, {
      headers: getAuthHeaders()
    });
    const json = await res.json();
    return json.data || [];
  },

  async getRequestById(id: string) {
    const res = await fetch(`${API_BASE}/requests/${id}`, {
      headers: getAuthHeaders()
    });
    const json = await res.json();
    return json.data;
  },

  async createRequest(data: any) {
    const res = await fetch(`${API_BASE}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to submit emergency request');
    }
    return res.json();
  },

  async updateRequestStatus(id: string, status: string, adminNotes?: string, governmentReference?: string) {
    const res = await fetch(`${API_BASE}/requests/${id}/status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status, adminNotes, governmentReference })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update request status');
    }
    return res.json();
  },

  // Calls
  async getCalls(filters: Record<string, string> = {}) {
    const query = new URLSearchParams(filters).toString();
    const res = await fetch(`${API_BASE}/calls${query ? `?${query}` : ''}`, {
      headers: getAuthHeaders()
    });
    const json = await res.json();
    return json.data || [];
  },

  async getActiveCalls() {
    const res = await fetch(`${API_BASE}/calls/active`);
    const json = await res.json();
    return json.data || [];
  },

  async getCallById(id: string) {
    const res = await fetch(`${API_BASE}/calls/${id}`, {
      headers: getAuthHeaders()
    });
    const json = await res.json();
    return json.data;
  },

  async getDepartmentStats() {
    const res = await fetch(`${API_BASE}/calls/departments/stats`, {
      headers: getAuthHeaders()
    });
    const json = await res.json();
    return json.data;
  },

  async analyzeCall(id: string, transcript?: string) {
    const res = await fetch(`${API_BASE}/calls/${id}/analyze`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ transcript })
    });
    const json = await res.json();
    return json;
  },

  async updateCallClassification(id: string, data: any) {
    const res = await fetch(`${API_BASE}/calls/${id}/classification`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    const json = await res.json();
    return json;
  },

  // Exotel
  async getExotelStatus() {
    const res = await fetch(`${API_BASE}/exotel/status`);
    return res.json();
  },

  // Voice Agent Test Simulator
  async testVoice(message: string, language = 'English', callerPhone = '+919876543210', sessionId?: string) {
    const res = await fetch(`${API_BASE}/voice/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, language, callerPhone, sessionId })
    });
    return res.json();
  },

  async getVoiceLanguages() {
    const res = await fetch(`${API_BASE}/voice/languages`);
    return res.json();
  },

  // Government Dispatch Workflows
  async verifyRequest(id: string, notes?: string) {
    const res = await fetch(`${API_BASE}/government/verify/${id}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ adminNotes: notes })
    });
    return res.json();
  },

  async forwardToGovernment(id: string, govtRef: string, agencyName?: string, notes?: string) {
    const res = await fetch(`${API_BASE}/government/forward/${id}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ governmentReference: govtRef, agencyName, notes })
    });
    return res.json();
  },

  async allocateResources(id: string, details: string, govtRef?: string) {
    const res = await fetch(`${API_BASE}/government/allocate/${id}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ allocationDetails: details, governmentReference: govtRef })
    });
    return res.json();
  },

  async transitDelivery(id: string, trackingNotes?: string, govtRef?: string) {
    const res = await fetch(`${API_BASE}/government/transit/${id}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ trackingNotes, governmentReference: govtRef })
    });
    return res.json();
  },

  async markDelivered(id: string, resolutionSummary?: string, govtRef?: string) {
    const res = await fetch(`${API_BASE}/government/delivered/${id}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ resolutionSummary, governmentReference: govtRef })
    });
    return res.json();
  },

  // Auth
  async login(email: string, password: string) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data;
  },

  async getMe() {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders()
    });
    return res.json();
  }
};
