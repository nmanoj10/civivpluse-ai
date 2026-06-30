import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, AlertTriangle, Images, MapPin, Sparkles, ShieldCheck,
  ThumbsUp, ThumbsDown, MessageSquare, Clock, Send, Bot,
  User, CheckCircle, RefreshCw, ExternalLink, Download, Share2
} from 'lucide-react';
import LeafletMap from '@/components/ui/LeafletMap';
import MediaGallery, { type MediaItem } from '@/components/ui/MediaGallery';
import { connectSocket } from '@/utils/socket';
import { motion, AnimatePresence } from 'motion/react';

// ─── Inline UI Primitives ─────────────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { bg: string; dot: string; text: string }> = {
    'SUBMITTED':                       { bg: 'bg-blue-50 border-blue-200 text-blue-700',    dot: 'bg-blue-500',    text: 'Submitted' },
    'MEDIA_UPLOADED':                  { bg: 'bg-blue-50 border-blue-200 text-blue-700',    dot: 'bg-blue-500',    text: 'Media Uploaded' },
    'OPEN_FOR_COMMUNITY_VERIFICATION': { bg: 'bg-orange-50 border-orange-200 text-orange-700', dot: 'bg-orange-500', text: 'Open / Community' },
    'ASSIGNED_TO_AUTHORITY':           { bg: 'bg-purple-50 border-purple-200 text-purple-700', dot: 'bg-purple-500', text: 'Assigned' },
    'IN_PROGRESS':                     { bg: 'bg-indigo-50 border-indigo-200 text-indigo-700', dot: 'bg-indigo-500', text: 'In Progress' },
    'RESOLVED':                        { bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500', text: 'Resolved' },
    'CLOSED_RESOLVED':                 { bg: 'bg-emerald-50 border-emerald-200 text-emerald-700', dot: 'bg-emerald-500', text: 'Closed Resolved' },
    'REJECTED':                        { bg: 'bg-rose-50 border-rose-200 text-rose-700',    dot: 'bg-rose-500',    text: 'Rejected' },
    'ESCALATED':                       { bg: 'bg-rose-50 border-rose-200 text-rose-700',    dot: 'bg-rose-500',    text: 'Escalated' },
    'PENDING_CITIZEN_CONFIRMATION':    { bg: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-500',   text: 'Awaiting Confirmation' },
    'MERGED_WITH_EXISTING_ISSUE':      { bg: 'bg-slate-50 border-slate-200 text-slate-600', dot: 'bg-slate-400',   text: 'Merged Duplicate' },
  };
  const s = map[status] || { bg: 'bg-slate-50 border-slate-200 text-slate-600', dot: 'bg-slate-400', text: status?.replace(/_/g, ' ') || 'Unknown' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${s.bg}`}>
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      {s.text}
    </span>
  );
};

const PriorityBadge = ({ level }: { level: string }) => {
  const map: Record<string, string> = {
    LOW: 'bg-slate-100 text-slate-600 border-slate-200',
    MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
    HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
    CRITICAL: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  const cls = map[(level || 'LOW').toUpperCase()] || map.LOW;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border ${cls}`}>
      {level || 'LOW'}
    </span>
  );
};

