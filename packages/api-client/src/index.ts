const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const api = {
  async getJobs() { return (await fetch(`${API}/jobs`)).json(); },
  async createBid(jobId: string, amount: number) { return (await fetch(`${API}/jobs/${jobId}/bids`, { method: 'POST', body: JSON.stringify({ amount }) })).json(); },
  async getProducts() { return (await fetch(`${API}/products`)).json(); },
  connectWS(jobId: string, onMsg: (d: any) => void) {
    const ws = new WebSocket(`ws://localhost:8000/ws/jobs/${jobId}`);
    ws.onmessage = e => onMsg(JSON.parse(e.data));
    return ws;
  }
};

// Professional submitLead implementation
export async function submitLead(data: any, source: string = 'website') {
  const response = await fetch(`${API}/leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, source }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Failed to submit lead');
  }

  return response.json();
}
