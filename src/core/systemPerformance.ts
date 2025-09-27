import os from 'os';
import child_process from 'child_process';
import axios from 'axios';
import { Request, Response } from 'express';
import logger from '../utils/logger';

export async function systemPerformanceHandler(req: Request, res: Response) {
  const cpus = os.cpus();
  const cpuInfo = cpus.map((cpu, i) => ({
    model: cpu.model,
    speed: cpu.speed,
    user: cpu.times.user,
    sys: cpu.times.sys,
    idle: cpu.times.idle,
    nice: cpu.times.nice,
    irq: cpu.times.irq
  }));

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const memoryUsagePercent = ((usedMem / totalMem) * 100).toFixed(1);

  const uptime = `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`;
  const loadAverage = os.loadavg().map(n => n.toFixed(2)).join(', ');
  const platform = os.platform();
  const arch = os.arch();
  const hostname = os.hostname();
  const processCount = os.cpus().length;
  const nodeVersion = process.version;
  const lastUpdated = new Date().toLocaleString();

  let diskUsage = 'N/A';
  try {
    if (process.platform !== 'win32') {
      const df = child_process.execSync('df -h /').toString();
      const lines = df.split('\n');
      if (lines[1]) {
        const parts = lines[1].split(/\s+/);
        diskUsage = `${parts[2]} used / ${parts[1]} (${parts[4]})`;
      }
    } else {
      diskUsage = 'Disk usage not available on Windows';
    }
  } catch (e) {
    diskUsage = 'Error fetching disk usage';
  }

  const nets = os.networkInterfaces();
  let netInfo = 'N/A';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        netInfo = `${name}: ${net.address}`;
        break;
      }
    }
    if (netInfo !== 'N/A') break;
  }

  const apiEndpoints = [
    { name: 'Health', url: '/health' },
    { name: 'Security Scores', url: '/v1/admin/security/scores' },
    { name: 'Sessions', url: '/v1/admin/security/sessions' },
    { name: 'Blocked IPs', url: '/v1/admin/security/blocked-ips' },
    { name: 'Threats', url: '/v1/admin/security/threats' }
  ];
  const apiStatus: Record<string, string> = {};
  let token: string | null = null;
  const port = process.env.PORT || 3000;
  try {
    const loginResp = await axios.post(
      `http://localhost:${port}/v1/auth/login`,
      {
        email: 'jitendrapatidar653@gmail.com',
        password: 'Admin@12345'
      },
      { timeout: 2000 }
    );
    token = loginResp.data && (loginResp.data.token || loginResp.data.accessToken);
  } catch (e) {
    apiEndpoints.forEach(api => { apiStatus[api.name] = 'DOWN (Login Failed)'; });
  }
  if (token) {
    for (const api of apiEndpoints) {
      try {
        const resp = await axios.get(api.url, {
          baseURL: `http://localhost:${port}`,
          timeout: 2000,
          headers: { Authorization: `Bearer ${token}` }
        });
        apiStatus[api.name] = resp.status === 200 ? 'UP' : 'DOWN';
      } catch (e) {
        apiStatus[api.name] = 'DOWN';
      }
    }
  }

  res.render('systemPerformance', {
    cpuUsage: (os.loadavg()[0] / os.cpus().length * 100).toFixed(2),
    cpuInfo,
    memoryUsage: (usedMem / 1024 / 1024).toFixed(0),
    memoryUsagePercent,
    freeMemory: (freeMem / 1024 / 1024).toFixed(0),
    totalMemory: (totalMem / 1024 / 1024).toFixed(0),
    uptime,
    loadAverage,
    platform,
    arch,
    hostname,
    processCount,
    nodeVersion,
    diskUsage,
    netInfo,
    lastUpdated,
    apiStatus
  });
}
