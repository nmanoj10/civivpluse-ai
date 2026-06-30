import React, { useState, useEffect, useCallback } from 'react';
import IssueDetails from './IssueDetails';
import ExploreIssues from './ExploreIssues';
import CommunityFeed from './CommunityFeed';
import { Button } from '@/components/ui/shared';
import MediaGallery, { type MediaItem } from '@/components/ui/MediaGallery';
import LeafletMap from '@/components/ui/LeafletMap';
import { connectSocket, getSocket } from '@/utils/socket';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, PlusCircle, CheckCircle, ThumbsUp, ThumbsDown, 
  MapPin, Bell, User, Clock, AlertTriangle, Eye, Upload, MessageSquare, Images,
  Compass, Search, Heart, Sparkles, Filter, ChevronLeft, ChevronRight,
  MoreVertical, Share2, Copy, ExternalLink, ShieldCheck
} from 'lucide-react';

// Helper Components for SaaS dashboard redesign
const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, { bg: string, text: string, dot: string }> = {
    'SUBMITTED': { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
    'MEDIA_UPLOADED': { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', dot: 'bg-blue-500' },
    'OPEN_FOR_COMMUNITY_VERIFICATION': { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
    'ASSIGNED_TO_AUTHORITY': { bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700', dot: 'bg-purple-500' },
    'IN_PROGRESS': { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
    'RESOLVED': { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    'CLOSED_RESOLVED': { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
    'REJECTED': { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
    'ESCALATED': { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' }
  };

  const current = styles[status] || { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700', dot: 'bg-slate-500' };

  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${current.bg} ${current.text}`}>
      <span className={`w-2 h-2 rounded-full ${current.dot}`} />
      {status.replace(/_/g, ' ')}
    </span>
  );
};

const PriorityBadge = ({ level }: { level: string }) => {
  const styles: Record<string, { bg: string, text: string }> = {
    'LOW': { bg: 'bg-slate-105 text-slate-600 border-slate-200', text: 'Low' },
    'MEDIUM': { bg: 'bg-amber-50 text-amber-700 border-amber-200', text: 'Medium' },
    'HIGH': { bg: 'bg-orange-50 text-orange-700 border-orange-200', text: 'High' },
    'CRITICAL': { bg: 'bg-rose-50 text-rose-700 border-rose-200', text: 'Critical' }
  };

  const current = styles[level?.toUpperCase()] || { bg: 'bg-slate-105 text-slate-600 border-slate-200', text: level || 'LOW' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase border ${current.bg}`}>
      {current.text}
    </span>
  );
};

const ProgressTimeline = ({ status }: { status: string }) => {
  const steps = [
    { label: 'Reported', completed: true },
    { label: 'AI Analysis', completed: status !== 'SUBMITTED' },
    { label: 'Community', completed: !['SUBMITTED', 'MEDIA_UPLOADED', 'OPEN_FOR_COMMUNITY_VERIFICATION'].includes(status) },
    { label: 'Assigned', completed: !['SUBMITTED', 'MEDIA_UPLOADED', 'OPEN_FOR_COMMUNITY_VERIFICATION'].includes(status) },
    { label: 'In Progress', completed: ['IN_PROGRESS', 'RESOLVED', 'CLOSED_RESOLVED', 'CLOSED'].includes(status) },
    { label: 'Resolved', completed: ['RESOLVED', 'CLOSED_RESOLVED'].includes(status) }
  ];

  return (
    <div className="w-full mt-4">
      <div className="flex justify-between items-center relative">
        <div className="absolute left-0 right-0 top-3.5 h-0.5 bg-slate-200 z-0" />
        
        {steps.map((step, idx) => (
          <div key={idx} className="flex flex-col items-center z-10">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 text-[11px] font-bold transition-all duration-300 ${
              step.completed 
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20' 
                : 'bg-white border-slate-200 text-slate-400'
            }`}>
              {step.completed ? '✓' : '○'}
            </div>
            <span className="text-[8px] font-bold text-slate-500 mt-1 uppercase tracking-wider">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const PremiumPlaceholder = () => (
  <div className="w-full h-full bg-gradient-to-br from-indigo-50 to-slate-100 flex flex-col items-center justify-center p-6 text-center select-none">
    <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner mb-3">
      <Sparkles className="w-6 h-6 animate-pulse" />
    </div>
    <span className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">CIVICPULSE AI EVIDENCE</span>
    <span className="text-[9px] text-slate-500 mt-1">Satellite coordinate lock active</span>
  </div>
);

interface IssueCardProps {
  key?: any;
  issue: any;
  onViewDetails: (issue: any) => any;
  onVote?: (issueId: string, voteType: 'EXISTS' | 'NOT_FOUND') => Promise<void>;
  onUndoVote?: (issueId: string) => Promise<void>;
}

const ExpandedProgressTracker = ({ status }: { status: string }) => {
  const steps = [
    { label: 'Reported', completed: true },
    { label: 'AI Analysis', completed: status !== 'SUBMITTED' },
    { label: 'Community Verification', completed: !['SUBMITTED', 'MEDIA_UPLOADED', 'OPEN_FOR_COMMUNITY_VERIFICATION'].includes(status) },
    { label: 'Officer Assigned', completed: ['ASSIGNED_TO_AUTHORITY', 'IN_PROGRESS', 'RESOLVED', 'CLOSED_RESOLVED', 'PENDING_CITIZEN_CONFIRMATION'].includes(status) },
    { label: 'Work Started', completed: ['IN_PROGRESS', 'RESOLVED', 'CLOSED_RESOLVED', 'PENDING_CITIZEN_CONFIRMATION'].includes(status) },
    { label: 'In Progress', completed: ['IN_PROGRESS', 'RESOLVED', 'CLOSED_RESOLVED', 'PENDING_CITIZEN_CONFIRMATION'].includes(status) },
    { label: 'Resolved', completed: ['RESOLVED', 'CLOSED_RESOLVED'].includes(status) },
    { label: 'Citizen Confirmed', completed: status === 'CLOSED_RESOLVED' }
  ];

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 md:flex md:justify-between items-center relative gap-4">
        {/* Horizontal connector line on md+ screens */}
        <div className="hidden md:block absolute left-0 right-0 top-3.5 h-0.5 bg-slate-100 z-0" />
        
        {steps.map((step, idx) => (
          <div key={idx} className="flex md:flex-col items-center gap-2 md:gap-0 z-10">
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: idx * 0.04 }}
              className={`w-7 h-7 rounded-full flex items-center justify-center border text-[11px] font-bold transition-all duration-300 ${
                step.completed 
                  ? 'bg-indigo-600 border-indigo-650 text-white shadow-sm shadow-indigo-600/20' 
                  : 'bg-white border-slate-200 text-slate-400'
              }`}
            >
              {step.completed ? '✓' : '○'}
            </motion.div>
            <span className={`text-[9px] font-bold mt-1.5 uppercase tracking-wider ${step.completed ? 'text-indigo-600' : 'text-slate-400'}`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const OfficerTimeline = ({ timeline, status }: { timeline: any[], status: string }) => {
  const statusSteps = [
    { key: 'REPORTED', label: 'Issue Reported', done: true, desc: 'Incident successfully committed to database.' },
    { key: 'AI_ANALYSIS', label: 'AI Completed', done: status !== 'SUBMITTED', desc: 'Gemini NLP classification and GIS infrastructure scan completed.' },
    { key: 'COMMUNITY_VERIFICATION', label: 'Community Verified', done: !['SUBMITTED', 'MEDIA_UPLOADED', 'OPEN_FOR_COMMUNITY_VERIFICATION'].includes(status), desc: 'Community thresholds satisfied; priority score recalibrated.' },
    { key: 'ASSIGNED', label: 'Officer Assigned', done: ['ASSIGNED_TO_AUTHORITY', 'IN_PROGRESS', 'RESOLVED', 'CLOSED_RESOLVED', 'PENDING_CITIZEN_CONFIRMATION'].includes(status), desc: 'Department engineer assigned based on ward location.' },
    { key: 'INSPECTION', label: 'Inspection Scheduled', done: ['IN_PROGRESS', 'RESOLVED', 'CLOSED_RESOLVED', 'PENDING_CITIZEN_CONFIRMATION'].includes(status), desc: 'Officer has scheduled visual survey validation.' },
    { key: 'WORK_STARTED', label: 'Work Started', done: ['IN_PROGRESS', 'RESOLVED', 'CLOSED_RESOLVED', 'PENDING_CITIZEN_CONFIRMATION'].includes(status), desc: 'Contracting agency dispatched to correct site issues.' },
    { key: 'WORK_COMPLETED', label: 'Work Completed', done: ['RESOLVED', 'CLOSED_RESOLVED', 'PENDING_CITIZEN_CONFIRMATION'].includes(status), desc: 'Officer submitted resolution report with verification evidence.' },
    { key: 'CITIZEN_PENDING', label: 'Citizen Confirmation Pending', done: ['RESOLVED', 'CLOSED_RESOLVED', 'PENDING_CITIZEN_CONFIRMATION'].includes(status), desc: 'Awaiting reporter validation to close ticket.' }
  ];

  return (
    <div className="space-y-4 bg-slate-50/50 p-4 border border-slate-100 rounded-2xl">
      <div className="relative border-l border-slate-200 pl-4 space-y-4">
        {statusSteps.map((step, idx) => (
          <div key={idx} className="relative">
            <div className={`w-3.5 h-3.5 rounded-full absolute -left-[23px] top-0.5 border-2 ${
              step.done ? 'bg-indigo-600 border-indigo-500' : 'bg-white border-slate-300'
            }`} />
            <div>
              <p className={`text-xs font-bold ${step.done ? 'text-slate-800' : 'text-slate-400'}`}>{step.label}</p>
              <p className="text-[10px] text-slate-500 font-semibold mt-0.5">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const IssueCard = ({ issue, onViewDetails, onVote, onUndoVote }: IssueCardProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showUpdates, setShowUpdates] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [timeline, setTimeline] = useState<any[]>([]);

  const mediaUrl = issue.media?.[0]?.imageUrl || issue.thumbnail;

  useEffect(() => {
    if (showUpdates && issue._id) {
      fetch(`/api/issues/${issue._id}/timeline`)
        .then(res => res.json())
        .then(data => {
          if (data.success) setTimeline(data.data);
        })
        .catch(err => console.error(err));
    }
  }, [showUpdates, issue._id]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(issue._id);
    alert('Copied Issue ID to clipboard!');
    setMenuOpen(false);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/issue/${issue._id}`;
    navigator.clipboard.writeText(url);
    alert('Copied share link to clipboard!');
    setMenuOpen(false);
  };

  const handleDownloadReport = (e: React.MouseEvent) => {
    e.stopPropagation();
    const content = `CIVICPULSE AI INCIDENT AUDIT REPORT\n
==========================================
Issue Reference ID: ${issue._id}
Title: ${issue.title}
Description: ${issue.description || 'No description'}
Category: ${issue.reportedCategory || issue.category || 'Other'}
Status: ${issue.status}
Priority Level: ${issue.severity || 'LOW'}
Priority Score: ${issue.priorityScore || 45}/100
AI Confidence: ${issue.aiConfidence ? Math.round(issue.aiConfidence) : 92}%
Trust Score: ${issue.trustScore || 80}/100
Location Address: ${issue.location?.address}
Coordinates: Latitude ${issue.location?.lat}, Longitude ${issue.location?.lng}
Estimated Resolution Time: ${issue.estimatedResolutionTime || '48 Hours'}
Assigned Department: ${issue.assignedDepartment || 'None Assigned'}
Assigned Officer: ${issue.assignedOfficer?.name || issue.assignedOfficer || 'None Assigned'}
Reported Date: ${new Date(issue.createdAt).toLocaleString()}
Support Votes: ${issue.supportCount || 0}
Rejection Votes: ${issue.rejectCount || 0}
==========================================
Report generated automatically by CivicPulse AI.`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CivicPulse_Report_${issue._id}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -6, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.04), 0 10px 10px -5px rgba(0, 0, 0, 0.01)' }}
      className="bg-white border border-slate-100 rounded-[32px] overflow-hidden shadow-sm flex flex-col transition-all duration-300 relative p-7 gap-7"
    >
      <div className="grid lg:grid-cols-12 gap-7 items-start">
        {/* Left Side: Large Image Preview & Mini Map */}
        <div className="lg:col-span-5 space-y-5">
          <div className="aspect-[4/3] w-full rounded-2xl overflow-hidden bg-slate-950 border border-slate-100 relative group">
            {mediaUrl ? (
              <motion.img
                src={mediaUrl}
                alt={issue.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                whileHover={{ scale: 1.05 }}
              />
            ) : (
              <PremiumPlaceholder />
            )}
            <div className="absolute top-4 left-4 flex flex-wrap gap-2">
              <span className="px-3 py-1.5 bg-white/95 backdrop-blur-sm text-slate-800 border border-slate-200/30 text-[10px] font-extrabold uppercase rounded-full shadow-sm">
                {issue.reportedCategory || issue.category || 'Other'}
              </span>
            </div>
            <div className="absolute top-4 right-4">
              <StatusBadge status={issue.status || 'SUBMITTED'} />
            </div>
          </div>

          {/* Interactive coordinates preview map */}
          {issue.location?.lat && issue.location?.lng && (
            <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm h-36 relative">
              <LeafletMap
                center={[issue.location.lat, issue.location.lng]}
                zoom={14}
                issues={[issue]}
                landmarks={[]}
                jurisdictionRadius={0}
                className="w-full h-full"
              />
              <div className="absolute bottom-2 right-2 bg-white/90 backdrop-blur-md px-2 py-0.5 rounded text-[8px] font-bold text-slate-700 border border-slate-200/30 shadow-sm pointer-events-none">
                {issue.location.lat.toFixed(4)}, {issue.location.lng.toFixed(4)}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Primary Info & Meta Metrics Grid */}
        <div className="lg:col-span-7 space-y-5 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-slate-900 leading-snug">{issue.title}</h3>
                <p className="text-xs text-slate-500 font-semibold mt-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span>{issue.location?.address || 'Locality coordinates active'}</span>
                </p>
              </div>

              {/* Quick Actions Action menu */}
              <div className="relative">
                <button 
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl transition-colors border border-transparent hover:border-slate-100"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-100 rounded-xl shadow-lg z-20 py-1.5 text-xs text-slate-600 font-bold">
                    <button onClick={handleCopyId} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-50 text-left">
                      <Copy className="w-3.5 h-3.5" /> Copy Reference ID
                    </button>
                    <button onClick={handleShare} className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-50 text-left">
                      <Share2 className="w-3.5 h-3.5" /> Share Report Link
                    </button>
                  </div>
                )}
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-semibold mt-3 bg-slate-50/50 p-3.5 border border-slate-100 rounded-2xl">
              {issue.description || 'No detailed description provided.'}
            </p>
          </div>

          {/* SaaS Parameters Metadata Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50/30 p-4 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-650">
            <div>
              <span className="block text-[9px] text-slate-450 uppercase font-extrabold tracking-wider">Reported Date</span>
              <span className="text-slate-800 font-bold block mt-0.5">{new Date(issue.createdAt).toLocaleDateString()} at {new Date(issue.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div>
              <span className="block text-[9px] text-slate-450 uppercase font-extrabold tracking-wider">AI Confidence</span>
              <span className="text-slate-800 font-bold block mt-0.5">{issue.aiConfidence ? `${Math.round(issue.aiConfidence)}%` : '92%'}</span>
            </div>
            <div>
              <span className="block text-[9px] text-slate-450 uppercase font-extrabold tracking-wider">Trust Score</span>
              <span className="text-slate-800 font-bold block mt-0.5">{issue.trustScore || 80}/100</span>
            </div>
            <div>
              <span className="block text-[9px] text-slate-450 uppercase font-extrabold tracking-wider">Priority Score</span>
              <span className="text-indigo-650 font-black block mt-0.5">{issue.priorityScore || 45} / 100</span>
            </div>
            <div>
              <span className="block text-[9px] text-slate-450 uppercase font-extrabold tracking-wider">Severity</span>
              <span className="block mt-0.5"><PriorityBadge level={issue.severity || 'LOW'} /></span>
            </div>
            <div>
              <span className="block text-[9px] text-slate-450 uppercase font-extrabold tracking-wider">Est. Resolution</span>
              <span className="text-slate-800 font-bold block mt-0.5">{issue.estimatedResolutionTime || '48 Hours'}</span>
            </div>
            {issue.assignedDepartment && (
              <div>
                <span className="block text-[9px] text-slate-455 uppercase font-extrabold tracking-wider">Department</span>
                <span className="text-slate-800 font-bold block mt-0.5 truncate">{issue.assignedDepartment}</span>
              </div>
            )}
            {issue.assignedOfficer && (
              <div>
                <span className="block text-[9px] text-slate-455 uppercase font-extrabold tracking-wider">Assigned Officer</span>
                <span className="text-indigo-600 font-bold block mt-0.5 truncate">{issue.assignedOfficer?.name || issue.assignedOfficer}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Progress Timeline Tracker Section */}
      <div className="border-t border-slate-100 pt-6">
        <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">Lifecycle Resolution Progress</h4>
        <ExpandedProgressTracker status={issue.status} />
      </div>

      {/* Actions Toolbar & Expand Toggles */}
      <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => onVote?.(issue._id, 'EXISTS')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Community Endorsement Support"
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            <span>Support ({issue.supportCount || 0})</span>
          </button>
          <button 
            onClick={() => onVote?.(issue._id, 'NOT_FOUND')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-150 hover:bg-slate-100 text-slate-655 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Reported Rejections"
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            <span>Reject ({issue.rejectCount || 0})</span>
          </button>
          
          <button 
            onClick={handleShare}
            className="p-2 hover:bg-slate-50 text-slate-500 rounded-xl transition-all border border-slate-100 cursor-pointer"
            title="Share Issue"
          >
            <Share2 className="w-3.5 h-3.5" />
          </button>
          
          <button 
            onClick={handleDownloadReport}
            className="flex items-center gap-1 px-3 py-1.5 hover:bg-slate-50 text-slate-600 border border-slate-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
            title="Download Incident Report"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Download Report</span>
          </button>

          <button 
            onClick={() => setShowUpdates(!showUpdates)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              showUpdates 
                ? 'bg-indigo-650 text-white border-indigo-600' 
                : 'hover:bg-slate-50 text-slate-600 border-slate-100'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Officer Updates</span>
          </button>

          <button 
            onClick={() => setShowEvidence(!showEvidence)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
              showEvidence 
                ? 'bg-indigo-650 text-white border-indigo-600' 
                : 'hover:bg-slate-50 text-slate-600 border-slate-100'
            }`}
          >
            <Images className="w-3.5 h-3.5" />
            <span>Evidence Gallery ({issue.media?.length || 0})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            onClick={() => onViewDetails(issue)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-all shadow-md shadow-indigo-600/10 cursor-pointer"
          >
            View Details
          </Button>
        </div>
      </div>

      {/* Expandable Officer Timeline Drawer */}
      <AnimatePresence>
        {showUpdates && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-t border-slate-100 pt-4"
          >
            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">Official Operations Log</h4>
            <OfficerTimeline timeline={timeline} status={issue.status} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expandable Evidence Gallery Grid */}
      <AnimatePresence>
        {showEvidence && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden border-t border-slate-100 pt-4"
          >
            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-4">Evidence & Citizen Uploads</h4>
            {issue.media && issue.media.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {issue.media.map((med: any, idx: number) => (
                  <div key={idx} className="aspect-video rounded-xl overflow-hidden border border-slate-100 bg-slate-900 shadow-sm relative group">
                    <img src={med.imageUrl || med.url} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <a href={med.imageUrl || med.url} target="_blank" rel="noreferrer" className="p-2 bg-white/90 rounded-full text-slate-800 shadow-lg">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-xs font-semibold text-slate-450 bg-slate-50 border border-slate-100 rounded-2xl">
                No additional media attachments.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

interface CitizenDashboardProps {
  user: any;
  token: string;
  onLogout: () => void;
}

export default function CitizenDashboard({ user, token, onLogout }: CitizenDashboardProps) {
  const [activeTab, setActiveTab] = useState<'my-reports' | 'report-issue' | 'verify-issues' | 'explore-issues' | 'community-feed' | 'notifications'>('my-reports');
  const [issues, setIssues] = useState<any[]>([]);
  const [pendingIssues, setPendingIssues] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [citizenScore, setCitizenScore] = useState<any>(null);
  const [selectedIssue, setSelectedIssue] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [issueMedia, setIssueMedia] = useState<MediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState('');

  // Locality & Community Feeds state
  const [recentCommunityIssues, setRecentCommunityIssues] = useState<any[]>([]);
  const [localityIssues, setLocalityIssues] = useState<any[]>([]);
  const [communityIssuesList, setCommunityIssuesList] = useState<any[]>([]);
  const [communityFeedType, setCommunityFeedType] = useState<'newest' | 'trending' | 'resolved'>('newest');

  // Explore Tab Filter state
  const [exploreIssuesList, setExploreIssuesList] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterWard, setFilterWard] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [filterTaluk, setFilterTaluk] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterDistance, setFilterDistance] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  
  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Road & Transport');
  const [lat, setLat] = useState(user.lat ? user.lat.toString() : '12.9716');
  const [lng, setLng] = useState(user.lng ? user.lng.toString() : '77.5946');
  const [address, setAddress] = useState(user.locality || 'MG Road');
  const [ward, setWard] = useState(user.ward || 'Ward 1');
  const [city, setCity] = useState(user.city || 'Bengaluru');
  const [files, setFiles] = useState<FileList | null>(null);
  
  // Action States
  const [loading, setLoading] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch initial data
  const fetchData = async () => {
    try {
      // 1. Fetch public issues
      const resIssues = await fetch('/api/issues');
      const dataIssues = await resIssues.json();
      if (dataIssues.success) setIssues(dataIssues.data);

      // 2. Fetch notifications
      const resNotif = await fetch('/api/notifications', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataNotif = await resNotif.json();
      if (dataNotif.success) setNotifications(dataNotif.data);

      // 3. Fetch citizen score by calling profile
      const resProfile = await fetch('/api/auth/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataProfile = await resProfile.json();
      if (dataProfile.success && dataProfile.data.citizenScore) {
        setCitizenScore(dataProfile.data.citizenScore);
      }

      // 4. Fetch pending issues for community verification
      const resPending = await fetch(`/api/community/pending?lat=${user.lat || ''}&lng=${user.lng || ''}&city=${user.city || ''}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataPending = await resPending.json();
      if (dataPending.success) setPendingIssues(dataPending.data);

      // 5. Fetch Recent Community Issues (Explore query with limit=5)
      const resRecent = await fetch('/api/issues/explore?limit=5');
      const dataRecent = await resRecent.json();
      if (dataRecent.success) setRecentCommunityIssues(dataRecent.data.issues);

      // 6. Fetch Locality-Based Feed
      const resLocality = await fetch('/api/issues/feed/locality', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const dataLocality = await resLocality.json();
      if (dataLocality.success) setLocalityIssues(dataLocality.data.issues);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchExploreIssues = async (targetPage = page) => {
    try {
      const queryParams = new URLSearchParams();
      if (searchQuery) queryParams.append('search', searchQuery);
      if (filterCategory) queryParams.append('category', filterCategory);
      if (filterStatus) queryParams.append('status', filterStatus);
      if (filterSeverity) queryParams.append('severity', filterSeverity);
      if (filterWard) queryParams.append('ward', filterWard);
      if (filterCity) queryParams.append('city', filterCity);
      if (filterDistrict) queryParams.append('district', filterDistrict);
      if (filterTaluk) queryParams.append('taluk', filterTaluk);
      if (filterDate) queryParams.append('date', filterDate);
      if (filterDistance) queryParams.append('distance', filterDistance);
      
      queryParams.append('sortBy', sortBy);
      queryParams.append('page', targetPage.toString());
      queryParams.append('limit', '9');

      if (filterDistance && user.lat && user.lng) {
        queryParams.append('lat', user.lat.toString());
        queryParams.append('lng', user.lng.toString());
      }

      const res = await fetch(`/api/issues/explore?${queryParams.toString()}`);
      const data = await res.json();
      if (data.success) {
        setExploreIssuesList(data.data.issues);
        setTotalPages(data.data.pagination.pages || 1);
        setTotalItems(data.data.pagination.total || 0);
      }
    } catch (err) {
      console.error('Explore issues fetch failed:', err);
    }
  };

  const fetchCommunityIssues = async (type = communityFeedType) => {
    try {
      const res = await fetch(`/api/issues/feed/community?type=${type}&limit=9`);
      const data = await res.json();
      if (data.success) {
        setCommunityIssuesList(data.data.issues);
      }
    } catch (err) {
      console.error('Community feed fetch failed:', err);
    }
  };

  const handleSupportIssue = async (masterId: string) => {
    try {
      const res = await fetch(`/api/issues/master/${masterId}/support`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        // Instant refresh
        fetchData();
        if (activeTab === 'explore-issues') fetchExploreIssues();
        if (activeTab === 'community-feed') fetchCommunityIssues();
      }
    } catch (err) {
      console.error('Failed to support issue:', err);
    }
  };

  // Initial data loading when activeTab/filters change
  useEffect(() => {
    fetchData();
    if (activeTab === 'explore-issues') fetchExploreIssues(page);
    if (activeTab === 'community-feed') fetchCommunityIssues(communityFeedType);
  }, [activeTab, page, sortBy, filterCategory, filterStatus, filterSeverity, filterDate, filterDistance, communityFeedType]);

  // Request browser notification permission on mount
  useEffect(() => {
    if (window.Notification && window.Notification.permission !== 'granted') {
      window.Notification.requestPermission();
    }
  }, []);

  // Initialize and connect Socket.IO
  useEffect(() => {
    const socket = connectSocket(token);

    const handleNewIssueCreated = (newIssue: any) => {
      console.log('Socket event: NEW_ISSUE_CREATED', newIssue);
      fetchData();
      if (activeTab === 'explore-issues') fetchExploreIssues(page);
    };

    const handleCommunityVoteAdded = ({ vote, issue: updatedIssue }: any) => {
      console.log('Socket event: COMMUNITY_VOTE_ADDED', updatedIssue);
      setIssues(prev => prev.map(i => i._id === updatedIssue._id ? { ...i, ...updatedIssue } : i));
      setRecentCommunityIssues(prev => prev.map(i => i._id === updatedIssue._id || i.issueId === updatedIssue._id ? { ...i, ...updatedIssue } : i));
      setExploreIssuesList(prev => prev.map(i => i._id === updatedIssue._id ? { ...i, ...updatedIssue } : i));
      setCommunityIssuesList(prev => prev.map(i => i._id === updatedIssue._id ? { ...i, ...updatedIssue } : i));
      
      if (selectedIssue && selectedIssue._id === updatedIssue._id) {
        setSelectedIssue((prev: any) => ({ ...prev, ...updatedIssue }));
        loadTimeline(updatedIssue._id);
      }
    };

    const handleIssueUpdated = (updatedIssue: any) => {
      console.log('Socket event: ISSUE_UPDATED', updatedIssue);
      setIssues(prev => prev.map(i => i._id === updatedIssue._id ? { ...i, ...updatedIssue } : i));
      setRecentCommunityIssues(prev => prev.map(i => i._id === updatedIssue._id || i.issueId === updatedIssue._id ? { ...i, ...updatedIssue } : i));
      setExploreIssuesList(prev => prev.map(i => i._id === updatedIssue._id ? { ...i, ...updatedIssue } : i));
      setCommunityIssuesList(prev => prev.map(i => i._id === updatedIssue._id ? { ...i, ...updatedIssue } : i));
      
      if (selectedIssue && selectedIssue._id === updatedIssue._id) {
        setSelectedIssue((prev: any) => ({ ...prev, ...updatedIssue }));
        loadTimeline(updatedIssue._id);
        loadIssueMedia(updatedIssue._id);
      }
    };

    const handleNotificationReceived = (notif: any) => {
      console.log('Socket event: NOTIFICATION_RECEIVED', notif);
      setNotifications(prev => [notif, ...prev]);

      // Native Web Notification
      if (window.Notification && window.Notification.permission === 'granted') {
        new window.Notification(notif.title, { body: notif.message });
      }

      // App UI Alert banner
      setSuccessMsg(`[Live Alert] ${notif.title}: ${notif.message}`);
      setTimeout(() => setSuccessMsg(''), 7000);
      
      // Update score or data if needed
      fetchData();
    };

    const handleChatMessage = (msg: any) => {
      console.log('Socket event: CHAT_MESSAGE', msg);
      if (selectedIssue && selectedIssue._id === msg.issueId) {
        setChatMessages(prev => {
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
      }
    };

    const handleVoteUpdated = (payload: any) => {
      console.log('Socket event: VOTE_UPDATED', payload);
      const updatedIssue = payload.issue;
      if (updatedIssue) {
        setIssues(prev => prev.map(i => i._id === updatedIssue._id ? { ...i, ...updatedIssue } : i));
        if (selectedIssue && selectedIssue._id === updatedIssue._id) {
          setSelectedIssue((prev: any) => ({ ...prev, ...updatedIssue }));
        }
      }
    };

    socket.on('NEW_ISSUE_CREATED', handleNewIssueCreated);
    socket.on('COMMUNITY_VOTE_ADDED', handleCommunityVoteAdded);
    socket.on('ISSUE_UPDATED', handleIssueUpdated);
    socket.on('ISSUE_ASSIGNED', handleIssueUpdated);
    socket.on('CHAT_MESSAGE', handleChatMessage);
    socket.on('VOTE_UPDATED', handleVoteUpdated);
    socket.on('NOTIFICATION_RECEIVED', handleNotificationReceived);

    return () => {
      socket.off('NEW_ISSUE_CREATED', handleNewIssueCreated);
      socket.off('COMMUNITY_VOTE_ADDED', handleCommunityVoteAdded);
      socket.off('ISSUE_UPDATED', handleIssueUpdated);
      socket.off('ISSUE_ASSIGNED', handleIssueUpdated);
      socket.off('CHAT_MESSAGE', handleChatMessage);
      socket.off('VOTE_UPDATED', handleVoteUpdated);
      socket.off('NOTIFICATION_RECEIVED', handleNotificationReceived);
    };
  }, [activeTab, page, selectedIssue?._id, communityFeedType, token]);

  const handleReportIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      // 1. Create issue
      const res = await fetch('/api/issues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title, description, category, lat, lng, address, ward, city })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit report');

      const issueId = data.data._id;

      // 2. Upload media if present
      if (files && files.length > 0) {
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
          formData.append('media', files[i]);
        }

        const uploadRes = await fetch(`/api/issues/${issueId}/media`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.message || 'Media upload failed.');
      }

      setSuccessMsg('Issue reported successfully and AI pipeline analysis has been scheduled!');
      setTitle('');
      setDescription('');
      setFiles(null);
      setTimeout(() => {
        setActiveTab('my-reports');
        fetchData();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (issueId: string, voteType: 'EXISTS' | 'NOT_FOUND') => {
    setError('');
    try {
      const res = await fetch(`/api/community/${issueId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ voteType })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to submit vote');
      
      setSuccessMsg('Thank you for verifying! Your reputation score has increased.');
      fetchData();
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Voting failed');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleFeedback = async (issueId: string, feedbackType: 'RESOLVED' | 'STILL_UNRESOLVED' | 'NEEDS_FOLLOWUP') => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/resolutions/${issueId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ feedbackType, comment: feedbackComment })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Feedback submission failed');

      setSuccessMsg(`Feedback submitted: Issue marked as ${feedbackType}`);
      setSelectedIssue(null);
      setFeedbackComment('');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Feedback failed');
    } finally {
      setLoading(false);
    }
  };

  const loadTimeline = async (issueId: string) => {
    try {
      const res = await fetch(`/api/issues/${issueId}/timeline`);
      const data = await res.json();
      if (data.success) setTimeline(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const loadIssueMedia = async (issueId: string) => {
    setMediaLoading(true);
    setIssueMedia([]);
    try {
      const res = await fetch(`/api/issues/${issueId}/media`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setIssueMedia(data.data.map((m: any) => ({
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
      console.error('Failed to load issue media:', err);
    } finally {
      setMediaLoading(false);
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

  const handleUndoVote = async (issueId: string) => {
    setError('');
    try {
      const res = await fetch(`/api/community/${issueId}/vote`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = res.ok ? await res.json() : null;
      if (!res.ok) throw new Error('Undo vote failed');

      setSuccessMsg('Your vote has been successfully revoked.');
      fetchData();
      
      const detailRes = await fetch(`/api/issues/${issueId}`);
      const detailData = await detailRes.json();
      if (detailData.success) setSelectedIssue(detailData.data);

      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Undo voting failed');
      setTimeout(() => setError(''), 4000);
    }
  };

  const handleSelectIssue = async (issue: any) => {
    if (!issue) return;
    const issueId = typeof issue === 'object' && issue !== null ? issue._id : issue;
    console.log('CitizenDashboard: handleSelectIssue called with:', issue, 'Resolved issueId:', issueId);

    // If an object was passed, set it immediately for visual responsiveness
    if (typeof issue === 'object' && issue !== null) {
      setSelectedIssue(issue);
    } else {
      setSelectedIssue({ _id: issueId, title: 'Loading...', description: 'Fetching issue details...', location: {} });
    }

    setIssueMedia([]);
    loadTimeline(issueId);
    loadIssueMedia(issueId);
    loadChatHistory(issueId);

    try {
      const res = await fetch(`/api/issues/${issueId}`);
      const data = await res.json();
      if (data.success && data.data) {
        console.log('CitizenDashboard: Fetched full issue details successfully:', data.data);
        setSelectedIssue(data.data);
      } else {
        console.error('CitizenDashboard: API responded with failure to load issue details:', data);
      }
    } catch (err) {
      console.error('CitizenDashboard: Failed to fetch issue details:', err);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files;
    setFiles(selected);
    if (selected) {
      const previews: string[] = [];
      for (let i = 0; i < Math.min(selected.length, 5); i++) {
        previews.push(URL.createObjectURL(selected[i]));
      }
      setFilePreviews(previews);
    } else {
      setFilePreviews([]);
    }
  };

  const handleMarkNotificationsRead = async () => {
    try {
      await fetch('/api/notifications/mark-all-read', {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };
  const myReports = issues.filter(i => {
    const reporterId = typeof i.reportedBy === 'object' && i.reportedBy !== null ? i.reportedBy._id : i.reportedBy;
    return reporterId === user._id;
  });
  const verifyQueue = pendingIssues;

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
              <h1 className="text-xl font-display font-black tracking-tight text-indigo-600 flex items-center gap-2">
                CivicPulse AI 
                <span className="text-[10px] text-indigo-600 font-bold px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 shadow-sm">
                  {user.role === 'volunteer' ? 'Volunteer Dashboard' : 'Citizen Dashboard'}
                </span>
              </h1>
            </div>
          </div>

          {/* Search and Profile */}
          <div className="flex items-center gap-5">
            <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-100 px-3.5 py-2 rounded-2xl w-72">
              <Search className="w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search issues, updates..." 
                className="bg-transparent text-xs text-slate-700 outline-none w-full placeholder-slate-400 font-medium"
              />
            </div>

            {/* Notifications bell */}
            <div className="relative cursor-pointer" onClick={() => setActiveTab('notifications')}>
              <Bell className="w-5 h-5 text-slate-450 hover:text-indigo-600 transition-colors" />
              {notifications.filter(n => !n.isRead).length > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-red-500 text-white font-bold text-[8px] rounded-full flex items-center justify-center shadow-sm">
                  {notifications.filter(n => !n.isRead).length}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 border-l border-slate-100 pl-4">
              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs flex items-center justify-center shadow-inner uppercase">
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
              onClick={() => { setActiveTab('my-reports'); setSelectedIssue(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${activeTab === 'my-reports' ? 'bg-indigo-50 border border-indigo-100/70 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              <FileText className="w-4 h-4" />
              My Reports ({myReports.length})
            </button>
            <button 
              onClick={() => { setActiveTab('report-issue'); setSelectedIssue(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${activeTab === 'report-issue' ? 'bg-indigo-50 border border-indigo-100/70 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              <PlusCircle className="w-4 h-4" />
              Report an Issue
            </button>
            <button 
              onClick={() => { setActiveTab('explore-issues'); setSelectedIssue(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${activeTab === 'explore-issues' ? 'bg-indigo-50 border border-indigo-100/70 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              <Compass className="w-4 h-4" />
              Explore Issues
            </button>
            <button 
              onClick={() => { setActiveTab('community-feed'); setSelectedIssue(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${activeTab === 'community-feed' ? 'bg-indigo-50 border border-indigo-100/70 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              <Sparkles className="w-4 h-4" />
              Community Feed
            </button>
            <button 
              onClick={() => { setActiveTab('verify-issues'); setSelectedIssue(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${activeTab === 'verify-issues' ? 'bg-indigo-50 border border-indigo-100/70 text-indigo-600' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
            >
              <CheckCircle className="w-4 h-4" />
              Verify Nearby ({verifyQueue.length})
            </button>
          </div>

          {/* Profile & Locality Summary Card */}
          <div className="bg-white border border-slate-100 rounded-[24px] p-6 shadow-sm space-y-5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <User className="w-4 h-4 text-indigo-600" />
              My Profile
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
              
              {citizenScore && (
                <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-slate-105 text-center">
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <p className="text-sm font-black text-indigo-600">{citizenScore.trustScore}%</p>
                    <p className="text-[8px] font-bold text-slate-450 uppercase tracking-wider mt-0.5">Trust</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <p className="text-sm font-black text-indigo-600">Lv {citizenScore.level}</p>
                    <p className="text-[8px] font-bold text-slate-455 uppercase tracking-wider mt-0.5">Rank</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <p className="text-sm font-black text-emerald-600">{citizenScore.contributionPoints}</p>
                    <p className="text-[8px] font-bold text-slate-450 uppercase tracking-wider mt-0.5">Points</p>
                  </div>
                </div>
              )}
              
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                  Resident Address
                </p>
                <p className="text-slate-750 text-xs font-semibold leading-relaxed">
                  {user.locality || 'Detected Locality'}, {user.ward}, {user.city}
                </p>
                {user.lat && user.lng && (
                  <p className="text-[9px] text-slate-400 font-bold bg-slate-50 p-1.5 rounded-lg border border-slate-100 inline-block">GPS: {user.lat.toFixed(5)}, {user.lng.toFixed(5)}</p>
                )}
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
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {selectedIssue ? (
            <IssueDetails 
              issueId={selectedIssue._id || selectedIssue} 
              user={user} 
              token={token} 
              onClose={() => setSelectedIssue(null)} 
              onSelectDuplicate={handleSelectIssue} 
            />
          ) : (
            <>
              {/* My Reports Tab */}
              {activeTab === 'my-reports' && (
                <div className="space-y-8">
                  {/* Premium SaaS Header & Statistics */}
                  <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <FileText className="w-6 h-6 text-indigo-600" />
                        My Reported Issues
                      </h2>
                      <p className="text-sm text-slate-500 font-medium mt-1">Track progress, AI metrics, and resolutions for your reported issues.</p>
                    </div>
                    <div className="flex flex-wrap gap-3.5">
                      <div className="px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-center min-w-[90px]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total</span>
                        <span className="text-lg font-black text-slate-800">{myReports.length}</span>
                      </div>
                      <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-100 rounded-2xl text-center min-w-[90px]">
                        <span className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest block">Resolved</span>
                        <span className="text-lg font-black text-emerald-700">
                          {myReports.filter(i => ['RESOLVED', 'CLOSED_RESOLVED'].includes(i.status)).length}
                        </span>
                      </div>
                      <div className="px-4 py-2.5 bg-indigo-50 border border-indigo-100 rounded-2xl text-center min-w-[90px]">
                        <span className="text-[10px] font-bold text-indigo-600/70 uppercase tracking-widest block">Active</span>
                        <span className="text-lg font-black text-indigo-700">
                          {myReports.filter(i => ['IN_PROGRESS', 'ASSIGNED_TO_AUTHORITY', 'OPEN_FOR_COMMUNITY_VERIFICATION'].includes(i.status)).length}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="w-full md:w-[90%] mx-auto">
                    {myReports.length === 0 ? (
                      <div className="bg-white border border-slate-100 rounded-3xl p-12 text-center shadow-sm">
                        <p className="text-slate-450 text-sm font-medium">You haven't reported any issues yet.</p>
                      </div>
                    ) : (
                      <div className="grid gap-8">
                        {myReports.map((issue) => (
                          <IssueCard
                            key={issue._id}
                            issue={issue}
                            onViewDetails={handleSelectIssue}
                            onVote={handleVote}
                            onUndoVote={handleUndoVote}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Submit Report Tab */}
              {activeTab === 'report-issue' && (
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm max-w-2xl mx-auto">
                  <h2 className="text-xl font-black text-slate-900 tracking-tight mb-2">Submit an Issue Report</h2>
                  <p className="text-xs text-slate-500 font-medium mb-6">Report civic incidents directly into the AI pipeline for verification and routing.</p>
                  
                  <form onSubmit={handleReportIssue} className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Issue Title</label>
                      <input 
                        type="text" 
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-slate-800 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                        placeholder="e.g., Pothole on Main St next to fire hydrant"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Description</label>
                      <textarea 
                        required
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-slate-800 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all"
                        placeholder="Please describe the issue in detail, including size, safety hazards, and any specific landmarks..."
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Category</label>
                        <select 
                          value={category} 
                          onChange={(e) => setCategory(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-slate-700 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
                        >
                          <option value="Road & Transport">Road & Transport</option>
                          <option value="Water & Sanitation">Water & Sanitation</option>
                          <option value="Waste Management">Waste Management</option>
                          <option value="Electrical & Lighting">Electrical & Lighting</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Upload Evidence (Images/Video)</label>
                        <div className="relative">
                          <input 
                            type="file" 
                            multiple
                            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime"
                            onChange={handleFileChange}
                            className="hidden" 
                            id="file-upload" 
                          />
                          <label 
                            htmlFor="file-upload" 
                            className="w-full bg-slate-50 border border-slate-200 border-dashed rounded-2xl py-3 px-4 text-slate-500 text-sm hover:border-indigo-500 transition-colors cursor-pointer flex items-center justify-center gap-2"
                          >
                            <Upload className="w-4 h-4 text-slate-400" />
                            {files ? `${files.length} file(s) selected — click to change` : 'Choose Photos / Videos'}
                          </label>
                        </div>
                        {filePreviews.length > 0 && (
                          <div className="grid grid-cols-5 gap-1.5 mt-2">
                            {filePreviews.map((src, i) => (
                              <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 shadow-sm">
                                <img src={src} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Latitude</label>
                        <input 
                          type="text" 
                          required
                          value={lat}
                          onChange={(e) => setLat(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-slate-800 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Longitude</label>
                        <input 
                          type="text" 
                          required
                          value={lng}
                          onChange={(e) => setLng(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-slate-800 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Address / Landmark</label>
                        <input 
                          type="text" 
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-3 px-4 text-slate-800 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white"
                          placeholder="e.g., Near City Library"
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="w-full py-3.5 rounded-2xl justify-center text-sm font-bold mt-4 shadow-md shadow-indigo-650/15 cursor-pointer text-white bg-indigo-600 hover:bg-indigo-500"
                    >
                      {loading ? 'Submitting Report...' : 'Submit Report'}
                    </Button>
                  </form>
                </div>
              )}

              {/* Verify Issues Tab */}
              {activeTab === 'verify-issues' && (
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm space-y-6">
                  <div>
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-indigo-600" />
                      Verify Nearby Civic Incidents
                    </h2>
                    <p className="text-xs text-slate-500 font-medium mt-1">Review reported problems in your residential locality to vouch for their authenticity.</p>
                  </div>
                  
                  {verifyQueue.length === 0 ? (
                    <p className="text-slate-400 text-sm font-medium py-12 text-center bg-slate-50 border border-slate-100 rounded-2xl">There are no pending issues in your area requiring community verification.</p>
                  ) : (
                    <div className="grid gap-6">
                      {verifyQueue.map((issue) => (
                        <div key={issue._id} className="bg-slate-50/50 border border-slate-100 p-6 rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:border-slate-200 transition-colors">
                          <div className="flex-1 min-w-0">
                            <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold text-[9px] uppercase rounded-full">
                              {issue.reportedCategory || 'Other'}
                            </span>
                            <h3 className="text-md font-bold text-slate-900 mt-2.5 truncate">{issue.title}</h3>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{issue.description}</p>
                            <p className="text-xs text-slate-500 mt-3.5 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-indigo-500" /> {issue.location?.address}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2.5 shrink-0">
                            <button 
                              onClick={() => handleVote(issue._id, 'EXISTS')}
                              className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-500/10 cursor-pointer"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" /> Exists
                            </button>
                            <button 
                              onClick={() => handleVote(issue._id, 'NOT_FOUND')}
                              className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-rose-500/10 cursor-pointer"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" /> Not Found
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Explore Issues Tab */}
              {activeTab === 'explore-issues' && (
                <ExploreIssues 
                  user={user} 
                  token={token} 
                  onViewDetails={handleSelectIssue} 
                  IssueCardComponent={IssueCard} 
                />
              )}

              {/* Community Feed Tab */}
              {activeTab === 'community-feed' && (
                <CommunityFeed 
                  user={user} 
                  token={token} 
                  onViewDetails={handleSelectIssue} 
                  IssueCardComponent={IssueCard} 
                />
              )}

              {/* Notifications Tab */}
              {activeTab === 'notifications' && (
                <div className="bg-white border border-slate-100 rounded-3xl p-8 shadow-sm max-w-xl mx-auto">
                  <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-3">
                    <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                      <Bell className="w-5 h-5 text-indigo-600" />
                      Notifications Inbox
                    </h2>
                    {notifications.some(n => !n.isRead) && (
                      <button onClick={handleMarkNotificationsRead} className="text-xs text-indigo-600 hover:text-indigo-500 font-bold transition-colors cursor-pointer">
                        Mark all as read
                      </button>
                    )}
                  </div>
                  
                  {notifications.length === 0 ? (
                    <p className="text-slate-405 text-sm font-medium py-8 text-center bg-slate-50 border border-slate-100 rounded-2xl">Your notifications inbox is empty.</p>
                  ) : (
                    <div className="space-y-3">
                      {notifications.map((n) => (
                        <div key={n._id} className={`p-4 rounded-2xl border text-sm flex items-start gap-3 transition-colors ${n.isRead ? 'bg-slate-50/50 border-slate-100 text-slate-450' : 'bg-indigo-50/30 border-indigo-100 text-slate-800'}`}>
                          <Bell className={`w-4 h-4 shrink-0 mt-0.5 ${n.isRead ? 'text-slate-400' : 'text-indigo-600'}`} />
                          <div>
                            <p className="font-bold text-xs text-slate-850">{n.title}</p>
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{n.message}</p>
                          </div>
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
