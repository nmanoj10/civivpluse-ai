/**
 * Phase 3.1 — Public "Resolved" Feed Page
 * Shows CLOSED_RESOLVED issues sorted newest-first with before/after photos.
 * No authentication required — transparency feature.
 */
import React, { useEffect, useState } from 'react';

const API_BASE = (import.meta as any).env.VITE_API_URL || 'http://localhost:5000/api';

interface ResolvedIssue {
  _id: string;
  title: string;
  description: string;
  status: string;
  location: { ward?: string; city?: string; address?: string };
  severity?: string;
  verifiedAt?: string;
  updatedAt: string;
  resolution?: {
    workSummary: string;
    beforeMedia: string[];
    afterMedia: string[];
    resolvedAt?: string;
  };
}

const ResolvedFeed: React.FC = () => {
  const [issues, setIssues] = useState<ResolvedIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 10;

  useEffect(() => {
    fetchResolved();
  }, [page]);

  const fetchResolved = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/issues/feed/resolved?page=${page}&limit=${LIMIT}`);
      const data = await res.json();
      if (data.success) {
        setIssues(data.data.issues);
        setTotal(data.data.pagination.total);
      }
    } catch (err) {
      console.error('Failed to load resolved feed:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.ceil(total / LIMIT);

  const severityColor = (s?: string) => {
    switch (s) {
      case 'CRITICAL': return '#ef4444';
      case 'HIGH': return '#f97316';
      case 'MEDIUM': return '#eab308';
      default: return '#22c55e';
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '2rem' }}>
      {/* Header */}
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
          <h1 style={{ color: '#f1f5f9', fontSize: '2rem', fontWeight: 800, margin: 0 }}>
            Resolved Issues
          </h1>
          <p style={{ color: '#94a3b8', marginTop: '0.5rem' }}>
            Real proof of action — before &amp; after photos of community issues resolved by authorities
          </p>
          <div style={{ display: 'inline-block', background: '#22c55e22', border: '1px solid #22c55e55', borderRadius: '2rem', padding: '0.25rem 1rem', marginTop: '0.5rem' }}>
            <span style={{ color: '#22c55e', fontSize: '0.875rem', fontWeight: 600 }}>{total} issues resolved</span>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
            Loading resolved issues...
          </div>
        ) : issues.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏙️</div>
            <p>No resolved issues yet. Be the first to report and get action!</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {issues.map(issue => (
              <div key={issue._id} style={{
                background: 'rgba(30,41,59,0.8)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '1rem',
                padding: '1.5rem',
                backdropFilter: 'blur(10px)',
              }}>
                {/* Issue Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h2 style={{ color: '#f1f5f9', fontSize: '1.1rem', fontWeight: 700, margin: '0 0 0.25rem' }}>
                      {issue.title}
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>
                      📍 {issue.location.ward || issue.location.city || 'Unknown location'}
                      {issue.resolution?.resolvedAt && (
                        <> · ✅ Resolved {new Date(issue.resolution.resolvedAt).toLocaleDateString()}</>
                      )}
                    </p>
                  </div>
                  {issue.severity && (
                    <span style={{
                      background: `${severityColor(issue.severity)}22`,
                      border: `1px solid ${severityColor(issue.severity)}55`,
                      color: severityColor(issue.severity),
                      borderRadius: '0.5rem',
                      padding: '0.2rem 0.6rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}>
                      {issue.severity}
                    </span>
                  )}
                </div>

                {/* Resolution Summary */}
                {issue.resolution?.workSummary && (
                  <div style={{
                    background: 'rgba(34,197,94,0.08)',
                    border: '1px solid rgba(34,197,94,0.2)',
                    borderRadius: '0.75rem',
                    padding: '0.75rem 1rem',
                    marginBottom: '1rem',
                    color: '#86efac',
                    fontSize: '0.875rem',
                  }}>
                    🔧 <strong>Resolution:</strong> {issue.resolution.workSummary}
                  </div>
                )}

                {/* Before / After Photos */}
                {((issue.resolution?.beforeMedia?.length ?? 0) > 0 || (issue.resolution?.afterMedia?.length ?? 0) > 0) && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {/* Before */}
                    {issue.resolution?.beforeMedia && issue.resolution.beforeMedia.length > 0 && (
                      <div>
                        <p style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
                          BEFORE
                        </p>
                        <img
                          src={issue.resolution.beforeMedia[0]}
                          alt="Before resolution"
                          style={{ width: '100%', borderRadius: '0.75rem', objectFit: 'cover', maxHeight: 200, border: '2px solid rgba(239,68,68,0.3)' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                    )}
                    {/* After */}
                    {issue.resolution?.afterMedia && issue.resolution.afterMedia.length > 0 && (
                      <div>
                        <p style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 600, margin: '0 0 0.5rem' }}>
                          AFTER
                        </p>
                        <img
                          src={issue.resolution.afterMedia[0]}
                          alt="After resolution"
                          style={{ width: '100%', borderRadius: '0.75rem', objectFit: 'cover', maxHeight: 200, border: '2px solid rgba(34,197,94,0.3)' }}
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Share Button */}
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <a
                    href={`/issues/${issue._id}`}
                    style={{
                      background: 'rgba(99,102,241,0.2)',
                      border: '1px solid rgba(99,102,241,0.4)',
                      color: '#a5b4fc',
                      borderRadius: '0.5rem',
                      padding: '0.4rem 1rem',
                      fontSize: '0.8rem',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    🔗 Share
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)',
                color: '#a5b4fc', borderRadius: '0.5rem', padding: '0.4rem 1rem', cursor: 'pointer',
                opacity: page === 1 ? 0.4 : 1,
              }}
            >
              ← Prev
            </button>
            <span style={{ color: '#94a3b8', lineHeight: '2rem' }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)',
                color: '#a5b4fc', borderRadius: '0.5rem', padding: '0.4rem 1rem', cursor: 'pointer',
                opacity: page === totalPages ? 0.4 : 1,
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResolvedFeed;
