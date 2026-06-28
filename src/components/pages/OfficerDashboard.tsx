import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/shared';
import MediaGallery, { type MediaItem } from '@/components/ui/MediaGallery';
import { connectSocket } from '@/utils/socket';
import { 
  FileText, Clipboard, CheckCircle, 
  MapPin, User, Clock, AlertTriangle, Eye, Send, Images
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

    socket.on('ISSUE_ASSIGNED', handleIssueAssigned);
    socket.on('ISSUE_UPDATED', handleIssueUpdated);
    socket.on('NOTIFICATION_RECEIVED', handleNotification);

    return () => {
      socket.off('ISSUE_ASSIGNED', handleIssueAssigned);
      socket.off('ISSUE_UPDATED', handleIssueUpdated);
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
              <h1 className="text-xl font-display font-bold tracking-tight text-white">CivicPulse AI <span className="text-xs text-amber-400 font-semibold px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-800/40">Ward Officer Dashboard</span></h1>
              <p className="text-xs text-slate-400 font-medium">Officer: {user.name} • Ward: {user.ward} • {user.city}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={onLogout} className="text-xs text-slate-400 hover:text-white border border-slate-700">
            Log Out
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 mt-8">
        {successMsg && (
          <div className="mb-6 p-4 bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-sm rounded-2xl flex items-center gap-2">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-4 bg-red-950/60 border border-red-500/30 text-red-300 text-sm rounded-2xl flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {selectedIssue ? (
          /* Detailed Task Resolution View */
          <div className="bg-slate-800 border border-slate-700/50 rounded-3xl p-8 shadow-xl">
            <div className="flex justify-between items-start gap-4 mb-6">
              <div>
                <button onClick={() => setSelectedIssue(null)} className="text-xs text-slate-400 hover:text-white mb-2 block">← Back to Task Queue</button>
                <h2 className="text-2xl font-display font-extrabold text-white">{selectedIssue.title}</h2>
                <p className="text-xs text-slate-400 mt-1">Status: <span className="text-indigo-400 font-bold uppercase">{selectedIssue.status}</span> • Severity: <span className="text-red-400 font-bold">{selectedIssue.severity || 'PENDING'}</span></p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Description</h4>
                <p className="text-sm text-slate-300 leading-relaxed font-medium bg-slate-900/50 p-4 border border-slate-750 rounded-2xl mb-6">{selectedIssue.description}</p>

                {/* Citizen Evidence from ImageKit */}
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Images className="w-4 h-4 text-amber-400" />
                    Citizen Evidence ({issueMedia.length})
                  </h4>
                  {mediaLoading ? (
                    <div className="flex items-center justify-center py-6 text-slate-500 text-xs">Loading evidence...</div>
                  ) : (
                    <MediaGallery mediaItems={issueMedia} compact={issueMedia.length > 2} />
                  )}
                </div>

                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Location Coordinates</h4>
                <p className="text-sm text-slate-300 leading-relaxed font-medium bg-slate-900/50 p-4 border border-slate-750 rounded-2xl flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>{selectedIssue.location.address || 'Geo coordinates only'} (Lat: {selectedIssue.location.lat}, Lng: {selectedIssue.location.lng})</span>
                </p>

                {selectedIssue.sla && (
                  <div className="mt-6 bg-slate-900/50 p-4 border border-slate-750 rounded-2xl">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Service Level Agreement (SLA)</h4>
                    <p className="text-sm font-semibold text-white">Target Duration: <span className="text-indigo-400 font-bold">{selectedIssue.sla.slaDays} Days</span></p>
                    <p className="text-xs text-slate-400 mt-1">Due Date: <span className="text-indigo-355 font-bold">{new Date(selectedIssue.sla.dueDate).toLocaleString()}</span> {selectedIssue.sla.overdueFlag && <span className="text-red-500 font-bold uppercase ml-2">[Overdue / Escalated]</span>}</p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Timeline / History</h4>
                <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2">
                  {timeline.map((event, idx) => (
                    <div key={idx} className="flex gap-3 relative pb-2 border-l border-slate-700 pl-4 last:border-l-0">
                      <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full absolute -left-[5.5px] top-1.5" />
                      <div>
                        <p className="text-xs font-bold text-white">{event.title}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{event.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions Panel */}
            <div className="border-t border-slate-700/60 pt-8 mt-8">
              {selectedIssue.status === 'ASSIGNED_TO_AUTHORITY' && (
                <div className="bg-slate-900/40 border border-slate-750 p-6 rounded-2xl text-center">
                  <h4 className="text-lg font-bold text-white mb-2">Ready to Start Work?</h4>
                  <p className="text-xs text-slate-400 mb-6">Transition this issue to "In Progress" to notify the citizen that you are resolving it.</p>
                  <Button onClick={() => handleStartWork(selectedIssue._id)} disabled={loading} className="py-2.5 px-6 font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500">
                    {loading ? 'Updating...' : 'Start Work (Mark In Progress)'}
                  </Button>
                </div>
              )}

              {(selectedIssue.status === 'IN_PROGRESS' || selectedIssue.status === 'REOPENED' || selectedIssue.status === 'REQUIRES_FOLLOWUP' || selectedIssue.status === 'ESCALATED') && (
                <div className="bg-slate-900/40 border border-slate-750 p-8 rounded-2xl">
                  <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Send className="w-5 h-5 text-indigo-400" />
                    Submit Resolution Report
                  </h3>
                  
                  <form onSubmit={handleResolveIssue} className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Work Summary / Action Taken</label>
                      <textarea
                        required
                        rows={3}
                        value={workSummary}
                        onChange={(e) => setWorkSummary(e.target.value)}
                        placeholder="Detail the work carried out to fix the issue..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Contractor Details (If applicable)</label>
                        <input
                          type="text"
                          value={contractorDetails}
                          onChange={(e) => setContractorDetails(e.target.value)}
                          placeholder="Contracting agency or worker names..."
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Estimated Cost (USD)</label>
                        <input
                          type="number"
                          value={estimatedCost}
                          onChange={(e) => setEstimatedCost(e.target.value)}
                          placeholder="e.g., 250"
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-indigo-500"
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
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">After Photos</label>
                        <input
                          type="file"
                          multiple
                          onChange={(e) => setAfterFiles(e.target.files)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2 px-3 text-xs text-white cursor-pointer"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Internal Notes (Privately logged)</label>
                      <input
                        type="text"
                        value={internalNotes}
                        onChange={(e) => setInternalNotes(e.target.value)}
                        placeholder="Any comments visible to administrators only..."
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl py-2.5 px-4 text-sm text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <Button type="submit" disabled={loading} className="w-full py-3 rounded-xl justify-center text-sm font-semibold shadow-md shadow-indigo-600/20">
                      {loading ? 'Submitting Resolution...' : 'Submit Resolution'}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-12 gap-8">
            {/* Assigned Tasks Queue */}
            <div className="lg:col-span-8 bg-slate-800 border border-slate-700/50 rounded-3xl p-6 shadow-xl h-fit">
              <h2 className="text-2xl font-display font-extrabold text-white mb-6 flex items-center gap-2">
                <Clipboard className="w-6 h-6 text-indigo-400" />
                Assigned Task Queue
              </h2>
              {issues.length === 0 ? (
                <p className="text-slate-400 text-sm font-medium py-12 text-center">You have no pending assigned tasks. Good job!</p>
              ) : (
                <div className="space-y-4">
                  {issues.map((issue) => (
                    <div key={issue._id} className="bg-slate-900/60 border border-slate-700/50 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-slate-600 transition-colors">
                      <div>
                        <span className="px-2 py-0.5 bg-red-950/45 border border-red-900/40 text-red-400 font-bold text-[9px] uppercase rounded-full">
                          {issue.severity || 'LOW'} Severity
                        </span>
                        <h3 className="text-md font-bold text-white mt-2">{issue.title}</h3>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" /> {issue.location.address}
                        </p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="text-xs font-bold text-indigo-400 bg-indigo-950/80 px-3 py-1.5 rounded-xl border border-indigo-800/40 uppercase">{issue.status}</span>
                        <button onClick={() => handleSelectIssue(issue)} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Officer Profile & Stats Sidebar */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-slate-800 border border-slate-700/50 rounded-3xl p-5 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <User className="w-4 h-4 text-indigo-400" />
                  Officer Profile
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
                    <p className="text-[10px] font-bold text-slate-500 uppercase">Phone Number</p>
                    <p className="font-medium text-slate-300">{user.phone || 'Not configured'}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-700/50 space-y-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                      Jurisdiction
                    </p>
                    <p className="text-slate-300 text-xs font-medium">Assigned City: {user.city}</p>
                    <p className="text-slate-300 text-xs font-medium">Assigned Ward: {user.ward}</p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700/50 rounded-3xl p-5 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Quick Tasks Stats
                </h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-750">
                    <p className="text-2xl font-black text-white">{issues.length}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">Assigned</p>
                  </div>
                  <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-750">
                    <p className="text-2xl font-black text-indigo-400">{issues.filter(i => i.status === 'IN_PROGRESS').length}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase mt-1">In Progress</p>
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
