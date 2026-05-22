const API_URL = process.env.NEXT_PUBLIC_API_URL || 
                process.env.EXPO_PUBLIC_API_URL || 
                'http://localhost:8000';

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `API Error: ${res.status}`);
  }

  return res.json();
}

// Specific helper for leads (used by both web and mobile)
export async function submitLead(lead: Omit<Lead, 'submitted_at'>) {
  return apiRequest<LeadResponse>('/api/leads', {
    method: 'POST',
    body: JSON.stringify({
      ...lead,
      submitted_at: new Date().toISOString(),
      source: 'website', // or 'mobile_app' when called from RN
    }),
  });
}
