import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/shared';
import MediaGallery, { type MediaItem } from '@/components/ui/MediaGallery';
import LeafletMap from '@/components/ui/LeafletMap';
import { connectSocket } from '@/utils/socket';
import { 
  FileText, Clipboard, CheckCircle, 
  MapPin, User, Clock, AlertTriangle, Eye, Send, Images, MessageSquare
} from 'lucide-react';

interface OfficerDashboardProps {
  user: any;
  token: string;
  onLogout: () => void;
}

export default function OfficerDashboard({ user, token, onLogout }: OfficerDashboardProps) {
  const [issues, setIssues] = useState<any[]>([]);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [issueMedia, setIssueMedia] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');
  
  // Resolution form state
  const [workSummary, setWorkSummary] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [contractorDetails, setContractorDetails] = useState('');
  const [beforeFiles, setBeforeFiles] = useState<FileList | null>(null);
  const [afterFiles, setAfterFiles] = useState<FileList | null>(null);
  
  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchAssignedIssues = async () => {
    try {
      const res = await fetch('/api/officer/issues', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setIssues(data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchAssignedIssues();
  }, [selectedIssue]);

  // Socket.IO event listener for real-time queue updates
  useEffect(() => {
    const socket = connectSocket(token);

    const handleIssueAssigned = (assignedIssue: any) => {
      console.log('Officer received Socket: ISSUE_ASSIGNED', assignedIssue);
      // Auto refresh list
      fetchAssignedIssues();
      
      // Live toast alert
      setSuccessMsg(`[New Task] A new issue has been assigned to your jurisdiction: "${assignedIssue.title}"`);
      setTimeout(() => setSuccessMsg(''), 7000);
    };

    const handleIssueUpdated = (updatedIssue: any) => {
      console.log('Officer received Socket: ISSUE_UPDATED', updatedIssue);
      setIssues(prev => prev.map(i => i._id === updatedIssue._id ? { ...i, ...updatedIssue } : i));
      if (selectedIssue && selectedIssue._id === updatedIssue._id) {
        setSelectedIssue((prev: any) => ({ ...prev, ...updatedIssue }));
        loadTimeline(updatedIssue._id);
      }
    };

    const handleNotification = (notif: any) => {
      console.log('Officer received Socket: NOTIFICATION_RECEIVED', notif);
      
      // Native web notification
      if (window.Notification && window.Notification.permission === 'granted') {
        new window.Notification(notif.title, { body: notif.message });
      }

      setSuccessMsg(`[Notification] ${notif.title}: ${notif.message}`);
      setTimeout(() => setSuccessMsg(''), 7000);
      fetchAssignedIssues();
    };

    const handleChatMessage = (msg: any) => {
      console.log('Officer Socket event: CHAT_MESSAGE', msg);
      if (selectedIssue && selectedIssue._id === msg.issueId) {
        setChatMessages(prev => {
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
    };

    socket.on('ISSUE_ASSIGNED', handleIssueAssigned);
    socket.on('ISSUE_UPDATED', handleIssueUpdated);
    socket.on('CHAT_MESSAGE', handleChatMessage);
    socket.on('NOTIFICATION_RECEIVED', handleNotification);

    return () => {
      socket.off('ISSUE_ASSIGNED', handleIssueAssigned);
      socket.off('ISSUE_UPDATED', handleIssueUpdated);
      socket.off('CHAT_MESSAGE', handleChatMessage);
      socket.off('NOTIFICATION_RECEIVED', handleNotification);
    };
  }, [selectedIssue?._id, token]);

  const loadTimeline = async (issueId: string) => {
    try {
      const res = await fetch(`/api/issues/${issueId}/timeline`);
      const data = await res.json();
      if (data.success) setTimeline(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadChatHistory = async (issueId: string) => {
    try {
      const res = await fetch(`/api/issues/${issueId}/chat`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setChatMessages(data.data);
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsg.trim() || !selectedIssue) return;
    try {
      const res = await fetch(`/api/issues/${selectedIssue._id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: newMsg })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChatMessages(prev => [...prev, data.data]);
        setNewMsg('');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleProgressUpdate = async (progressStatus: string) => {
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const res = await fetch(`/api/officer/issues/${selectedIssue._id}/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ progressStatus, note: `Officer milestone update: ${progressStatus}` })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update progress');

      setSuccessMsg(`Milestone logged: ${progressStatus}`);
      fetchAssignedIssues();
      loadTimeline(selectedIssue._id);
      
      // Update selected issue status dynamically
      const detailRes = await fetch(`/api/officer/issues/${selectedIssue._id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const detailData = await detailRes.json();
      if (detailData.success) setSelectedIssue(detailData.data);

      setTimeout(() => setSuccessMsg(''), 4500);
    } catch (err: any) {
      setError(err.message || 'Progress update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectIssue = async (issue: any) => {
    try {
      const res = await fetch(`/api/officer/issues/${issue._id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSelectedIssue(data.data);
      } else {
        setSelectedIssue(issue);
      }
    } catch (err) {
      console.error(err);
      setSelectedIssue(issue);
    }
    loadTimeline(issue._id);
    loadChatHistory(issue._id);

    // Load media from ImageKit
    setMediaLoading(true);
    setIssueMedia([]);
    try {
      const mRes = await fetch(`/api/issues/${issue._id}/media`);
      const mData = await mRes.json();
      if (mData.success && Array.isArray(mData.data)) {
        setIssueMedia(mData.data.map((m: any) => ({
          url: m.url,
          thumbnailUrl: m.thumbnailUrl,
          mediaType: m.mediaType,
          mimeType: m.mimeType,
          originalFilename: m.originalFilename,
          isEvidence: m.isEvidence
        })));
      }
    } catch (err) {
      console.error('Failed to load issue media:', err);
    } finally {
      setMediaLoading(false);
    }
  };

  const handleStartWork = async (issueId: string) => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/officer/issues/${issueId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: 'IN_PROGRESS', note: 'Officer has started site remediation.' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update status');

      setSuccessMsg('Issue status transitioned to IN PROGRESS.');
      const updatedIssue = { ...selectedIssue, status: 'IN_PROGRESS' };
      setSelectedIssue(updatedIssue);
      loadTimeline(issueId);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Status transition failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setSuccessMsg('');

    try {
      const formData = new FormData();
      formData.append('workSummary', workSummary);
      formData.append('internalNotes', internalNotes);
      if (estimatedCost) formData.append('estimatedCost', estimatedCost);
      formData.append('contractorDetails', contractorDetails);

      if (beforeFiles) {
        for (let i = 0; i < beforeFiles.length; i++) {
          formData.append('beforeMedia', beforeFiles[i]);
        }
      }
      if (afterFiles) {
        for (let i = 0; i < afterFiles.length; i++) {
          formData.append('afterMedia', afterFiles[i]);
        }
      }

      const res = await fetch(`/api/resolutions/${selectedIssue._id}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit resolution');

      setSuccessMsg('Resolution submitted successfully! Awaiting citizen confirmation.');
      setWorkSummary('');
      setInternalNotes('');
      setEstimatedCost('');
      setContractorDetails('');
      setBeforeFiles(null);
      setAfterFiles(null);
      setTimeout(() => {
        setSelectedIssue(null);
        fetchAssignedIssues();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Resolution submission failed');
    } finally {
      setLoading(false);
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
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  // Helper component for Priority Badge
  const PriorityBadge = ({ level }: { level: string }) => {
    const styles: Record<string, string> = {
      CRITICAL: 'bg-rose-50 border-rose-200 text-rose-700',
      HIGH: 'bg-orange-50 border-orange-200 text-orange-700',
      MEDIUM: 'bg-amber-50 border-amber-200 text-amber-700',
      LOW: 'bg-blue-50 border-blue-200 text-blue-700'
    };
    const style = styles[level] || 'bg-slate-50 border-slate-100 text-slate-550';
    return (
      <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded-md border tracking-wider ${style}`}>
        {level} Priority
      </span>
    );
  };

  // Premium Placeholder
  const PremiumPlaceholder = () => (
    <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center py-8">
      <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center mb-3">
        <Clipboard className="w-6 h-6 text-indigo-650 animate-pulse" />
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
                <span className="text-[10px] text-amber-600 font-bold px-2.5 py-1 rounded-full bg-amber-50 border border-amber-100 shadow-sm">
                  Ward Officer Dashboard
                </span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 border-l border-slate-10 pl-4">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center shadow-inner uppercase">
                {user.name.slice(0, 2)}
              </div>
              <span className="text-xs font-bold text-slate-750 hidden sm:inline">{user.name}</span>
              <button onClick={onLogout} className="text-[10px] text-slate-400 hover:text-red-500 font-bold ml-2 transition-colors">Logout</button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 mt-8">
        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-50 border border-emerald-250 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2 shadow-sm shadow-emerald-500/5">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold rounded-2xl flex items-center gap-2 shadow-sm shadow-rose-500/5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {selectedIssue ? (
          /* Detailed Task Resolution View */
          <div className="bg-white border border-slate-100 rounded-[24px] p-8 shadow-sm space-y-8">
            <div className="flex justify-between items-start gap-4">
              <div>
                <button onClick={() => setSelectedIssue(null)} className="text-xs text-slate-405 hover:text-indigo-600 font-bold mb-3 flex items-center gap-1 transition-colors">
                  ← Back to Task Queue
                </button>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-snug">{selectedIssue.title}</h2>
                <div className="flex flex-wrap items-center gap-2.5 mt-2">
                  <StatusBadge status={selectedIssue.status} />
                  <span className="text-slate-200">•</span>
                  <span className="text-xs text-slate-500 font-bold">Severity:</span>
                  <PriorityBadge level={selectedIssue.severity || 'LOW'} />
                  <span className="text-slate-200">•</span>
                  <span className="text-xs text-slate-500 font-semibold flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-slate-400" /> {selectedIssue.location?.address}</span>
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-8">
              {/* Left Column: Details & Map */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Description</h4>
                  <p className="text-sm text-slate-650 leading-relaxed font-semibold bg-slate-50 p-4 border border-slate-100 rounded-2xl">{selectedIssue.description}</p>
                </div>

                {/* Citizen Evidence Gallery */}
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Images className="w-4 h-4 text-indigo-655" />
                    Citizen Uploaded Evidence
                  </h3>
                  {mediaLoading ? (
                    <div className="h-48 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center text-slate-400 text-xs font-semibold">
                      Loading evidence files...
                    </div>
                  ) : selectedIssue.media?.length === 0 ? (
                    <div className="aspect-video w-full border border-slate-100 rounded-2xl overflow-hidden shadow-inner">
                      <PremiumPlaceholder />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <MediaGallery 
                        mediaItems={(selectedIssue.media || []).map((m: any) => ({
                          url: m.imageUrl,
                          thumbnailUrl: m.thumbnailUrl || m.imageUrl,
                          mediaType: 'image' as const
                        }))} 
                        compact={selectedIssue.media?.length > 2} 
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-indigo-650" />
                    Jurisdictional Coordinates
                  </h3>
                  
                  {selectedIssue.location?.lat && selectedIssue.location?.lng && (
                    <div className="border border-slate-105 rounded-3xl overflow-hidden shadow-sm">
                      <LeafletMap
                        center={[selectedIssue.location.lat, selectedIssue.location.lng]}
                        zoom={15}
                        issues={[{
                          _id: selectedIssue._id,
                          title: selectedIssue.title,
                          status: selectedIssue.status,
                          location: selectedIssue.location
                        }]}
                        landmarks={selectedIssue.landmarks || []}
                        jurisdictionRadius={2000}
                        className="w-full h-[250px]"
                      />
                    </div>
                  )}
                </div>

                {selectedIssue.sla && (
                  <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Service Level Agreement (SLA)</h4>
                    <p className="text-sm font-bold text-slate-800">Target Duration: <span className="text-indigo-600 font-bold">{selectedIssue.sla.slaDays} Days</span></p>
                    <p className="text-xs text-slate-505 mt-1">Due Date: <span className="text-indigo-500 font-semibold">{new Date(selectedIssue.sla.dueDate).toLocaleString()}</span> {selectedIssue.sla.overdueFlag && <span className="text-rose-600 font-bold uppercase ml-2">[Overdue / Escalated]</span>}</p>
                  </div>
                )}
              </div>

              {/* Right Column: Actions & Update resolution report */}
              <div className="lg:col-span-5 space-y-6">
                {/* Active Chat Panel with Citizen */}
                <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm flex flex-col h-[320px]">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <MessageSquare className="w-4 h-4 text-indigo-605" />
                    Citizen Progress Chat
                  </h4>
                  <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1 text-xs">
                    {chatMessages.length === 0 ? (
                      <div className="text-slate-405 text-center py-8">No messages yet. Send a message to the citizen.</div>
                    ) : (
                      chatMessages.map((m, idx) => (
                        <div key={idx} className={`flex flex-col ${m.senderId === user._id ? 'items-end' : 'items-start'}`}>
                          <span className="text-[9px] text-slate-400 mb-0.5">{m.senderName} ({m.senderRole === 'ward_officer' ? 'Officer' : 'Citizen'})</span>
                          <div className={`p-2.5 rounded-2xl max-w-[85%] font-medium ${m.senderId === user._id ? 'bg-indigo-600 text-white rounded-tr-none shadow-sm' : 'bg-slate-100 text-slate-750 rounded-tl-none border border-slate-200/40'}`}>
                            {m.message}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <form onSubmit={handleSendChat} className="flex gap-2">
                    <input
                      type="text"
                      value={newMsg}
                      onChange={(e) => setNewMsg(e.target.value)}
                      placeholder="Type a message to citizen..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                    />
                    <button type="submit" className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer">Send</button>
                  </form>
                </div>

                {/* Milestones History */}
                <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm space-y-4">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    Milestones History
                  </h4>
                  <div className="space-y-4 max-h-[180px] overflow-y-auto pr-1">
                    {timeline.map((event, idx) => (
                      <div key={idx} className="flex gap-3 relative pb-1 border-l border-slate-105 pl-4 last:border-l-0">
                        <div className="w-2 h-2 bg-indigo-605 rounded-full absolute -left-[5px] top-1.5" />
                        <div className="text-xs">
                          <p className="font-bold text-slate-800">{event.title}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{event.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status Transitions */}
                <div className="bg-slate-50/50 p-6 border border-slate-100 rounded-[24px] space-y-4">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    <Clipboard className="w-4 h-4 text-indigo-600" />
                    Update Task Status
                  </h3>
                  
                  <div className="flex flex-wrap gap-2.5">
                    {selectedIssue.status === 'ASSIGNED_TO_AUTHORITY' && (
                      <button
                        onClick={() => handleStartWork(selectedIssue._id)}
                        className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Accept Task & Start Work
                      </button>
                    )}
                    {['ASSIGNED_TO_AUTHORITY', 'IN_PROGRESS'].includes(selectedIssue.status) && (
                      <button
                        onClick={() => {/* Custom status transition logic */}}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Mark Work as Completed
                      </button>
                    )}
                  </div>
                </div>

                {/* Resolution Report Form */}
                {['IN_PROGRESS', 'PENDING_CITIZEN_CONFIRMATION', 'RESOLVED', 'CLOSED_RESOLVED'].includes(selectedIssue.status) && (
                  <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm space-y-5">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      Resolution Report Form
                    </h3>
                    
                    <form onSubmit={handleResolveIssue} className="space-y-4 text-xs">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Work Summary / Action Taken</label>
                        <textarea
                          required
                          rows={3}
                          value={workSummary}
                          onChange={(e) => setWorkSummary(e.target.value)}
                          placeholder="Detail the work carried out to fix the issue..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Contractor Name</label>
                          <input
                            type="text"
                            value={contractorDetails}
                            onChange={(e) => setContractorDetails(e.target.value)}
                            placeholder="Contracting agency..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Estimated Cost ($)</label>
                          <input
                            type="number"
                            value={estimatedCost}
                            onChange={(e) => setEstimatedCost(e.target.value)}
                            placeholder="e.g., 250"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Before Photos</label>
                          <input
                            type="file"
                            multiple
                            onChange={(e) => setBeforeFiles(e.target.files)}
                            className="w-full bg-slate-50 border border-slate-205 rounded-xl py-2 px-3 text-xs text-slate-650 cursor-pointer"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">After Photos</label>
                          <input
                            type="file"
                            multiple
                            onChange={(e) => setAfterFiles(e.target.files)}
                            className="w-full bg-slate-50 border border-slate-205 rounded-xl py-2 px-3 text-xs text-slate-650 cursor-pointer"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Internal Admin Notes</label>
                        <input
                          type="text"
                          value={internalNotes}
                          onChange={(e) => setInternalNotes(e.target.value)}
                          placeholder="Comments visible to admin only..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <Button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl justify-center text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-655/15 cursor-pointer">
                        {loading ? 'Submitting Resolution...' : 'Submit Resolution'}
                      </Button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-12 gap-8">
            {/* Assigned Tasks Queue */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Clipboard className="w-6 h-6 text-indigo-600" />
                    Assigned Task Queue
                  </h2>
                  <p className="text-xs text-slate-500 font-semibold mt-1">Review and manage reported civic tickets assigned to your ward jurisdiction.</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-slate-450 uppercase tracking-wider block">Unresolved</span>
                  <span className="text-md font-black text-indigo-700">
                    {issues.filter(i => !['RESOLVED', 'CLOSED_RESOLVED'].includes(i.status)).length}
                  </span>
                </div>
              </div>

              {issues.length === 0 ? (
                <div className="bg-white border border-slate-105 rounded-[24px] p-12 text-center shadow-sm">
                  <p className="text-slate-455 text-sm font-semibold">You have no pending assigned tasks. Good job!</p>
                </div>
              ) : (
                <div className="grid gap-6">
                  {issues.map((issue) => {
                    const mediaUrl = issue.media?.[0]?.imageUrl || issue.thumbnail;
                    return (
                      <div 
                        key={issue._id} 
                        className="bg-white border border-slate-100 hover:border-slate-200 rounded-[24px] p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 transition-all duration-300 shadow-sm relative group"
                      >
                        {/* 16:9 Aspect evidence preview (40% width on md screens) */}
                        <div className="aspect-video w-full md:w-48 rounded-xl overflow-hidden bg-slate-950 border border-slate-100 shrink-0 relative">
                          {mediaUrl ? (
                            <img src={mediaUrl} alt={issue.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <PremiumPlaceholder />
                          )}
                          <div className="absolute top-2 left-2">
                            <span className="px-2 py-0.5 bg-white/90 text-slate-800 text-[8px] font-bold uppercase rounded border border-slate-250/30">
                              {issue.reportedCategory || 'Other'}
                            </span>
                          </div>
                        </div>

                        {/* Title & Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={issue.status} />
                            <PriorityBadge level={issue.severity || 'LOW'} />
                          </div>
                          <h3 className="text-sm font-black text-slate-900 mt-2.5 truncate">{issue.title}</h3>
                          <p className="text-xs text-slate-505 mt-1 flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{issue.location?.address}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 mt-2 font-medium">Assigned to Ward: {issue.location?.ward || user.ward}</p>
                        </div>

                        {/* View Action */}
                        <div className="shrink-0 flex items-center gap-2 pl-4 border-l border-slate-100 h-12">
                          <button 
                            onClick={() => handleSelectIssue(issue)}
                            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            View & Resolve
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Officer Profile & Stats Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm space-y-5">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
                  <User className="w-4 h-4 text-indigo-600" />
                  Officer Profile
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
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Phone Number</p>
                    <p className="font-semibold text-slate-700 mt-0.5">{user.phone || 'Not configured'}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                      Jurisdiction
                    </p>
                    <p className="text-slate-700 text-xs font-semibold leading-relaxed">Ward: {user.ward}</p>
                    <p className="text-slate-700 text-xs font-semibold leading-relaxed">City: {user.city}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm space-y-4">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Jurisdictional Stats
                </h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <p className="text-2xl font-black text-slate-800">{issues.length}</p>
                    <p className="text-[9px] font-bold text-slate-450 uppercase tracking-wider mt-1">Total Tasks</p>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                    <p className="text-2xl font-black text-indigo-650">{issues.filter(i => i.status === 'IN_PROGRESS').length}</p>
                    <p className="text-[9px] font-bold text-slate-450 uppercase tracking-wider mt-1">In Progress</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
