import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/shared';
import MediaGallery, { type MediaItem } from '@/components/ui/MediaGallery';
import { connectSocket } from '@/utils/socket';
import { 
  ShieldCheck, BarChart3, AlertCircle, 
  CheckCircle, XCircle, Eye, Activity, PieChart, Info, User, Images
} from 'lucide-react';

interface AdminDashboardProps {
  user: any;
  token: string;
  onLogout: () => void;
}

export default function AdminDashboard({ user, token, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'moderation' | 'analytics'>('moderation');
  const [queue, setQueue] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  
  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [reviewMedia, setReviewMedia] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  const fetchModerationQueue = async () => {
    try {
      const res = await fetch('/api/admin/moderation/review-queue', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setQueue(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/admin/analytics/overview', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setAnalytics(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'moderation') fetchModerationQueue();
    if (activeTab === 'analytics') fetchAnalytics();
  }, [activeTab]);

  // Socket.IO event listener for real-time admin updates
  useEffect(() => {
    const socket = connectSocket(token);

    const handleNewIssue = (newIssue: any) => {
      console.log('Admin received Socket: NEW_ISSUE_CREATED', newIssue);
      if (activeTab === 'moderation') fetchModerationQueue();
      if (activeTab === 'analytics') fetchAnalytics();
      
      setSuccessMsg(`[Live Alert] New issue submitted: "${newIssue.title}"`);
      setTimeout(() => setSuccessMsg(''), 7000);
    };

    const handleIssueUpdated = (updatedIssue: any) => {
      console.log('Admin received Socket: ISSUE_UPDATED', updatedIssue);
      if (activeTab === 'moderation') fetchModerationQueue();
      if (activeTab === 'analytics') fetchAnalytics();
      if (selectedReview && selectedReview.issueId?._id === updatedIssue._id) {
        setSelectedReview((prev: any) => ({
          ...prev,
          issueId: { ...prev.issueId, ...updatedIssue }
        }));
      }
    };

    const handleNotification = (notif: any) => {
      console.log('Admin received Socket: NOTIFICATION_RECEIVED', notif);
      
      // Native web notification
      if (window.Notification && window.Notification.permission === 'granted') {
        new window.Notification(notif.title, { body: notif.message });
      }

      setSuccessMsg(`[Notification] ${notif.title}: ${notif.message}`);
      setTimeout(() => setSuccessMsg(''), 7000);
    };

    socket.on('NEW_ISSUE_CREATED', handleNewIssue);
    socket.on('ISSUE_UPDATED', handleIssueUpdated);
    socket.on('ISSUE_ASSIGNED', handleIssueUpdated);
    socket.on('NOTIFICATION_RECEIVED', handleNotification);

    return () => {
      socket.off('NEW_ISSUE_CREATED', handleNewIssue);
      socket.off('ISSUE_UPDATED', handleIssueUpdated);
      socket.off('ISSUE_ASSIGNED', handleIssueUpdated);
      socket.off('NOTIFICATION_RECEIVED', handleNotification);
    };
  }, [activeTab, selectedReview?.issueId?._id, token]);

  const handleProcessReview = async (reviewId: string, decision: 'APPROVED' | 'REJECTED') => {
    setError('');
    setLoading(true);
    setSuccessMsg('');

    try {
      const res = await fetch(`/api/admin/moderation/review/${reviewId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ decision, resolutionNote })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to process moderation review.');

      setSuccessMsg(`Issue has been successfully ${decision.toLowerCase()}!`);
      setSelectedReview(null);
      setResolutionNote('');
      setReviewMedia([]);
      fetchModerationQueue();
    } catch (err: any) {
      setError(err.message || 'Moderation decision failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectReview = async (review: any) => {
    setSelectedReview(review);
    setReviewMedia([]);
    if (review.issueId?._id) {
      setMediaLoading(true);
      try {
        const res = await fetch(`/api/issues/${review.issueId._id}/media`);
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setReviewMedia(data.data.map((m: any) => ({
            url: m.url,
            thumbnailUrl: m.thumbnailUrl,
            mediaType: m.mediaType,
            mimeType: m.mimeType,
            originalFilename: m.originalFilename,
            isEvidence: m.isEvidence
          })));
        }
      } catch (err) {
        console.error('Failed to load review media:', err);
      } finally {
        setMediaLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-12">
      {/* Header Banner */}
      <header className="bg-slate-800 border-b border-slate-700/60 sticky top-0 z-40 backdrop-blur-md bg-opacity-90">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <span className="font-display font-black text-xl text-white">CP</span>
            </div>
            <div>
              <h1 className="text-xl font-display font-bold tracking-tight text-white">CivicPulse AI <span className="text-xs text-rose-400 font-semibold px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-800/40">Admin Dashboard</span></h1>
              <p className="text-xs text-slate-400 font-medium">Administrator: {user.name} ({user.email})</p>
            </div>
          </div>
          <Button variant="ghost" onClick={onLogout} className="text-xs text-slate-400 hover:text-white border border-slate-700">
            Log Out
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 mt-8 grid lg:grid-cols-12 gap-8">
        {/* Navigation Sidebar */}
        <aside className="lg:col-span-3 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => { setActiveTab('moderation'); setSelectedReview(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${activeTab === 'moderation' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <ShieldCheck className="w-4 h-4" />
              Moderation Queue ({queue.length})
            </button>
            <button 
              onClick={() => { setActiveTab('analytics'); setSelectedReview(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${activeTab === 'analytics' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <BarChart3 className="w-4 h-4" />
              System Analytics
            </button>
          </div>

          {/* Admin Profile Summary Card */}
          <div className="bg-slate-800/80 border border-slate-700/50 rounded-3xl p-5 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <User className="w-4 h-4 text-indigo-400" />
              Admin Profile
            </h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Full Name</p>
                <p className="font-semibold text-white">{user.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Email Address</p>
                <p className="font-medium text-slate-300 truncate">{user.email}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">System Role</p>
                <p className="font-medium text-indigo-400 capitalize">{user.role}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="lg:col-span-9">
          {successMsg && (
            <div className="mb-6 p-4 bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-sm rounded-2xl flex items-center gap-2">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
          
          {error && (
            <div className="mb-6 p-4 bg-red-950/60 border border-red-500/30 text-red-300 text-sm rounded-2xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {selectedReview ? (
            /* Detailed Moderation Review Panel */
            <div className="bg-slate-800 border border-slate-700/50 rounded-3xl p-8 shadow-xl">
              <div className="flex justify-between items-start gap-4 mb-6">
                <div>
                  <button onClick={() => setSelectedReview(null)} className="text-xs text-slate-400 hover:text-white mb-2 block">← Back to Queue</button>
                  <h2 className="text-2xl font-display font-extrabold text-white">Manual Moderation: {selectedReview.issueId?.title}</h2>
                  <p className="text-xs text-rose-300 mt-1 font-semibold">Flagged Reason: {selectedReview.reason}</p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Description</h4>
                  <p className="text-sm text-slate-300 leading-relaxed font-medium bg-slate-900/50 p-4 border border-slate-750 rounded-2xl mb-6">
                    {selectedReview.issueId?.description}
                  </p>

                  {/* Evidence Gallery from ImageKit */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Images className="w-4 h-4 text-rose-400" />
                      Evidence ({reviewMedia.length})
                    </h4>
                    {mediaLoading ? (
                      <div className="flex items-center justify-center py-6 text-slate-500 text-xs">Loading evidence...</div>
                    ) : (
                      <MediaGallery mediaItems={reviewMedia} compact />
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Issue Data Overview</h4>
                  <div className="bg-slate-900/50 p-4 border border-slate-755 rounded-2xl space-y-3 text-sm">
                    <div className="flex justify-between"><span className="text-slate-400">Category:</span> <span className="font-semibold text-white">{selectedReview.issueId?.reportedCategory || 'Other'}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Trust Score:</span> <span className="font-semibold text-white">{selectedReview.issueId?.trustScore ?? 'Pending'}/100</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Location:</span> <span className="font-semibold text-white">{selectedReview.issueId?.location?.address || 'Metropolis'}</span></div>
                  </div>
                </div>
              </div>

              {/* Deciding Action Form */}
              <div className="bg-slate-900/40 border border-slate-750 p-6 rounded-2xl mt-8">
                <h4 className="text-md font-bold text-indigo-300 mb-4 flex items-center gap-2">
                  <Info className="w-5 h-5" />
                  Evaluate & Process Moderation
                </h4>
                <textarea
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Enter moderation assessment note/justification..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 mb-4"
                />
                <div className="flex gap-3">
                  <Button 
                    onClick={() => handleProcessReview(selectedReview._id, 'APPROVED')} 
                    disabled={loading} 
                    className="bg-emerald-600 hover:bg-emerald-500 text-xs font-bold py-2.5 px-6 rounded-xl flex items-center gap-1.5"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve (Release to Verification)
                  </Button>
                  <Button 
                    onClick={() => handleProcessReview(selectedReview._id, 'REJECTED')} 
                    disabled={loading} 
                    className="bg-red-650 hover:bg-red-500 text-xs font-bold py-2.5 px-6 rounded-xl flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" /> Reject as Invalid / Spam
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'moderation' && (
                <div className="bg-slate-800 border border-slate-700/50 rounded-3xl p-6 shadow-xl">
                  <h2 className="text-2xl font-display font-extrabold text-white mb-6">Moderation Review Queue</h2>
                  {queue.length === 0 ? (
                    <p className="text-slate-400 text-sm font-medium py-12 text-center">The moderation queue is currently empty. All clear!</p>
                  ) : (
                    <div className="space-y-4">
                      {queue.map((review) => (
                        <div key={review._id} className="bg-slate-900/60 border border-slate-700/50 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                          <div>
                            <span className="px-2 py-0.5 bg-red-950/40 border border-red-900/40 text-red-400 font-bold text-[9px] uppercase rounded-full">
                              Flagged: Manual Review
                            </span>
                            <h3 className="text-md font-bold text-white mt-2">{review.issueId?.title || 'Unknown Issue'}</h3>
                            <p className="text-xs text-rose-300 mt-1 leading-relaxed">Reason: {review.reason}</p>
                          </div>
                          <button onClick={() => handleSelectReview(review)} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Total Issues", value: analytics?.overview?.totalIssues || 0, color: "text-blue-400" },
                      { label: "Verification Rate", value: `${analytics?.overview?.verificationRate || 0}%`, color: "text-indigo-400" },
                      { label: "Duplicate Rate", value: `${analytics?.overview?.duplicateMergeRate || 0}%`, color: "text-amber-400" },
                      { label: "Resolution Success", value: `${analytics?.resolutions?.successRate || 0}%`, color: "text-emerald-400" }
                    ].map((stat, i) => (
                      <div key={i} className="bg-slate-800 border border-slate-700/50 rounded-2xl p-5 shadow-lg">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{stat.label}</span>
                        <span className={`text-2xl font-display font-black tracking-tight ${stat.color}`}>{stat.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Charts Grid */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-slate-800 border border-slate-700/50 rounded-3xl p-6 shadow-xl">
                      <h3 className="text-md font-bold text-white mb-6 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-400" />
                        Status Distribution
                      </h3>
                      <div className="space-y-3">
                        {analytics?.statusBreakdown?.map((item: any, i: number) => (
                          <div key={i} className="space-y-1 text-xs">
                            <div className="flex justify-between text-slate-300 font-semibold">
                              <span>{item._id}</span>
                              <span>{item.count}</span>
                            </div>
                            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-750">
                              <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min(100, (item.count / (analytics.overview.totalIssues || 1)) * 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-slate-800 border border-slate-700/50 rounded-3xl p-6 shadow-xl">
                      <h3 className="text-md font-bold text-white mb-6 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-indigo-400" />
                        Top Issue Categories
                      </h3>
                      <div className="space-y-3">
                        {analytics?.topCategories?.map((item: any, i: number) => (
                          <div key={i} className="space-y-1 text-xs">
                            <div className="flex justify-between text-slate-300 font-semibold">
                              <span>{item._id || 'Other'}</span>
                              <span>{item.count}</span>
                            </div>
                            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-750">
                              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, (item.count / (analytics.overview.totalIssues || 1)) * 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
