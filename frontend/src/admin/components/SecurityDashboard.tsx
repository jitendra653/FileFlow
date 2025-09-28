
import { useEffect, useState } from 'react';
import api from '../../utils/api';

interface SecurityScore {
  userId: string;
  score: number;
  riskLevel: string;
}

interface Threat {
  id: string;
  type: string;
  description: string;
  detectedAt: string;
}

interface BlockedIP {
  ip: string;
  reason: string;
  blockedAt: string;
}

interface AuditLog {
  timestamp: string;
  action: string;
  user: string;
  details: string;
}

const SecurityDashboard = () => {
  const [scores, setScores] = useState([] as SecurityScore[]);
  const [threats, setThreats] = useState([] as Threat[]);
  const [blockedIPs, setBlockedIPs] = useState([] as BlockedIP[]);
  const [auditLogs, setAuditLogs] = useState([] as AuditLog[]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [scoresRes, threatsRes, ipsRes, auditRes] = await Promise.all([
        api.get('/v1/admin/security-dashboard/scores'),
        api.get('/v1/admin/security-dashboard/threats'),
        api.get('/v1/admin/security-dashboard/blocked-ips'),
        api.get('/v1/admin/security-dashboard/audit-log')
      ]);
      setScores(scoresRes.data.scores || []);
      setThreats(threatsRes.data.threats || []);
      setBlockedIPs(ipsRes.data.ips || []);
      setAuditLogs(auditRes.data.logs || []);
    } catch {
      setError('Could not load security dashboard');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold mb-4">Security Dashboard</h2>
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded shadow">
              <h3 className="font-semibold mb-2">Security Scores</h3>
              <table className="min-w-full text-sm">
                <thead><tr><th>User ID</th><th>Score</th><th>Risk</th></tr></thead>
                <tbody>
                  {scores.map((s: SecurityScore) => (
                    <tr key={s.userId} className="border-t">
                      <td className="p-2">{s.userId}</td>
                      <td className="p-2">{s.score}</td>
                      <td className="p-2">{s.riskLevel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <h3 className="font-semibold mb-2">Active Threats</h3>
              <ul className="list-disc pl-5">
                {threats.length === 0 ? <li>No active threats</li> : threats.map((t: Threat) => (
                  <li key={t.id}><b>{t.type}</b>: {t.description} <span className="text-xs text-gray-500">({new Date(t.detectedAt).toLocaleString()})</span></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-4 rounded shadow">
              <h3 className="font-semibold mb-2">Blocked IPs</h3>
              <ul className="list-disc pl-5">
                {blockedIPs.length === 0 ? <li>No blocked IPs</li> : blockedIPs.map((ip: BlockedIP) => (
                  <li key={ip.ip}><b>{ip.ip}</b> - {ip.reason} <span className="text-xs text-gray-500">({new Date(ip.blockedAt).toLocaleString()})</span></li>
                ))}
              </ul>
            </div>
            <div className="bg-white p-4 rounded shadow max-h-64 overflow-y-auto">
              <h3 className="font-semibold mb-2">Security Audit Log</h3>
              <table className="min-w-full text-xs">
                <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead>
                <tbody>
                  {auditLogs.map((log: AuditLog, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="p-2">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="p-2">{log.user}</td>
                      <td className="p-2">{log.action}</td>
                      <td className="p-2">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SecurityDashboard;
