import { useEffect, useState } from 'react';
import './App.css';

function App() {
  const [calls, setCalls] = useState<any[]>([]);

  useEffect(() => {
    // Connects to Node.js backend reporting websocket
    const ws = new WebSocket('ws://localhost:3000/ops');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'CALL_UPDATE') {
        setCalls(prev => {
          const existing = prev.find(c => c.id === data.call.id);
          if (existing) return prev.map(c => c.id === data.call.id ? data.call : c);
          return [...prev, data.call];
        });
      }
    };

    return () => ws.close();
  }, []);

  return (
    <div className="container">
      <h1>Antigravity AI - Live Ops Dashboard</h1>
      <div className="metrics">
        <div className="metric-card">
          <h3>Active Calls</h3>
          <p>{calls.filter(c => c.status === 'IN_PROGRESS').length}</p>
        </div>
        <div className="metric-card">
          <h3>Transferred</h3>
          <p>{calls.filter(c => c.status === 'TRANSFERRED').length}</p>
        </div>
        <div className="metric-card">
          <h3>Resolved</h3>
          <p>{calls.filter(c => c.status === 'RESOLVED').length}</p>
        </div>
      </div>
      
      <h2>Live Call Stream</h2>
      <table border={1} cellPadding={10} style={{ width: '100%', marginTop: '20px', textAlign: 'left' }}>
        <thead>
          <tr>
            <th>Call ID</th>
            <th>Intent</th>
            <th>Status</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          {calls.map(call => (
            <tr key={call.id}>
              <td>{call.id}</td>
              <td>{call.intent || 'Detecting...'}</td>
              <td>{call.status}</td>
              <td>{call.duration_sec}s</td>
            </tr>
          ))}
          {calls.length === 0 && (
            <tr><td colSpan={4}>No active calls right now.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default App;
