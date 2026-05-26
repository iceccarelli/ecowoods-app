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
