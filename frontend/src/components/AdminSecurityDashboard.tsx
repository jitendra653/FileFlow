import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  Typography,
  Grid,
  List,
  ListItem,
  ListItemText,
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { Line } from 'react-chartjs-2';
import axios from 'axios';
import API_BASE_URL from '../utils/apiConfig';

// Create an authenticated axios instance
const createAuthenticatedApi = (token: string | null) => {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
};

interface SecurityScore {
  score: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: Array<{
    name: string;
    impact: number;
    description: string;
    recommendation?: string;
  }>;
  lastUpdated: string;
}

interface SecurityMetrics {
  scores: Record<string, SecurityScore>;
  threats: Array<{
    type: string;
    source: string;
    message: string;
    details: any;
    timestamp: string;
    threatLevel: number;
  }>;
  blockedIPs: string[];
  sessions: Record<string, string[]>;
  rateLimits: Record<string, any>;
}

const AdminSecurityDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [ipDialogOpen, setIpDialogOpen] = useState(false);
  const [ipToBlock, setIpToBlock] = useState('');
  const navigate = useNavigate();
  
  const token = localStorage.getItem('authToken');
  const api = useMemo(() => createAuthenticatedApi(token), [token]);

  useEffect(() => {
    fetchSecurityMetrics();
    const interval = setInterval(fetchSecurityMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchSecurityMetrics = async () => {
    try {
      if (!token) {
        navigate('/login');
        return;
      }

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const [scores, threats, ips, sessions, rateLimits] = await Promise.all([
        api.get(`${baseUrl}/v1/admin/security/scores`),
        api.get(`${baseUrl}/v1/admin/security/threats`),
        api.get(`${baseUrl}/v1/admin/security/blocked-ips`),
        api.get(`${baseUrl}/v1/admin/security/sessions`),
        api.get(`${baseUrl}/v1/admin/security/rate-limits`)
      ]);

      setMetrics({
        scores: scores.data.metrics,
        threats: threats.data.threats,
        blockedIPs: ips.data.blockedIPs,
        sessions: sessions.data.sessions,
        rateLimits: rateLimits.data.rateLimits
      });
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleBlockIP = async () => {
    try {
      if (!token) {
        navigate('/login');
        return;
      }

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      await api.post(`${baseUrl}/v1/admin/security/ip-block`, {
        ip: ipToBlock,
        action: 'block'
      });
      fetchSecurityMetrics();
      setIpDialogOpen(false);
      setIpToBlock('');
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTerminateSession = async (userId: string) => {
    try {
      if (!token) {
        navigate('/login');
        return;
      }

      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      await api.post(`${baseUrl}/v1/admin/security/terminate-sessions`, {
        userId,
        reason: 'security_risk'
      });
      fetchSecurityMetrics();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return <CircularProgress />;
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  if (!metrics) {
    return <Alert severity="info">No security metrics available</Alert>;
  }

  return (
    <div>
      <Typography variant="h4" gutterBottom>
        Security Dashboard
      </Typography>

      <Grid container spacing={3}>
        {/* Critical Threats */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="error">
                Active Threats ({metrics.threats.length})
              </Typography>
              <List>
                {metrics.threats.map((threat: { message: string; source: string; threatLevel: number; details: { userId: string } }, index: number) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={threat.message}
                      secondary={`Source: ${threat.source} | Level: ${threat.threatLevel}`}
                    />
                    <Button
                      variant="contained"
                      color="secondary"
                      onClick={() => handleTerminateSession(threat.details.userId)}
                    >
                      Terminate Sessions
                    </Button>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Security Scores */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6">Security Scores</Typography>
              <DataGrid
                rows={Object.entries(metrics.scores).map(([userId, score]: [string, SecurityScore]) => ({
                  id: userId,
                  userId,
                  score: score.score,
                  riskLevel: score.riskLevel,
                  lastUpdated: score.lastUpdated
                }))}
                columns={[
                  { field: 'userId', headerName: 'User ID', width: 130 },
                  { field: 'score', headerName: 'Score', width: 90 },
                  { field: 'riskLevel', headerName: 'Risk Level', width: 110 },
                  { field: 'lastUpdated', headerName: 'Last Updated', width: 180 }
                ]}
                autoHeight
                pageSize={5}
                onRowClick={(params: { row: { userId: string } }) => setSelectedUser(params.row.userId)}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* IP Blocklist */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6">
                Blocked IPs ({metrics.blockedIPs.length})
              </Typography>
              <List>
                {metrics.blockedIPs.map((ip: string) => (
                  <ListItem key={ip}>
                    <ListItemText primary={ip} />
                    <Button
                      variant="outlined"
                      onClick={() => {
                        if (!token) {
                          navigate('/login');
                          return;
                        }
                        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
                        api.post(`${baseUrl}/v1/admin/security/ip-block`, {
                          ip,
                          action: 'unblock'
                        }).then(fetchSecurityMetrics);
                      }}
                    >
                      Unblock
                    </Button>
                  </ListItem>
                ))}
              </List>
              <Button
                variant="contained"
                color="primary"
                onClick={() => setIpDialogOpen(true)}
              >
                Block New IP
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Active Sessions */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6">Active Sessions</Typography>
              <List>
                {Object.entries(metrics.sessions).map(([userId, sessions]) => (
                  <ListItem key={userId}>
                    <ListItemText
                      primary={`User: ${userId}`}
                      secondary={`Active Sessions: ${sessions.length}`}
                    />
                    <Button
                      variant="outlined"
                      color="secondary"
                      onClick={() => handleTerminateSession(userId)}
                    >
                      Terminate All
                    </Button>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Block IP Dialog */}
      <Dialog open={ipDialogOpen} onClose={() => setIpDialogOpen(false)}>
        <DialogTitle>Block IP Address</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="IP Address"
            fullWidth
            value={ipToBlock}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIpToBlock(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIpDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleBlockIP} color="primary">
            Block
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default AdminSecurityDashboard;