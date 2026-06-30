import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/shared';
import MediaGallery, { type MediaItem } from '@/components/ui/MediaGallery';
import LeafletMap from '@/components/ui/LeafletMap';
import { connectSocket } from '@/utils/socket';
import { 
  ShieldCheck, BarChart3, AlertCircle, 
  CheckCircle, XCircle, Eye, Activity, PieChart, Info, User, Images, Map, AlertTriangle, Clock
} from 'lucide-react';

interface AdminDashboardProps {
  user: any;
  token: string;
  onLogout: () => void;
}

export default function AdminDashboard({ user, token, onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'moderation' | 'analytics' | 'heatmap' | 'escalations'>('moderation');
  const [queue, setQueue] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [allIssues, setAllIssues] = useState<any[]>([]);
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

  const fetchEscalations = async () => {
    try {
      const res = await fetch('/api/admin/moderation/escalations', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setEscalations(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllIssues = async () => {
    try {
      const res = await fetch('/api/issues/feed/community?limit=100');
      const data = await res.json();
      if (data.success && data.data && Array.isArray(data.data.issues)) {
        setAllIssues(data.data.issues);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'moderation') fetchModerationQueue();
    if (activeTab === 'analytics') fetchAnalytics();
    if (activeTab === 'heatmap') fetchAllIssues();
    if (activeTab === 'escalations') fetchEscalations();
  }, [activeTab]);

  // Socket.IO event listener for real-time admin updates
  useEffect(() => {
    const socket = connectSocket(token);

    const handleNewIssue = (newIssue: any) => {
      console.log('Admin received Socket: NEW_ISSUE_CREATED', newIssue);
      if (activeTab === 'moderation') fetchModerationQueue();
      if (activeTab === 'analytics') fetchAnalytics();
      fetchAllIssues();
      
      setSuccessMsg(`[Live Alert] New issue submitted: "${newIssue.title}"`);
      setTimeout(() => setSuccessMsg(''), 7000);
    };

    const handleIssueUpdated = (updatedIssue: any) => {
      console.log('Admin received Socket: ISSUE_UPDATED', updatedIssue);
      if (activeTab === 'moderation') fetchModerationQueue();
      if (activeTab === 'analytics') fetchAnalytics();
      fetchAllIssues();
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

  // Helper component for Status Badge
  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      SUBMITTED: 'bg-blue-50 border-blue-100 text-blue-700',
      OPEN_FOR_COMMUNITY_VERIFICATION: 'bg-amber-50 border-amber-100 text-amber-700',
      ASSIGNED_TO_AUTHORITY: 'bg-purple-50 border-purple-100 text-purple-700',
      IN_PROGRESS: 'bg-indigo-50 border-indigo-100 text-indigo-700',
      RESOLVED: 'bg-emerald-50 border-emerald-100 text-emerald-750',
      CLOSED_RESOLVED: 'bg-slate-50 border-slate-100 text-slate-550',
      PENDING_CITIZEN_CONFIRMATION: 'bg-indigo-50 border-indigo-150 text-indigo-700'
    };
    const style = styles[status] || 'bg-slate-50 border-slate-100 text-slate-550';
    return (
      <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border shadow-sm ${style}`}>
        {status?.replace(/_/g, ' ') || 'OPEN'}
      </span>
    );
  };

  // Premium Placeholder
  const PremiumPlaceholder = () => (
    <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center py-8">
      <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mb-3">
        <ShieldCheck className="w-6 h-6 text-indigo-650 animate-pulse" />
      </div>
      <span className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">CIVICPULSE AI EVIDENCE</span>
      <span className="text-[9px] text-slate-450 mt-1">Satellite coordinate lock active</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans pb-12">
      {/* Top Navbar */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40 backdrop-blur-md bg-opacity-95 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <span className="font-display font-black text-xl text-white">CP</span>
            </div>
            <div>
              <h1 className="text-xl font-display font-black tracking-tight text-indigo-650 flex items-center gap-2">
                CivicPulse AI 
                <span className="text-[10px] text-rose-600 font-bold px-2.5 py-1 rounded-full bg-rose-50 border border-rose-105 shadow-sm">
                  Admin Dashboard
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 border-l border-slate-10 pl-4">
              <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 font-bold text-xs flex items-center justify-center shadow-inner uppercase">
                {user.name.slice(0, 2)}
              </div>
              <span className="text-xs font-bold text-slate-750 hidden sm:inline">{user.name}</span>
              <button onClick={onLogout} className="text-[10px] text-slate-400 hover:text-red-500 font-bold ml-2 transition-colors">Logout</button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 mt-8 grid lg:grid-cols-12 gap-8">
        {/* Navigation Sidebar */}
        <aside className="lg:col-span-3 flex flex-col gap-5">
          <div className="bg-white border border-slate-100 rounded-[24px] p-5 shadow-sm space-y-1.5">
            <button 
              onClick={() => { setActiveTab('moderation'); setSelectedReview(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${activeTab === 'moderation' ? 'bg-indigo-50 border border-indigo-100/70 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              <ShieldCheck className="w-4 h-4" />
              Moderation Queue ({queue.length})
            </button>
            <button 
              onClick={() => { setActiveTab('analytics'); setSelectedReview(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${activeTab === 'analytics' ? 'bg-indigo-50 border border-indigo-100/70 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              <BarChart3 className="w-4 h-4" />
              System Analytics
            </button>
            <button 
              onClick={() => { setActiveTab('heatmap'); setSelectedReview(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${activeTab === 'heatmap' ? 'bg-indigo-50 border border-indigo-100/70 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              <Map className="w-4 h-4" />
              City Heatmap
            </button>
            <button 
              onClick={() => { setActiveTab('escalations'); setSelectedReview(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${activeTab === 'escalations' ? 'bg-indigo-50 border border-indigo-100/70 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              <AlertTriangle className="w-4 h-4" />
              SLA Escalations ({escalations.length})
            </button>
          </div>

          {/* Admin Profile Summary Card */}
          <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm space-y-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <User className="w-4 h-4 text-indigo-600" />
              Admin Profile
            </h3>
            <div className="space-y-4 text-xs font-medium text-slate-650">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Full Name</p>
                <p className="font-bold text-slate-800 text-sm mt-0.5">{user.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Email Address</p>
                <p className="font-semibold text-slate-700 mt-0.5 truncate">{user.email}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">System Role</p>
                <p className="font-bold text-rose-600 capitalize mt-0.5">{user.role}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="lg:col-span-9">
          {successMsg && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2 shadow-sm shadow-emerald-500/5">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}
          
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-2xl flex items-center gap-2 shadow-sm shadow-rose-500/5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {selectedReview ? (
            /* Redesigned Detailed Moderation Review Panel */
            <div className="bg-white border border-slate-100 rounded-[24px] p-8 shadow-sm space-y-8">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <button onClick={() => setSelectedReview(null)} className="text-xs text-slate-405 hover:text-indigo-600 font-bold mb-3 flex items-center gap-1 transition-colors">
                    ← Back to Queue
                  </button>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-snug">Manual Moderation Review</h2>
                  <p className="text-xs text-rose-600 font-bold mt-1 uppercase tracking-wider flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Flagged Reason: {selectedReview.reason}
                  </p>
                </div>
              </div>

              <div className="grid lg:grid-cols-12 gap-8">
                {/* Left Column: Issue details */}
                <div className="lg:col-span-7 space-y-6">
                  <div>
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Original Description</h4>
                    <p className="text-sm text-slate-650 leading-relaxed font-semibold bg-slate-50 p-4 border border-slate-100 rounded-2xl">
                      {selectedReview.issueId?.description || 'No description provided.'}
                    </p>
                  </div>

                  {/* Review Media Evidence */}
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Images className="w-4 h-4 text-indigo-650" />
                      Uploaded Verification Media
                    </h3>
                    {mediaLoading ? (
                      <div className="h-48 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 text-xs font-semibold">
                        Loading media files...
                      </div>
                    ) : reviewMedia.length === 0 ? (
                      <div className="aspect-video w-full border border-slate-100 rounded-2xl overflow-hidden shadow-inner">
                        <PremiumPlaceholder />
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <MediaGallery mediaItems={reviewMedia} compact={reviewMedia.length > 2} />
                      </div>
                    )}
                  </div>

                  {/* Map Coordinate Location */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Map className="w-4 h-4 text-indigo-650" />
                      Incident Jurisdictional Map
                    </h3>
                    {selectedReview.issueId?.location?.lat && selectedReview.issueId?.location?.lng && (
                      <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                        <LeafletMap
                          center={[selectedReview.issueId.location.lat, selectedReview.issueId.location.lng]}
                          zoom={15}
                          issues={[{
                            _id: selectedReview.issueId._id,
                            title: selectedReview.issueId.title,
                            status: selectedReview.issueId.status,
                            location: selectedReview.issueId.location
                          }]}
                          landmarks={[]}
                          jurisdictionRadius={1500}
                          className="w-full h-[250px]"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Moderation actions */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-slate-50/50 p-6 border border-slate-100 rounded-[24px] space-y-4">
                    <h3 className="text-xs font-bold text-slate-450 uppercase tracking-widest flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-rose-605" />
                      System Metadata Information
                    </h3>
                    <div className="space-y-3.5 text-xs font-medium text-slate-600">
                      <div>
                        <span className="block text-[10px] text-slate-400 uppercase">Issue ID</span>
                        <span className="font-bold text-slate-800 mt-0.5 truncate block">{selectedReview.issueId?._id}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 uppercase">Category</span>
                        <span className="font-bold text-slate-800 mt-0.5 block">{selectedReview.issueId?.category || 'Road & Transport'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 uppercase">Status</span>
                        <span className="font-bold text-slate-800 mt-0.5 block">{selectedReview.issueId?.status}</span>
                      </div>
                    </div>
                  </div>

                  {/* Moderation actions input */}
                  <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm space-y-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-655" />
                      Moderation Ruling Actions
                    </h4>
                    
                    <div className="space-y-4 text-xs">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Resolution Note / Moderation Remarks</label>
                        <textarea
                          rows={3}
                          value={resolutionNote}
                          onChange={(e) => setResolutionNote(e.target.value)}
                          placeholder="Detail ruling parameters for auditing logs..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2.5">
                        <button
                          onClick={() => handleProcessReview(selectedReview._id, 'APPROVED')}
                          className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
                        >
                          Approve Report
                        </button>
                        <button
                          onClick={() => handleProcessReview(selectedReview._id, 'REJECTED')}
                          className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-rose-500/10 cursor-pointer"
                        >
                          Dismiss Report
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Moderation Queue Tab */}
              {activeTab === 'moderation' && (
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-indigo-600" />
                      Moderation Queue
                    </h2>
                    <p className="text-xs text-slate-500 font-semibold mt-1">Audit and clear reports flagged for manual validation or category mismatches.</p>
                  </div>

                  {queue.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl py-12 text-center text-slate-450 text-sm font-semibold">No flagged reviews in moderation queue. Platform safe!</div>
                  ) : (
                    <div className="grid gap-6">
                      {queue.map((review) => {
                        const issue = review.issueId || {};
                        const mediaUrl = issue.media?.[0]?.imageUrl || issue.thumbnail;
                        return (
                          <div 
                            key={review._id} 
                            className="bg-white border border-slate-100 hover:border-slate-200 rounded-[24px] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all duration-300 shadow-sm relative group"
                          >
                            <div className="aspect-video w-full md:w-48 rounded-xl overflow-hidden bg-slate-955 border border-slate-100 shrink-0 relative">
                              {mediaUrl ? (
                                <img src={mediaUrl} alt={issue.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              ) : (
                                <PremiumPlaceholder />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <span className="px-2.5 py-0.5 bg-rose-50 border border-rose-100 text-rose-700 font-bold text-[9px] uppercase rounded-full">
                                Flagged
                              </span>
                              <h3 className="text-sm font-black text-slate-900 mt-2.5 truncate">{issue.title || 'Unknown Issue'}</h3>
                              <p className="text-xs text-rose-605 font-semibold mt-1.5">Reason: {review.reason}</p>
                            </div>

                            <div className="shrink-0 flex items-center gap-2 pl-4 border-l border-slate-100 h-12">
                              <button 
                                onClick={() => handleSelectReview(review)}
                                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                              >
                                Review Report
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* System Analytics Tab */}
              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  {/* KPI Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Total Issues", value: analytics?.overview?.totalIssues || 0, color: "text-indigo-650" },
                      { label: "Verification Rate", value: `${analytics?.overview?.verificationRate || 0}%`, color: "text-blue-600" },
                      { label: "Duplicate Rate", value: `${analytics?.overview?.duplicateMergeRate || 0}%`, color: "text-amber-600" },
                      { label: "Resolution Success", value: `${analytics?.resolutions?.successRate || 0}%`, color: "text-emerald-600" }
                    ].map((stat, i) => (
                      <div key={i} className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all duration-300">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{stat.label}</span>
                        <span className={`text-2xl font-black tracking-tight ${stat.color}`}>{stat.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Charts Grid */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm">
                      <h3 className="text-xs font-black text-slate-905 uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-105 pb-2">
                        <Activity className="w-4 h-4 text-indigo-600 animate-pulse" />
                        Status Distribution
                      </h3>
                      <div className="space-y-4">
                        {analytics?.statusBreakdown?.map((item: any, i: number) => (
                          <div key={i} className="space-y-1.5 text-xs">
                            <div className="flex justify-between text-slate-700 font-bold">
                              <span>{item._id?.replace(/_/g, ' ')}</span>
                              <span>{item.count}</span>
                            </div>
                            <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden border border-slate-100">
                              <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${Math.min(100, (item.count / (analytics.overview.totalIssues || 1)) * 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm">
                      <h3 className="text-xs font-black text-slate-905 uppercase tracking-wider mb-6 flex items-center gap-2 border-b border-slate-105 pb-2">
                        <PieChart className="w-4 h-4 text-emerald-600" />
                        Top Issue Categories
                      </h3>
                      <div className="space-y-4">
                        {analytics?.topCategories?.map((item: any, i: number) => (
                          <div key={i} className="space-y-1.5 text-xs">
                            <div className="flex justify-between text-slate-700 font-bold">
                              <span>{item._id || 'Other'}</span>
                              <span>{item.count}</span>
                            </div>
                            <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden border border-slate-100">
                              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, (item.count / (analytics.overview.totalIssues || 1)) * 105)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* City Heatmap Tab */}
              {activeTab === 'heatmap' && (
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <Map className="w-5 h-5 text-indigo-650" />
                      City Civic Density Heatmap
                    </h2>
                    <p className="text-xs text-slate-505 font-semibold mt-1">
                      Visualization of issue frequency and severity density. Circles denote concentrated issue reports, weighted by priority score.
                    </p>
                  </div>
                  <div>
                    <LeafletMap
                      center={[12.9716, 77.5946]}
                      zoom={12}
                      issues={allIssues}
                      heatmapMode={true}
                      showDashboard={true}
                      className="w-full h-[480px]"
                    />
                  </div>
                </div>
              )}

              {/* SLA Escalations Tab */}
              {activeTab === 'escalations' && (
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                      SLA Escalation Log
                    </h2>
                    <p className="text-xs text-slate-505 font-semibold mt-1">
                      Review historical logs of SLA overdue events and level escalations triggered by the background job.
                    </p>
                  </div>
                  
                  {escalations.length === 0 ? (
                    <p className="text-slate-400 text-sm font-medium py-12 text-center bg-slate-50 border border-slate-100 rounded-2xl">No SLA breaches or escalations logged. All systems nominal!</p>
                  ) : (
                    <div className="grid gap-6">
                      {escalations.map((log) => (
                        <div key={log._id} className="bg-slate-50/50 border border-slate-100 p-5 rounded-[20px] flex items-center justify-between gap-4">
                          <div>
                            <span className="px-2.5 py-1 bg-rose-50 border border-rose-100 text-rose-700 font-bold text-[9px] uppercase rounded-full">
                              Level {log.level} Escalation
                            </span>
                            <h3 className="text-sm font-black text-slate-900 mt-2.5">Issue Ref: #{log.issueId?._id || log.issueId}</h3>
                            <p className="text-xs text-slate-550 font-semibold mt-1">Reason: {log.reason}</p>
                            <p className="text-[10px] text-slate-450 mt-2 font-bold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" /> Overdue since: {new Date(log.escalatedAt).toLocaleString()}
                            </p>
                          </div>
                          <span className="text-[10px] font-bold text-rose-650 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-100 uppercase shrink-0">BREACHED</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
