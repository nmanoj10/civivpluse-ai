import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Sparkles, AlertTriangle, ThumbsUp, ThumbsDown, MapPin, 
  Clock, Eye, Flame, CheckCircle, TrendingUp, RefreshCw,
  Wifi, WifiOff, ShieldCheck, User, Users, Activity, BarChart3, Share2
} from 'lucide-react';
import { connectSocket } from '@/utils/socket';
import { motion, AnimatePresence } from 'motion/react';

interface CommunityFeedProps {
  user: any;
  token: string;
  onViewDetails: (issue: any) => void;
  IssueCardComponent: React.ComponentType<any>;
}

const FeedTypeTab = ({ active, onClick, label, icon: Icon, count }: any) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 ${
      active 
        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' 
        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-transparent hover:border-slate-100'
    }`}
  >
    <Icon className="w-3.5 h-3.5" />
    {label}
    {count !== undefined && count > 0 && (
      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
        {count}
      </span>
    )}
  </button>
);

const IssueFeedCard = ({ issue, onViewDetails, onSupport, onReject, token, user }: any) => {
  const [supporting, setSupporting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const mediaUrl = issue.thumbnail || issue.previewUrl || issue.media?.[0]?.imageUrl || issue.media?.[0]?.url;
  const reportDate = issue.createdAt ? new Date(issue.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown';
  const timeSince = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };
  const supportCount = issue.supportCount ?? issue.supporterCount ?? 0;
  const rejectCount = issue.rejectCount ?? 0;
  const evidenceCount = issue.evidenceCount ?? issue.media?.length ?? 0;
  const priorityScore = issue.priorityScore ?? 0;
  const progressPercent = issue.progressPercent ?? 0;
  const assignedOfficer = issue.assignedOfficer as any;
  const assignedDept = issue.assignedDepartment as any;
  const isVerified = issue.verified ?? ['COMMUNITY_VERIFIED', 'ASSIGNED_TO_AUTHORITY', 'IN_PROGRESS', 'RESOLVED', 'CLOSED_RESOLVED'].includes(issue.status);
  const statusColors: Record<string, string> = {
    'SUBMITTED': 'bg-blue-50 border-blue-200 text-blue-700',
    'MEDIA_UPLOADED': 'bg-blue-50 border-blue-200 text-blue-700',
    'AI_ANALYSIS_RUNNING': 'bg-purple-50 border-purple-200 text-purple-700',
    'OPEN_FOR_COMMUNITY_VERIFICATION': 'bg-amber-50 border-amber-200 text-amber-700',
    'COMMUNITY_VERIFIED': 'bg-emerald-50 border-emerald-200 text-emerald-700',
    'ASSIGNED_TO_AUTHORITY': 'bg-indigo-50 border-indigo-200 text-indigo-700',
    'IN_PROGRESS': 'bg-cyan-50 border-cyan-200 text-cyan-700',
    'RESOLVED': 'bg-emerald-50 border-emerald-200 text-emerald-700',
    'CLOSED_RESOLVED': 'bg-emerald-50 border-emerald-200 text-emerald-700',
    'PENDING_CITIZEN_CONFIRMATION': 'bg-violet-50 border-violet-200 text-violet-700',
    'NEEDS_MANUAL_REVIEW': 'bg-rose-50 border-rose-200 text-rose-700',
    'REJECTED': 'bg-rose-50 border-rose-200 text-rose-700',
    'ESCALATED': 'bg-orange-50 border-orange-200 text-orange-700',
    'REOPENED': 'bg-orange-50 border-orange-200 text-orange-700',
  };
  const statusClass = statusColors[issue.status] || 'bg-slate-50 border-slate-200 text-slate-600';

  const handleSupportClick = async () => {
    setSupporting(true);
    const prevSupport = supportCount;
    // Optimistic update
    if (onSupport) onSupport(issue._id || issue.issueId, prevSupport + 1, rejectCount);
    try {
      await fetch(`/api/issues/master/${issue._id || issue.issueId}/support`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch {
      // rollback would go here; socket refresh handles sync
    } finally {
      setSupporting(false);
    }
  };

  const handleRejectClick = async () => {
    setRejecting(true);
    const prevReject = rejectCount;
    if (onReject) onReject(issue._id || issue.issueId, supportCount, prevReject + 1);
    try {
      await fetch(`/api/community/${issue._id || issue.issueId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ voteType: 'NOT_FOUND' })
      });
    } catch {
      // rollback handled by socket
    } finally {
      setRejecting(false);
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/issue/${issue._id || issue.issueId}`;
    try { await navigator.clipboard.writeText(url); alert('Share link copied!'); } catch {}
  };

  const priorityColor = priorityScore >= 80 ? 'text-rose-600 bg-rose-50 border-rose-200' 
    : priorityScore >= 60 ? 'text-orange-600 bg-orange-50 border-orange-200'
    : 'text-indigo-600 bg-indigo-50 border-indigo-200';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="bg-white border border-slate-100 rounded-[20px] overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col"
    >
      {/* Issue Image */}
      <div className="relative aspect-video w-full bg-slate-900 overflow-hidden">
        {mediaUrl ? (
          <img 
            src={mediaUrl} 
            alt={issue.title} 
            className="w-full h-full object-cover"
            onError={(e: any) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-slate-900 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-indigo-300/40" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        {/* Top overlay badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
          <span className="px-2 py-0.5 bg-white/95 backdrop-blur-sm text-slate-800 text-[9px] font-extrabold uppercase rounded-full shadow-sm">
            {issue.reportedCategory || issue.predictedCategory || 'General'}
          </span>
          {isVerified && (
            <span className="px-2 py-0.5 bg-emerald-500 text-white text-[9px] font-black uppercase rounded-full shadow-sm flex items-center gap-0.5">
              <ShieldCheck className="w-2.5 h-2.5" /> Verified
            </span>
          )}
        </div>
        {priorityScore >= 80 && (
          <div className="absolute top-3 right-3">
            <span className="px-2 py-0.5 bg-rose-500 text-white text-[9px] font-black uppercase rounded-full shadow-sm flex items-center gap-1">
              <Flame className="w-2.5 h-2.5" /> Critical
            </span>
          </div>
        )}
        {/* Bottom overlay title */}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-white font-black text-sm leading-snug line-clamp-2 drop-shadow-md">{issue.title}</h3>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Location & Date */}
        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
          <span className="flex items-center gap-1 truncate max-w-[60%]">
            <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
            <span className="truncate">{issue.location?.address || issue.location?.locality || issue.location?.city || 'Location unknown'}</span>
          </span>
          <span className="flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3" />
            {timeSince(issue.createdAt)}
          </span>
        </div>

        {/* Ward / City metadata */}
        <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400">
          {issue.location?.ward && (
            <span className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded-md text-slate-500">{issue.location.ward}</span>
          )}
          {issue.location?.city && (
            <span className="px-1.5 py-0.5 bg-slate-50 border border-slate-100 rounded-md text-slate-500">{issue.location.city}</span>
          )}
          <span className="flex items-center gap-0.5">
            <Activity className="w-2.5 h-2.5" /> #{issue._id?.toString().slice(-6) || '------'}
          </span>
        </div>

        {/* Status + Assigned Officer + Evidence */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold border ${statusClass}`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {(issue.status || 'OPEN').replace(/_/g, ' ')}
          </span>
          {assignedOfficer && (
            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <User className="w-2.5 h-2.5" /> {assignedOfficer.name || 'Officer'}
            </span>
          )}
          {evidenceCount > 0 && (
            <span className="text-[9px] font-bold text-slate-500 flex items-center gap-0.5">
              <Eye className="w-2.5 h-2.5" /> {evidenceCount}
            </span>
          )}
        </div>

        {/* Trust Score, Priority Score, Date metadata row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-slate-50/70 rounded-lg p-2 text-center border border-slate-100">
            <span className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Priority</span>
            <span className={`text-xs font-black ${priorityColor} px-1 rounded`}>{priorityScore}</span>
          </div>
          <div className="bg-slate-50/70 rounded-lg p-2 text-center border border-slate-100">
            <span className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Trust</span>
            <span className="text-xs font-black text-slate-700">{issue.trustScore ?? 0}</span>
          </div>
          <div className="bg-slate-50/70 rounded-lg p-2 text-center border border-slate-100">
            <span className="block text-[8px] font-extrabold text-slate-400 uppercase tracking-wider">Progress</span>
            <span className="text-xs font-black text-indigo-600">{progressPercent}%</span>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div 
              className="h-full bg-indigo-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(progressPercent, 100)}%` }}
            />
          </div>
        </div>

        {/* Support / Reject counts row */}
        <div className="flex items-center gap-3 text-[10px] font-bold">
          <span className="flex items-center gap-1 text-indigo-600">
            <ThumbsUp className="w-3 h-3" /> {supportCount} support
          </span>
          {rejectCount > 0 && (
            <span className="flex items-center gap-1 text-rose-400">
              <ThumbsDown className="w-3 h-3" /> {rejectCount} reject
            </span>
          )}
          {assignedDept && (
            <span className="text-[9px] text-slate-400 truncate ml-auto">{assignedDept.name}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-50 mt-auto">
          <button
            onClick={handleSupportClick}
            disabled={supporting}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-60"
          >
            <ThumbsUp className="w-3 h-3" /> Support ({supportCount})
          </button>
          <button
            onClick={handleRejectClick}
            disabled={rejecting}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold transition-colors cursor-pointer disabled:opacity-60"
          >
            <ThumbsDown className="w-3 h-3" /> Reject ({rejectCount})
          </button>
          <button
            onClick={handleShare}
            className="px-2.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold transition-colors cursor-pointer"
            title="Share"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onViewDetails({ ...issue, _id: issue._id || issue.issueId })}
            className="px-3 py-2 bg-slate-900 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-bold transition-colors cursor-pointer shrink-0"
          >
            Details
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default function CommunityFeed({ user, token, onViewDetails, IssueCardComponent }: CommunityFeedProps) {
  const [communityIssuesList, setCommunityIssuesList] = useState<any[]>([]);
  const [communityFeedType, setCommunityFeedType] = useState<'newest' | 'trending' | 'resolved'>('newest');
  const [loading, setLoading] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [newIssuesQueue, setNewIssuesQueue] = useState<any[]>([]);

  const fetchCommunityIssues = useCallback(async (type = communityFeedType) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/issues/feed/community?type=${type}&limit=12`);
      const data = await res.json();
      if (data.success) {
        setCommunityIssuesList(data.data.issues || []);
        setNewIssuesQueue([]);
      } else {
        setCommunityIssuesList([]);
      }
    } catch (err) {
      console.error('Community feed fetch failed:', err);
      setCommunityIssuesList([]);
    } finally {
      setLoading(false);
    }
  }, [communityFeedType]);

  useEffect(() => {
    fetchCommunityIssues(communityFeedType);
  }, [communityFeedType]);

  // Real-time Socket.IO integration
  useEffect(() => {
    const socket = connectSocket(token);

    const onConnect = () => setIsLive(true);
    const onDisconnect = () => setIsLive(false);

    const handleNewIssue = (newIssue: any) => {
      if (communityFeedType === 'newest') {
        setNewIssuesQueue(prev => [newIssue, ...prev.slice(0, 2)]);
        setLiveCount(c => c + 1);
      }
    };

    const handleIssueUpdated = (updatedIssue: any) => {
      setCommunityIssuesList(prev =>
        prev.map(i => (i._id === updatedIssue._id || i.issueId === updatedIssue._id)
          ? { ...i, ...updatedIssue }
          : i
        )
      );
    };

    const handleVoteUpdated = (payload: any) => {
      const updated = payload.issue;
      if (!updated) return;
      setCommunityIssuesList(prev =>
        prev.map(i => (i._id === updated._id || i.issueId === updated._id)
          ? { ...i, ...updated }
          : i
        )
      );
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('NEW_ISSUE_CREATED', handleNewIssue);
    socket.on('ISSUE_UPDATED', handleIssueUpdated);
    socket.on('COMMUNITY_VOTE_ADDED', handleIssueUpdated);
    socket.on('NEW_SUPPORT', handleVoteUpdated);
    socket.on('NEW_REJECTION', handleVoteUpdated);
    socket.on('VOTE_UPDATED', handleVoteUpdated);

    setIsLive(socket.connected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('NEW_ISSUE_CREATED', handleNewIssue);
      socket.off('ISSUE_UPDATED', handleIssueUpdated);
      socket.off('COMMUNITY_VOTE_ADDED', handleIssueUpdated);
      socket.off('NEW_SUPPORT', handleVoteUpdated);
      socket.off('NEW_REJECTION', handleVoteUpdated);
      socket.off('VOTE_UPDATED', handleVoteUpdated);
    };
  }, [token, communityFeedType]);

  // Optimistic: update support count immediately, socket reconciles later
  const handleSupport = (issueId: string, newSupportCount: number, currentRejectCount: number) => {
    setCommunityIssuesList(prev =>
      prev.map(i => ((i._id === issueId) || (i.issueId === issueId))
        ? { ...i, supportCount: newSupportCount, supporterCount: newSupportCount, rejectCount: currentRejectCount }
        : i
      )
    );
  };

  // Optimistic: update reject count immediately, socket reconciles later
  const handleReject = (issueId: string, currentSupportCount: number, newRejectCount: number) => {
    setCommunityIssuesList(prev =>
      prev.map(i => ((i._id === issueId) || (i.issueId === issueId))
        ? { ...i, rejectCount: newRejectCount, supportCount: currentSupportCount, supporterCount: currentSupportCount }
        : i
      )
    );
  };

  const loadNewIssues = () => {
    setCommunityIssuesList(prev => [...newIssuesQueue, ...prev.slice(0, 12 - newIssuesQueue.length)]);
    setNewIssuesQueue([]);
    setLiveCount(0);
  };

  const tabs = [
    { type: 'newest' as const, label: 'Newest', icon: Clock },
    { type: 'trending' as const, label: 'Trending', icon: TrendingUp },
    { type: 'resolved' as const, label: 'Resolved', icon: CheckCircle }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-indigo-600/20">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              Live Community Feed
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-1">Real-time civic issue updates from your city.</p>
          </div>

          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border ${
              isLive 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}>
              {isLive ? (
                <><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> LIVE</>
              ) : (
                <><WifiOff className="w-3 h-3" /> OFFLINE</>
              )}
            </div>
            <button 
              onClick={() => fetchCommunityIssues()}
              className="p-2 hover:bg-slate-50 text-slate-500 hover:text-indigo-600 rounded-xl transition-colors border border-slate-100 cursor-pointer"
              title="Refresh feed"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-5 border-t border-slate-50 pt-4">
          {tabs.map(tab => (
            <FeedTypeTab
              key={tab.type}
              active={communityFeedType === tab.type}
              onClick={() => setCommunityFeedType(tab.type)}
              label={tab.label}
              icon={tab.icon}
            />
          ))}
        </div>
      </div>

      {/* New issues queue notification */}
      <AnimatePresence>
        {newIssuesQueue.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <button
              onClick={loadNewIssues}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-2xl transition-colors shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Wifi className="w-3.5 h-3.5" />
              {newIssuesQueue.length} new issue{newIssuesQueue.length > 1 ? 's' : ''} — Click to load
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Issues Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white border border-slate-100 rounded-[20px] overflow-hidden shadow-sm animate-pulse">
              <div className="aspect-video bg-slate-100" />
              <div className="p-4 space-y-3">
                <div className="h-3 bg-slate-100 rounded-full w-3/4" />
                <div className="h-2 bg-slate-100 rounded-full w-1/2" />
                <div className="h-8 bg-slate-100 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : communityIssuesList.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-[24px] flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100">
            <AlertTriangle className="w-7 h-7 text-indigo-300" />
          </div>
          <p className="text-sm font-bold text-slate-600">No community issues found.</p>
          <p className="text-[11px] text-slate-400 font-medium">Issues will appear here as citizens report them.</p>
          <button 
            onClick={() => fetchCommunityIssues()} 
            className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-xl transition-colors shadow-sm cursor-pointer"
          >
            Refresh Feed
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {communityIssuesList.map((issue) => (
            <IssueFeedCard
              key={issue._id || issue.issueId}
              issue={issue}
              onViewDetails={onViewDetails}
              onSupport={handleSupport}
              onReject={handleReject}
              token={token}
              user={user}
            />
          ))}
        </div>
      )}
    </div>
  );
}
