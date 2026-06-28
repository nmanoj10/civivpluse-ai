/**
 * Phase 3.4 — Public Ward Performance Stats Page
 * Shows transparency metrics: total reported, resolved, SLA breach rate, resolution time.
 * No authentication required.
 */
import React, { useEffect, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const WardStats: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [ward, setWard] = useState('Ward-A');

  useEffect(() => {
    fetchStats();
  }, [ward]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/issues/stats/ward?ward=${encodeURIComponent(ward)}`);
      const data = await res.json();
      if (data.success) {
        setStats(data.data);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '2rem' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📊</div>
          <h1 style={{ color: '#f1f5f9', fontSize: '2rem', fontWeight: 800, margin: 0 }}>
            Ward Transparency
          </h1>
          <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>
            Public accountability metrics for your local authorities
          </p>
        </div>

        {/* Filters */}
        <div style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem', padding: '1rem', marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label style={{ color: '#94a3b8', fontWeight: 600 }}>Select Ward:</label>
          <select 
            value={ward} 
            onChange={e => setWard(e.target.value)}
            style={{ padding: '0.5rem', borderRadius: '0.5rem', background: '#334155', color: '#f8fafc', border: 'none', outline: 'none' }}
          >
            <option value="Ward-A">Ward-A</option>
            <option value="Ward-B">Ward-B</option>
            <option value="Downtown">Downtown</option>
          </select>
        </div>

        {/* Stats Grid */}
        {loading ? (
           <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Loading stats...</div>
        ) : stats ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            
            <div style={{ background: 'rgba(30,41,59,0.8)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#f1f5f9' }}>{stats.totalReported}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600 }}>Total Issues Reported</div>
            </div>

            <div style={{ background: 'rgba(30,41,59,0.8)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#22c55e' }}>{stats.totalResolved}</div>
              <div style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600 }}>Total Resolved</div>
            </div>

            <div style={{ background: 'rgba(30,41,59,0.8)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#3b82f6' }}>{stats.resolutionRate}%</div>
              <div style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600 }}>Resolution Rate</div>
            </div>

            <div style={{ background: 'rgba(30,41,59,0.8)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#eab308' }}>
                {stats.avgResolutionDays ? `${stats.avgResolutionDays}d` : 'N/A'}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600 }}>Avg Resolution Time</div>
            </div>

            <div style={{ gridColumn: 'span 2', background: 'rgba(30,41,59,0.8)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.08)', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: stats.slaBreachRate > 20 ? '#ef4444' : '#22c55e' }}>
                {stats.slaBreachRate !== null ? `${stats.slaBreachRate}%` : 'N/A'}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: 600 }}>SLA Breach Rate</div>
            </div>

          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No data available for this ward.</div>
        )}
      </div>
    </div>
  );
};

export default WardStats;