const LifecycleTimeline = ({ status }: { status: string }) => {
  const steps = [
    { key: 'SUBMITTED',                       label: 'Reported', done: true },
    { key: 'MEDIA_UPLOADED',                  label: 'AI Analysis', done: status !== 'SUBMITTED' },
    { key: 'OPEN_FOR_COMMUNITY_VERIFICATION', label: 'Community', done: !['SUBMITTED', 'MEDIA_UPLOADED'].includes(status) },
    { key: 'ASSIGNED_TO_AUTHORITY',           label: 'Assigned', done: ['ASSIGNED_TO_AUTHORITY','IN_PROGRESS','RESOLVED','CLOSED_RESOLVED','PENDING_CITIZEN_CONFIRMATION'].includes(status) },
    { key: 'IN_PROGRESS',                     label: 'In Progress', done: ['IN_PROGRESS','RESOLVED','CLOSED_RESOLVED','PENDING_CITIZEN_CONFIRMATION'].includes(status) },
    { key: 'RESOLVED',                        label: 'Resolved', done: ['RESOLVED','CLOSED_RESOLVED'].includes(status) },
  ];
  const doneCount = steps.filter(s => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
        <span>Resolution Progress</span>
        <span className="text-indigo-600">{pct}% complete</span>
      </div>
      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <motion.div 
          className="h-full bg-indigo-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between items-center relative">
        <div className="absolute left-0 right-0 top-3 h-px bg-slate-100 z-0" />
        {steps.map((step, idx) => (
          <div key={idx} className="flex flex-col items-center z-10">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition-all ${
              step.done ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm shadow-indigo-600/30' : 'bg-white border-slate-200 text-slate-300'
            }`}>
              {step.done ? '✓' : idx + 1}
            </div>
            <span className={`text-[8px] font-bold mt-1 uppercase tracking-wider ${step.done ? 'text-indigo-600' : 'text-slate-300'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ChatBubble = ({ msg, userId }: { key?: any; msg: any; userId: string }) => {
  const isSystem = msg.isSystemMessage;
  const isMe = msg.senderId === userId;

  if (isSystem) {
    return (
      <div className="flex justify-center my-1">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl max-w-[90%]">
          <Bot className="w-3 h-3 text-indigo-500 shrink-0" />
          <p className="text-[10px] font-semibold text-indigo-700">{msg.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
      <span className="text-[9px] text-slate-400 mb-0.5 font-bold">
        {msg.senderName || 'Unknown'} · {msg.senderRole === 'ward_officer' ? '🛡️ Officer' : '👤 Citizen'}
      </span>
      <div className={`px-3 py-2 rounded-2xl max-w-[80%] text-xs font-medium leading-relaxed ${
        isMe 
          ? 'bg-indigo-600 text-white rounded-tr-sm shadow-sm' 
          : 'bg-slate-100 text-slate-800 rounded-tl-sm border border-slate-200/50'
      }`}>
        {msg.message}
      </div>
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
interface IssueDetailsProps {
  issueId: string;
  user: any;
  token: string;
  onClose: () => void;
  onSelectDuplicate: (duplicateId: string) => void;
}

export default function IssueDetails({ issueId, user, token, onClose, onSelectDuplicate }: IssueDetailsProps) {
  const [issue, setIssue] = useState<any>(null);
  const [loadingIssue, setLoadingIssue] = useState(true);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch all data
  const fetchIssue = async () => {
    try {
      const res = await fetch(`/api/issues/${issueId}`);
      const data = await res.json();
      if (data.success) setIssue(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingIssue(false);
    }
  };

  const fetchTimeline = async () => {
    try {
      const res = await fetch(`/api/issues/${issueId}/timeline`);
      const data = await res.json();
      if (data.success) setTimeline(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMedia = async () => {
    setMediaLoading(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/media`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setMedia(data.data.map((m: any) => ({
          url: m.url,
          thumbnailUrl: m.thumbnailUrl,
          mediaType: m.mediaType,
          mimeType: m.mimeType,
          width: m.width,
          height: m.height,
          originalFilename: m.originalFilename,
          isEvidence: m.isEvidence
        })));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMediaLoading(false);
    }
  };

  const fetchChat = async () => {
    try {
      const res = await fetch(`/api/issues/${issueId}/chat`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setChatMessages(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    setIssue(null);
    setLoadingIssue(true);
    setMedia([]);
    setTimeline([]);
    setChatMessages([]);
    fetchIssue();
    fetchTimeline();
    fetchMedia();
    fetchChat();
  }, [issueId]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Socket.IO real-time
  useEffect(() => {
    const socket = connectSocket(token);

    const onIssueUpdated = (updated: any) => {
      if (updated._id === issueId) {
        setIssue((prev: any) => ({ ...prev, ...updated }));
        fetchTimeline();
      }
    };

    const onChatMessage = (msg: any) => {
      if (msg.issueId === issueId) {
        setChatMessages(prev => prev.some(m => m._id === msg._id) ? prev : [...prev, msg]);
      }
    };

    const onVoteUpdated = (payload: any) => {
      if (payload.issue && payload.issue._id === issueId) {
        setIssue((prev: any) => ({ ...prev, ...payload.issue }));
      }
    };

    socket.on('ISSUE_UPDATED', onIssueUpdated);
    socket.on('ISSUE_ASSIGNED', onIssueUpdated);
    socket.on('CHAT_MESSAGE', onChatMessage);
    socket.on('NEW_MESSAGE', onChatMessage);
    socket.on('VOTE_UPDATED', onVoteUpdated);
    socket.on('NEW_SUPPORT', onVoteUpdated);
    socket.on('NEW_REJECTION', onVoteUpdated);

    return () => {
      socket.off('ISSUE_UPDATED', onIssueUpdated);
      socket.off('ISSUE_ASSIGNED', onIssueUpdated);
      socket.off('CHAT_MESSAGE', onChatMessage);
      socket.off('NEW_MESSAGE', onChatMessage);
      socket.off('VOTE_UPDATED', onVoteUpdated);
      socket.off('NEW_SUPPORT', onVoteUpdated);
      socket.off('NEW_REJECTION', onVoteUpdated);
    };
  }, [issueId, token]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim() || sendingMsg) return;
    setSendingMsg(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: newMsg })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        // Socket will deliver it; fallback add it manually
        setChatMessages(prev => prev.some(m => m._id === data.data._id) ? prev : [...prev, data.data]);
        setNewMsg('');
      } else {
        showToast('error', data.message || 'Failed to send');
      }
    } catch {
      showToast('error', 'Network error');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleVote = async (voteType: 'EXISTS' | 'NOT_FOUND') => {
    try {
      const res = await fetch(`/api/community/${issueId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ voteType })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast('success', voteType === 'EXISTS' ? 'Supported! Reputation +1' : 'Rejection recorded.');
      // Socket will update the issue counts
    } catch (err: any) {
      showToast('error', err.message || 'Vote failed');
    }
  };

  const handleUndoVote = async () => {
    try {
      const res = await fetch(`/api/community/${issueId}/vote`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Undo failed');
      showToast('success', 'Your vote has been revoked.');
    } catch (err: any) {
      showToast('error', err.message || 'Undo failed');
    }
  };

  const handleFeedback = async (feedbackType: 'RESOLVED' | 'STILL_UNRESOLVED' | 'NEEDS_FOLLOWUP') => {
    setSubmittingFeedback(true);
    try {
      const res = await fetch(`/api/resolutions/${issueId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ feedbackType, comment: feedbackComment })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      showToast('success', `Feedback submitted: ${feedbackType}`);
      setFeedbackComment('');
      fetchIssue();
    } catch (err: any) {
      showToast('error', err.message || 'Feedback failed');
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleDownloadReport = () => {
    if (!issue) return;
    const content = `CIVICPULSE AI — INCIDENT REPORT
========================================
Reference ID  : ${issue._id}
Title         : ${issue.title}
Status        : ${issue.status}
Severity      : ${issue.severity || 'N/A'}
Category      : ${issue.reportedCategory || issue.category || 'N/A'}
AI Confidence : ${issue.aiConfidence ? `${Math.round(issue.aiConfidence)}%` : 'N/A'}
Trust Score   : ${issue.trustScore || 'N/A'}/100
Priority Score: ${issue.priorityScore || 'N/A'}/100
Supports      : ${issue.supportCount || 0}
Rejections    : ${issue.rejectCount || 0}
Location      : ${issue.location?.address}
Coordinates   : ${issue.location?.lat}, ${issue.location?.lng}
Ward          : ${issue.location?.ward || 'N/A'}
City          : ${issue.location?.city || 'N/A'}
Reported      : ${new Date(issue.createdAt).toLocaleString()}
Officer       : ${issue.assignedOfficer?.name || 'Not Assigned'}
Dept.         : ${issue.assignedDepartment || 'Not Assigned'}
========================================
Generated by CivicPulse AI`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Report_${issue._id}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loadingIssue || !issue) {
    return (
      <div className="bg-white border border-slate-100 rounded-[24px] p-8 space-y-6 animate-pulse">
        <div className="h-8 bg-slate-100 rounded-full w-1/2" />
        <div className="aspect-video bg-slate-100 rounded-2xl" />
        <div className="h-4 bg-slate-100 rounded-full w-3/4" />
        <div className="h-4 bg-slate-100 rounded-full w-1/2" />
      </div>
    );
  }

  const heroMedia = media[0]?.url || issue.media?.[0]?.imageUrl || issue.thumbnail;

  return (
    <div className="space-y-5">
      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-lg text-xs font-bold border ${
              toast.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back Button + Title */}
      <div className="bg-white border border-slate-100 rounded-[24px] px-6 py-4 shadow-sm flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 font-bold transition-colors mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to list
          </button>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-snug">{issue.title}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <StatusBadge status={issue.status} />
            <PriorityBadge level={issue.severity} />
            <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
              <MapPin className="w-3 h-3 text-indigo-400" />
              {issue.location?.address}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/issue/${issue._id}`); showToast('success', 'Link copied!'); }}
            className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-xl border border-slate-100 transition-colors cursor-pointer"
            title="Share link"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleDownloadReport}
            className="p-2 hover:bg-slate-50 text-slate-500 hover:text-slate-700 rounded-xl border border-slate-100 transition-colors cursor-pointer"
            title="Download report"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => { fetchIssue(); fetchTimeline(); fetchMedia(); fetchChat(); }}
            className="p-2 hover:bg-slate-50 text-slate-500 hover:text-indigo-600 rounded-xl border border-slate-100 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Duplicate merge warning */}
      {issue.status === 'MERGED_WITH_EXISTING_ISSUE' && issue.duplicateOf && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">This report was merged with an existing master issue.</p>
            <p className="text-xs text-amber-600 font-semibold mt-1">All votes, evidence, and updates are tracked on the master ticket.</p>
            <button
              onClick={() => onSelectDuplicate(issue.duplicateOf)}
              className="mt-2 text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer"
            >
              View master issue <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Lifecycle timeline */}
      <div className="bg-white border border-slate-100 rounded-[24px] px-6 py-5 shadow-sm">
        <LifecycleTimeline status={issue.status} />
      </div>

      <div className="grid lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-7 space-y-5">
          {/* Hero Media / Gallery */}
          <div className="bg-white border border-slate-100 rounded-[24px] overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-50 flex items-center gap-2">
              <Images className="w-4 h-4 text-indigo-500" />
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Evidence Gallery ({media.length})
              </h3>
            </div>
            <div className="p-5">
              {mediaLoading ? (
                <div className="aspect-video bg-slate-100 rounded-2xl animate-pulse flex items-center justify-center">
                  <p className="text-xs text-slate-400 font-semibold">Loading evidence...</p>
                </div>
              ) : media.length === 0 ? (
                <div className="aspect-video bg-gradient-to-br from-indigo-50 to-slate-100 rounded-2xl flex flex-col items-center justify-center gap-2">
                  {heroMedia ? (
                    <img src={heroMedia} className="w-full h-full object-cover rounded-2xl" alt={issue.title} />
                  ) : (
                    <>
                      <Sparkles className="w-8 h-8 text-indigo-300" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No media attached</p>
                    </>
                  )}
                </div>
              ) : (
                <MediaGallery mediaItems={media} compact={media.length > 2} />
              )}
            </div>
          </div>

          {/* AI Analysis */}
          <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-50">
              <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center border border-indigo-100">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">AI Analysis Results</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Predicted Category', value: issue.predictedCategory || issue.category || 'Road & Transport' },
                { label: 'Sub-Category', value: issue.predictedSubCategory || '—' },
                { label: 'AI Confidence', value: issue.aiConfidence ? `${Math.round(issue.aiConfidence)}%` : '—', bold: true, color: 'text-indigo-600' },
                { label: 'Trust Score', value: `${issue.trustScore || 0}/100`, bold: true, color: 'text-emerald-600' },
                { label: 'Priority Score', value: `${issue.priorityScore || 0}/100`, bold: true, color: 'text-amber-600' },
                { label: 'Est. Resolution', value: issue.estimatedResolutionTime || '48–72 hours' },
                { label: 'Detected Objects', value: issue.detectedObjects?.join(', ') || 'N/A' },
                { label: 'Assigned Dept.', value: issue.assignedDepartment || 'Not yet assigned' },
              ].map(({ label, value, bold, color }) => (
                <div key={label}>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                  <p className={`text-xs font-bold mt-0.5 ${bold ? color || 'text-slate-800' : 'text-slate-700'}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Map */}
          {issue.location?.lat && issue.location?.lng && (
            <div className="bg-white border border-slate-100 rounded-[24px] overflow-hidden shadow-sm">
              <div className="p-5 border-b border-slate-50 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-500" />
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Location</h3>
                <span className="text-[10px] text-slate-400 font-semibold ml-auto">
                  {issue.location.lat.toFixed(5)}, {issue.location.lng.toFixed(5)}
                </span>
              </div>
              <div className="h-[220px] relative">
                <LeafletMap
                  center={[issue.location.lat, issue.location.lng]}
                  zoom={15}
                  issues={[{ _id: issue._id, title: issue.title, status: issue.status, location: issue.location }]}
                  landmarks={issue.landmarks || []}
                  jurisdictionRadius={1000}
                  className="w-full h-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-5 space-y-5">
          {/* Community Votes */}
          <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-50">
              <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center border border-emerald-100">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Community Endorsements</h3>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="text-center bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                <p className="text-2xl font-black text-emerald-700">{issue.supportCount || 0}</p>
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mt-0.5">Supports</p>
              </div>
              <div className="text-center bg-rose-50 border border-rose-100 p-4 rounded-2xl">
                <p className="text-2xl font-black text-rose-600">{issue.rejectCount || 0}</p>
                <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-0.5">Rejections</p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => handleVote('EXISTS')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
                >
                  <ThumbsUp className="w-3.5 h-3.5" /> Support
                </button>
                <button
                  onClick={() => handleVote('NOT_FOUND')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-rose-500/10 cursor-pointer"
                >
                  <ThumbsDown className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
              <button
                onClick={handleUndoVote}
                className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl transition-all cursor-pointer"
              >
                Undo my vote
              </button>
            </div>
          </div>

          {/* Chat */}
          <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm flex flex-col h-[380px]">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-50 shrink-0">
              <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center border border-indigo-100">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Progress Chat</h3>
              {chatMessages.length > 0 && (
                <span className="ml-auto text-[9px] font-bold bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100">
                  {chatMessages.length}
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                  <MessageSquare className="w-8 h-8 opacity-20" />
                  <p className="text-xs font-semibold">No messages yet</p>
                  <p className="text-[10px] text-center">Send a message to start a conversation with the assigned officer.</p>
                </div>
              ) : (
                chatMessages.map((m, i) => (
                  <ChatBubble key={m._id || i} msg={m} userId={user._id} />
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            <form onSubmit={handleSendChat} className="flex gap-2 shrink-0">
              <input
                type="text"
                value={newMsg}
                onChange={e => setNewMsg(e.target.value)}
                placeholder="Message officer..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
              <button
                type="submit"
                disabled={sendingMsg || !newMsg.trim()}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>

          {/* Milestones Timeline */}
          <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-50">
              <div className="w-7 h-7 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Timeline</h3>
            </div>
            {timeline.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No milestones logged yet.</p>
            ) : (
              <div className="relative border-l border-slate-100 pl-5 space-y-4 max-h-48 overflow-y-auto pr-2">
                {timeline.map((event, idx) => (
                  <div key={idx} className="relative">
                    <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full absolute -left-[22px] top-1.5 border-2 border-white shadow-sm" />
                    <p className="text-xs font-bold text-slate-800">{event.title}</p>
                    <p className="text-[10px] text-slate-400 font-semibold mt-0.5 leading-relaxed">{event.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Citizen Confirmation Panel */}
      {issue.status === 'PENDING_CITIZEN_CONFIRMATION' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-indigo-50 border border-indigo-200 rounded-[24px] p-6 shadow-sm"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 bg-indigo-100 rounded-xl flex items-center justify-center border border-indigo-200 shrink-0">
              <CheckCircle className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <h4 className="text-sm font-black text-indigo-800">Your Confirmation Required</h4>
              <p className="text-xs text-indigo-600 font-semibold mt-0.5">The officer has marked this issue as resolved. Please confirm if the problem is actually fixed.</p>
            </div>
          </div>
          <textarea
            rows={3}
            value={feedbackComment}
            onChange={e => setFeedbackComment(e.target.value)}
            placeholder="Optional: Add any comments about the resolution quality..."
            className="w-full bg-white border border-indigo-200 rounded-xl p-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 mb-4 resize-none"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleFeedback('RESOLVED')}
              disabled={submittingFeedback}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Yes, It's Resolved
            </button>
            <button
              onClick={() => handleFeedback('STILL_UNRESOLVED')}
              disabled={submittingFeedback}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Not Yet Fixed
            </button>
            <button
              onClick={() => handleFeedback('NEEDS_FOLLOWUP')}
              disabled={submittingFeedback}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            >
              Needs Follow-up
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
