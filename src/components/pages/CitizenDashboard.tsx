import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/shared';
import MediaGallery, { type MediaItem } from '@/components/ui/MediaGallery';
import { connectSocket, getSocket } from '@/utils/socket';
import { 
  FileText, PlusCircle, CheckCircle, ThumbsUp, ThumbsDown, 
  MapPin, Bell, User, Clock, AlertTriangle, Eye, Upload, MessageSquare, Images,
  Compass, Search, Heart, Sparkles, Filter, ChevronLeft, ChevronRight
} from 'lucide-react';

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

    socket.on('NEW_ISSUE_CREATED', handleNewIssueCreated);
    socket.on('COMMUNITY_VOTE_ADDED', handleCommunityVoteAdded);
    socket.on('ISSUE_UPDATED', handleIssueUpdated);
    socket.on('ISSUE_ASSIGNED', handleIssueUpdated);
    socket.on('NOTIFICATION_RECEIVED', handleNotificationReceived);

    return () => {
      socket.off('NEW_ISSUE_CREATED', handleNewIssueCreated);
      socket.off('COMMUNITY_VOTE_ADDED', handleCommunityVoteAdded);
      socket.off('ISSUE_UPDATED', handleIssueUpdated);
      socket.off('ISSUE_ASSIGNED', handleIssueUpdated);
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
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-12">
      {/* Top Banner */}
      <header className="bg-slate-800 border-b border-slate-700/60 sticky top-0 z-40 backdrop-blur-md bg-opacity-90">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <span className="font-display font-black text-xl text-white">CP</span>
            </div>
            <div>
              <h1 className="text-xl font-display font-bold tracking-tight text-white">CivicPulse AI <span className="text-xs text-indigo-400 font-semibold px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-800/40">Citizen Dashboard</span></h1>
              <p className="text-xs text-slate-400 font-medium">Logged in as {user.name} ({user.role}) • {user.ward}, {user.city}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onLogout} className="text-xs text-slate-400 hover:text-white border border-slate-700">
              Log Out
            </Button>
          </div>
        </div>
      </header>
 
      <div className="max-w-7xl mx-auto px-6 mt-8 grid lg:grid-cols-12 gap-8">
        {/* Navigation Sidebar */}
        <aside className="lg:col-span-3 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <button 
              onClick={() => { setActiveTab('my-reports'); setSelectedIssue(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${activeTab === 'my-reports' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <FileText className="w-4 h-4" />
              My Reports ({myReports.length})
            </button>
            <button 
              onClick={() => { setActiveTab('report-issue'); setSelectedIssue(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${activeTab === 'report-issue' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <PlusCircle className="w-4 h-4" />
              Report an Issue
            </button>
            <button 
              onClick={() => { setActiveTab('explore-issues'); setSelectedIssue(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${activeTab === 'explore-issues' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Compass className="w-4 h-4" />
              Explore Issues
            </button>
            <button 
              onClick={() => { setActiveTab('community-feed'); setSelectedIssue(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${activeTab === 'community-feed' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <Sparkles className="w-4 h-4" />
              Community Feed
            </button>
            <button 
              onClick={() => { setActiveTab('verify-issues'); setSelectedIssue(null); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${activeTab === 'verify-issues' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <CheckCircle className="w-4 h-4" />
              Verify Nearby ({verifyQueue.length})
            </button>
            <button 
              onClick={() => { setActiveTab('notifications'); setSelectedIssue(null); }}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold transition-all duration-300 ${activeTab === 'notifications' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
            >
              <span className="flex items-center gap-3">
                <Bell className="w-4 h-4" />
                Notifications
              </span>
              {notifications.filter(n => !n.isRead).length > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white font-bold text-[10px] rounded-full">
                  {notifications.filter(n => !n.isRead).length}
                </span>
              )}
            </button>
          </div>
 
          {/* Profile & Locality Summary Card */}
          <div className="bg-slate-800/80 border border-slate-700/50 rounded-3xl p-5 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <User className="w-4 h-4 text-indigo-400" />
              My Profile
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
              {user.phone && (
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Phone Number</p>
                  <p className="font-medium text-slate-300">{user.phone}</p>
                </div>
              )}
              {citizenScore && (
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-700/50 text-center">
                  <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-700/30">
                    <p className="text-sm font-black text-white">{citizenScore.trustScore}%</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Trust</p>
                  </div>
                  <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-700/30">
                    <p className="text-sm font-black text-indigo-400">Lv {citizenScore.level}</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Rank</p>
                  </div>
                  <div className="bg-slate-900/50 p-2 rounded-xl border border-slate-700/30">
                    <p className="text-sm font-black text-emerald-400">{citizenScore.contributionPoints}</p>
                    <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Points</p>
                  </div>
                </div>
              )}
              <div className="pt-2 border-t border-slate-700/50 space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                  Resident Address
                </p>
                {user.street && <p className="text-slate-300 text-xs font-medium">{user.street}</p>}
                {user.locality && <p className="text-slate-300 text-xs font-medium">{user.locality}</p>}
                <p className="text-slate-300 text-xs font-medium">{user.ward}, {user.city}</p>
                {user.state && <p className="text-slate-300 text-xs font-medium">{user.state} {user.pincode ? ` - ${user.pincode}` : ''}</p>}
                {user.lat && user.lng && (
                  <p className="text-[10px] text-slate-500 font-bold">GPS: {user.lat.toFixed(5)}, {user.lng.toFixed(5)}</p>
                )}
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
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
 
          {selectedIssue ? (
            /* Selected Issue Details View */
            <div className="bg-slate-800 border border-slate-700/50 rounded-3xl p-8 shadow-xl">
              <div className="flex justify-between items-start gap-4 mb-6">
                <div>
                  <button onClick={() => setSelectedIssue(null)} className="text-xs text-slate-400 hover:text-white mb-2 block">← Back to List</button>
                  <h2 className="text-2xl font-display font-extrabold text-white">{selectedIssue.title}</h2>
                  <p className="text-xs text-slate-400 mt-1">Status: <span className="text-indigo-400 font-bold uppercase">{selectedIssue.status}</span> • Severity: <span className="text-red-400 font-bold">{selectedIssue.severity || 'PENDING'}</span></p>
                </div>
              </div>

              {selectedIssue.status === 'MERGED_WITH_EXISTING_ISSUE' && selectedIssue.duplicateOf && (
                <div className="mb-6 p-4 bg-amber-950/60 border border-amber-500/30 text-amber-300 text-sm rounded-2xl">
                  <p className="font-bold flex items-center gap-1.5 mb-1 text-xs uppercase tracking-wider">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Duplicate Issue Detected
                  </p>
                  <p className="text-xs leading-relaxed font-medium">
                    This report has been identified as a duplicate of an active issue nearby. 
                    It is merged with: <button onClick={() => handleSelectIssue(selectedIssue.duplicateOf)} className="underline hover:text-white font-bold">#{selectedIssue.duplicateOf?._id || selectedIssue.duplicateOf} - {selectedIssue.duplicateOf?.title || 'Master Issue'}</button> {selectedIssue.duplicateOf?.status && `(Status: ${selectedIssue.duplicateOf?.status})`}
                  </p>
                </div>
              )}
 
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Description</h4>
                  <p className="text-sm text-slate-300 leading-relaxed font-medium bg-slate-900/50 p-4 border border-slate-750 rounded-2xl">{selectedIssue.description}</p>

                  {/* Evidence Gallery from ImageKit */}
                  <div className="mt-6">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                      <Images className="w-4 h-4 text-indigo-400" />
                      Citizen Evidence ({issueMedia.length})
                    </h4>
                    {mediaLoading ? (
                      <div className="flex items-center justify-center py-6 text-slate-500 text-xs">Loading media...</div>
                    ) : (
                      <MediaGallery mediaItems={issueMedia} />
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-6 mb-2">Location</h4>
                  <p className="text-sm text-slate-300 leading-relaxed font-medium bg-slate-900/50 p-4 border border-slate-750 rounded-2xl flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-indigo-400 shrink-0" />
                    <span>{selectedIssue.location?.address || 'Geo coordinates only'} (Lat: {selectedIssue.location?.lat}, Lng: {selectedIssue.location?.lng})</span>
                  </p>

                  {selectedIssue.sla && (
                    <div className="mt-6 bg-slate-900/50 p-4 border border-slate-750 rounded-2xl">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Service Level Agreement (SLA)</h4>
                      <p className="text-sm font-semibold text-white">Target SLA: <span className="text-indigo-400 font-bold">{selectedIssue.sla.slaDays} Days</span></p>
                      <p className="text-xs text-slate-400 mt-1">Due Date: <span className="text-indigo-350 font-bold">{new Date(selectedIssue.sla.dueDate).toLocaleString()}</span> {selectedIssue.sla.overdueFlag && <span className="text-red-500 font-bold uppercase ml-2">[Overdue / Escalated]</span>}</p>
                    </div>
                  )}
                </div>
 
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Timeline History</h4>
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
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

              {selectedIssue.resolution && (
                <div className="mt-8 bg-slate-900/40 border border-slate-750 p-6 rounded-2xl">
                  <h3 className="text-md font-bold text-emerald-400 mb-4 flex items-center gap-2 border-b border-slate-700 pb-3">
                    <CheckCircle className="w-5 h-5" />
                    Official Resolution Report
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resolution Summary</p>
                      <p className="text-sm text-slate-200 mt-1 bg-slate-900/60 p-3 rounded-xl border border-slate-800 font-medium">{selectedIssue.resolution.workSummary}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {selectedIssue.resolution.contractorDetails && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contracting Partner</p>
                          <p className="text-xs text-slate-300 font-semibold mt-0.5">{selectedIssue.resolution.contractorDetails}</p>
                        </div>
                      )}
                      {selectedIssue.resolution.estimatedCost !== undefined && (
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estimated Cost</p>
                          <p className="text-xs text-slate-300 font-semibold mt-0.5">${selectedIssue.resolution.estimatedCost} USD</p>
                        </div>
                      )}
                    </div>

                    {/* Before & After Media — now served from ImageKit CDN */}
                    <div className="grid md:grid-cols-2 gap-6 pt-2">
                      {selectedIssue.resolution.beforeMedia && selectedIssue.resolution.beforeMedia.length > 0 && (
                        <div>
                          <MediaGallery
                            title="Before Work Evidence"
                            compact
                            mediaItems={selectedIssue.resolution.beforeMedia.map((url: string) => ({
                              url, thumbnailUrl: url, mediaType: 'image' as const
                            }))}
                          />
                        </div>
                      )}
                      {selectedIssue.resolution.afterMedia && selectedIssue.resolution.afterMedia.length > 0 && (
                        <div>
                          <MediaGallery
                            title="After Work Evidence"
                            compact
                            mediaItems={selectedIssue.resolution.afterMedia.map((url: string) => ({
                              url, thumbnailUrl: url, mediaType: 'image' as const
                            }))}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Citizen confirmation panel if pending */}
              {selectedIssue.status === 'PENDING_CITIZEN_CONFIRMATION' && (
                <div className="bg-indigo-950/40 border border-indigo-800/40 p-6 rounded-2xl mt-8">
                  <h4 className="text-md font-bold text-indigo-300 mb-2 flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Feedback Required: Confirm Resolution
                  </h4>
                  <p className="text-xs text-slate-300 mb-4">An officer has completed the work. Please confirm if this is resolved to your satisfaction.</p>
                  <textarea
                    rows={3}
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Enter any comments (optional)..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-indigo-500 mb-4"
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button onClick={() => handleFeedback(selectedIssue._id, 'RESOLVED')} disabled={loading} className="bg-emerald-600 hover:bg-emerald-500 text-xs font-bold py-2 px-4">
                      Yes, Confirm Resolved
                    </Button>
                    <Button onClick={() => handleFeedback(selectedIssue._id, 'STILL_UNRESOLVED')} disabled={loading} className="bg-red-600 hover:bg-red-500 text-xs font-bold py-2 px-4">
                      No, Mark as Unresolved
                    </Button>
                    <Button onClick={() => handleFeedback(selectedIssue._id, 'NEEDS_FOLLOWUP')} disabled={loading} className="bg-amber-600 hover:bg-amber-500 text-xs font-bold py-2 px-4">
                      Needs Follow-up
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {activeTab === 'my-reports' && (
                <div className="grid lg:grid-cols-12 gap-8">
                  {/* Left Column: My Reported Issues */}
                  <div className="lg:col-span-6 bg-slate-800 border border-slate-700/50 rounded-3xl p-6 shadow-xl space-y-6">
                    <h2 className="text-xl font-display font-extrabold text-white flex items-center gap-2">
                      <FileText className="w-5 h-5 text-indigo-400" />
                      My Reported Issues
                    </h2>
                    {myReports.length === 0 ? (
                      <p className="text-slate-400 text-sm font-medium py-8 text-center bg-slate-900/40 border border-slate-750/30 rounded-2xl">You haven't reported any issues yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {myReports.map((issue) => (
                          <div key={issue._id} className="bg-slate-900/60 border border-slate-700/50 p-5 rounded-2xl flex items-center justify-between gap-4 hover:border-indigo-500/50 transition-all duration-300">
                            <div className="min-w-0 flex-1">
                              <span className="px-2 py-0.5 bg-indigo-950 border border-indigo-800 text-indigo-300 font-bold text-[9px] uppercase rounded-full">{issue.reportedCategory || 'Other'}</span>
                              <h3 className="text-sm font-bold text-white mt-2 truncate">{issue.title}</h3>
                              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" /> <span className="truncate">{issue.location.address}</span>
                              </p>
                              <p className="text-[10px] text-slate-500 mt-1 font-semibold flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(issue.createdAt).toLocaleDateString()}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-[10px] font-bold text-indigo-400 bg-indigo-950/80 px-2.5 py-1.5 rounded-xl border border-indigo-800/40 uppercase">{issue.status}</span>
                              <button onClick={() => handleSelectIssue(issue)} className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors">
                                <Eye className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Recent Community Issues / Locality Feed */}
                  <div className="lg:col-span-6 bg-slate-800 border border-slate-700/50 rounded-3xl p-6 shadow-xl space-y-6">
                    <h2 className="text-xl font-display font-extrabold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                      Recent Community Issues
                    </h2>
                    {recentCommunityIssues.length === 0 ? (
                      <p className="text-slate-400 text-sm font-medium py-8 text-center bg-slate-900/40 border border-slate-750/30 rounded-2xl">No recent community issues found.</p>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-4">
                        {recentCommunityIssues.slice(0, 4).map((issue) => {
                          const thumbnail = issue.thumbnail || 'https://images.unsplash.com/photo-1594818821900-5807a69966ec?auto=format&fit=crop&w=400&q=80';
                          return (
                            <div key={issue._id} className="bg-slate-900/60 border border-slate-700/50 p-4 rounded-2xl flex flex-col justify-between hover:border-slate-600 transition-all duration-300">
                              <div>
                                <div className="aspect-video w-full rounded-xl overflow-hidden mb-3 border border-slate-800 bg-slate-950">
                                  <img src={thumbnail} alt={issue.title} className="w-full h-full object-cover" />
                                </div>
                                <span className="px-1.5 py-0.5 bg-indigo-950 border border-indigo-800 text-indigo-300 font-bold text-[8px] uppercase rounded-md">{issue.category || 'Other'}</span>
                                <h3 className="text-xs font-black text-white mt-1.5 line-clamp-1">{issue.title}</h3>
                                <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{issue.description}</p>
                              </div>
                              
                              <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-500 font-medium">
                                <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-rose-500" /> {issue.supporterCount || 0}</span>
                                <button 
                                  onClick={() => handleSelectIssue({ _id: issue.issueId, ...issue, status: issue.status || 'SUBMITTED' })}
                                  className="text-indigo-400 hover:underline font-bold"
                                >
                                  View Details
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}


              {activeTab === 'report-issue' && (
                <div className="bg-slate-800 border border-slate-700/50 rounded-3xl p-8 shadow-xl">
                  <h2 className="text-2xl font-display font-extrabold text-white mb-6">Submit an Issue Report</h2>
                  <form onSubmit={handleReportIssue} className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Issue Title</label>
                      <input 
                        type="text" 
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3 px-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
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
                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3 px-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                        placeholder="Please describe the issue in detail, including size, safety hazards, and any specific landmarks..."
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Category</label>
                        <select 
                          value={category} 
                          onChange={(e) => setCategory(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3 px-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
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
                              className="w-full bg-slate-900 border border-slate-700 border-dashed rounded-2xl py-3 px-4 text-slate-400 text-sm hover:border-indigo-500 transition-colors cursor-pointer flex items-center justify-center gap-2"
                            >
                              <Upload className="w-4 h-4 text-slate-500" />
                              {files ? `${files.length} file(s) selected — click to change` : 'Choose Photos / Videos'}
                            </label>
                          </div>
                          {/* File previews */}
                          {filePreviews.length > 0 && (
                            <div className="grid grid-cols-5 gap-1.5 mt-2">
                              {filePreviews.map((src, i) => (
                                <div key={i} className="relative aspect-square overflow-hidden rounded-xl border border-slate-700">
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
                          className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3 px-4 text-white text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Longitude</label>
                        <input 
                          type="text" 
                          required
                          value={lng}
                          onChange={(e) => setLng(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3 px-4 text-white text-sm focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Address / Landmark</label>
                        <input 
                          type="text" 
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-3 px-4 text-white text-sm focus:outline-none"
                          placeholder="e.g., Near City Library"
                        />
                      </div>
                    </div>

                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="w-full py-3.5 rounded-2xl justify-center text-sm font-semibold mt-4 shadow-lg shadow-indigo-600/35"
                    >
                      {loading ? 'Submitting Report...' : 'Report Issue'}
                    </Button>
                  </form>
                </div>
              )}

              {activeTab === 'verify-issues' && (
                <div className="bg-slate-800 border border-slate-700/50 rounded-3xl p-6 shadow-xl">
                  <h2 className="text-2xl font-display font-extrabold text-white mb-6">Verify Issues Near You</h2>
                  {verifyQueue.length === 0 ? (
                    <p className="text-slate-400 text-sm font-medium py-8 text-center">There are no pending issues in your area requiring community verification.</p>
                  ) : (
                    <div className="space-y-4">
                      {verifyQueue.map((issue) => (
                        <div key={issue._id} className="bg-slate-900/60 border border-slate-700/50 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                          <div className="flex-1">
                            <span className="px-2 py-0.5 bg-indigo-900/50 border border-indigo-700 text-indigo-300 font-bold text-[9px] uppercase rounded-full">{issue.reportedCategory || 'Other'}</span>
                            <h3 className="text-md font-bold text-white mt-2">{issue.title}</h3>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">{issue.description}</p>
                            <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-500" /> {issue.location.address}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <button 
                              onClick={() => handleVote(issue._id, 'EXISTS')}
                              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-bold transition-colors"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" /> Exists
                            </button>
                            <button 
                              onClick={() => handleVote(issue._id, 'NOT_FOUND')}
                              className="flex items-center gap-2 px-3 py-2 bg-red-650 hover:bg-red-500 rounded-xl text-xs font-bold transition-colors"
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

              {activeTab === 'explore-issues' && (
                <div className="bg-slate-800 border border-slate-700/50 rounded-3xl p-8 shadow-xl space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-display font-extrabold text-white flex items-center gap-2">
                        <Compass className="w-6 h-6 text-indigo-400" />
                        Explore Community Issues
                      </h2>
                      <p className="text-xs text-slate-400 font-medium">Browse, search, and filter all public master issues across the platform.</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sort By</label>
                      <select 
                        value={sortBy} 
                        onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
                        className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="newest">Newest First</option>
                        <option value="priority">Priority Score</option>
                        <option value="supporters">Most Supported</option>
                      </select>
                    </div>
                  </div>

                  {/* Filters Panel */}
                  <div className="bg-slate-900/40 border border-slate-750 p-6 rounded-2xl space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-2.5">
                      <Filter className="w-4 h-4 text-indigo-400" />
                      Search & Filter Controls
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Search */}
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Search className="w-3.5 h-3.5 text-slate-500" />
                        </span>
                        <input 
                          type="text" 
                          placeholder="Search title/address..."
                          value={searchQuery}
                          onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                          className="w-full bg-slate-900 border border-slate-700 pl-9 pr-3 py-2 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* Category */}
                      <select 
                        value={filterCategory} 
                        onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
                        className="bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="">All Categories</option>
                        <option value="Road & Transport">Road & Transport</option>
                        <option value="Water & Sanitation">Water & Sanitation</option>
                        <option value="Waste Management">Waste Management</option>
                        <option value="Electrical & Lighting">Electrical & Lighting</option>
                        <option value="Other">Other</option>
                      </select>

                      {/* Status */}
                      <select 
                        value={filterStatus} 
                        onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                        className="bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="">All Statuses</option>
                        <option value="Open">Open</option>
                        <option value="Assigned">Assigned</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>

                      {/* Date */}
                      <select 
                        value={filterDate} 
                        onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
                        className="bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 cursor-pointer"
                      >
                        <option value="">All Dates</option>
                        <option value="today">Reported Today</option>
                        <option value="week">Past Week</option>
                        <option value="month">Past Month</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 pt-2">
                      <input 
                        type="text" 
                        placeholder="Ward..."
                        value={filterWard}
                        onChange={(e) => { setFilterWard(e.target.value); setPage(1); }}
                        className="bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500"
                      />
                      <input 
                        type="text" 
                        placeholder="City..."
                        value={filterCity}
                        onChange={(e) => { setFilterCity(e.target.value); setPage(1); }}
                        className="bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500"
                      />
                      <input 
                        type="text" 
                        placeholder="District..."
                        value={filterDistrict}
                        onChange={(e) => { setFilterDistrict(e.target.value); setPage(1); }}
                        className="bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500"
                      />
                      <input 
                        type="text" 
                        placeholder="Taluk..."
                        value={filterTaluk}
                        onChange={(e) => { setFilterTaluk(e.target.value); setPage(1); }}
                        className="bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500"
                      />
                      
                      {/* Distance Proximity */}
                      <select 
                        value={filterDistance} 
                        onChange={(e) => { setFilterDistance(e.target.value); setPage(1); }}
                        disabled={!user.lat || !user.lng}
                        className="bg-slate-900 border border-slate-700 px-3 py-2 text-xs text-white rounded-xl focus:outline-none focus:border-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <option value="">Any Distance</option>
                        <option value="1">Within 1 km</option>
                        <option value="5">Within 5 km</option>
                        <option value="10">Within 10 km</option>
                        <option value="20">Within 20 km</option>
                      </select>
                    </div>
                  </div>

                  {/* Explore Grid */}
                  {exploreIssuesList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
                      <AlertTriangle className="w-8 h-8 opacity-40" />
                      <p className="text-sm font-medium">No community issues match your filters.</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
                        {exploreIssuesList.map((issue) => {
                          const thumbnail = issue.thumbnail || 'https://images.unsplash.com/photo-1594818821900-5807a69966ec?auto=format&fit=crop&w=400&q=80';
                          return (
                            <div key={issue._id} className="bg-slate-900/60 border border-slate-700/50 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-500 transition-all duration-300 group">
                              <div className="space-y-3">
                                <div className="aspect-video w-full rounded-xl overflow-hidden mb-3 border border-slate-800 bg-slate-950 relative">
                                  <img src={thumbnail} alt={issue.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                  <span className="absolute top-2 right-2 px-2 py-0.5 bg-indigo-950/80 border border-indigo-800/40 text-[8px] font-bold text-indigo-400 uppercase rounded-md tracking-wider">
                                    Priority: {issue.priorityScore || 0}
                                  </span>
                                </div>
                                <span className="px-2 py-0.5 bg-indigo-900/40 border border-indigo-800/40 text-indigo-300 font-bold text-[8px] uppercase rounded-full tracking-wider">{issue.category || 'Other'}</span>
                                <h3 className="text-sm font-black text-white mt-2 group-hover:text-indigo-400 transition-colors line-clamp-1">{issue.title}</h3>
                                <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{issue.description}</p>
                                
                                <div className="text-[10px] text-slate-500 space-y-1 pt-1.5">
                                  <p className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-500" /> <span className="truncate">{issue.location?.address}</span></p>
                                  {issue.location?.ward && <p className="text-[9px] text-slate-500">Locality: {issue.location.ward}, {issue.location.city}</p>}
                                </div>
                              </div>

                              <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => handleSupportIssue(issue._id)}
                                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700/80 hover:text-rose-400 text-slate-400 rounded-lg text-[10px] font-bold transition-all"
                                  >
                                    <Heart className="w-3 h-3 text-rose-500 fill-current" />
                                    <span>{issue.supporterCount || 0}</span>
                                  </button>
                                  <span className="text-[10px] text-slate-500 font-semibold px-2 py-1 bg-slate-850/50 rounded-lg">
                                    Votes: {issue.verificationCount || 0}
                                  </span>
                                </div>
                                <button 
                                  onClick={() => handleSelectIssue({ _id: issue.issueId, ...issue, status: issue.status || 'SUBMITTED' })}
                                  className="text-xs text-indigo-400 hover:underline font-bold"
                                >
                                  View Details
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Pagination Controls */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-4 pt-6 border-t border-slate-800/60">
                          <button 
                            disabled={page === 1}
                            onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                            className="p-2 bg-slate-700/50 hover:bg-slate-700 rounded-xl text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </button>
                          <span className="text-xs text-slate-400 font-semibold">Page {page} of {totalPages}</span>
                          <button 
                            disabled={page === totalPages}
                            onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                            className="p-2 bg-slate-700/50 hover:bg-slate-700 rounded-xl text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {activeTab === 'community-feed' && (
                <div className="bg-slate-800 border border-slate-700/50 rounded-3xl p-8 shadow-xl space-y-6">
                  <div>
                    <h2 className="text-2xl font-display font-extrabold text-white flex items-center gap-2">
                      <Sparkles className="w-6 h-6 text-indigo-400" />
                      Live Community Feed
                    </h2>
                    <p className="text-xs text-slate-400 font-medium">See live updates on trending, newest, and resolved civic issues across the system.</p>
                  </div>

                  {/* Sub tabs */}
                  <div className="flex gap-2 border-b border-slate-800 pb-3">
                    {[
                      { type: 'newest' as const, label: 'Newest Issues' },
                      { type: 'trending' as const, label: 'Trending / Popular' },
                      { type: 'resolved' as const, label: 'Recently Resolved' }
                    ].map((tab) => (
                      <button
                        key={tab.type}
                        onClick={() => setCommunityFeedType(tab.type)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${communityFeedType === tab.type ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-650/20' : 'text-slate-400 hover:bg-slate-900/50 hover:text-white'}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Community Grid */}
                  {communityIssuesList.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
                      <AlertTriangle className="w-8 h-8 opacity-40" />
                      <p className="text-sm font-medium">No issues found in this feed category.</p>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
                      {communityIssuesList.map((issue) => {
                        const thumbnail = issue.thumbnail || 'https://images.unsplash.com/photo-1594818821900-5807a69966ec?auto=format&fit=crop&w=400&q=80';
                        return (
                          <div key={issue._id} className="bg-slate-900/60 border border-slate-700/50 p-5 rounded-2xl flex flex-col justify-between hover:border-slate-500 transition-all duration-300 group">
                            <div className="space-y-3">
                              <div className="aspect-video w-full rounded-xl overflow-hidden mb-3 border border-slate-800 bg-slate-950 relative">
                                <img src={thumbnail} alt={issue.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                <span className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/70 text-[8px] font-bold text-white uppercase rounded-md">
                                  {issue.status || 'Open'}
                                </span>
                              </div>
                              <span className="px-2 py-0.5 bg-indigo-900/40 border border-indigo-800/40 text-indigo-300 font-bold text-[8px] uppercase rounded-full tracking-wider">{issue.category || 'Other'}</span>
                              <h3 className="text-sm font-black text-white mt-2 group-hover:text-indigo-400 transition-colors line-clamp-1">{issue.title}</h3>
                              <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{issue.description}</p>
                              
                              <div className="text-[10px] text-slate-500 space-y-1 pt-1.5">
                                <p className="flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-500" /> <span className="truncate">{issue.location?.address}</span></p>
                              </div>
                            </div>

                            <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                              <button 
                                onClick={() => handleSupportIssue(issue._id)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-350 hover:text-rose-400 rounded-xl text-[10px] font-bold transition-all border border-slate-800"
                              >
                                <Heart className="w-3 h-3 text-rose-500 fill-current" />
                                <span>{issue.supporterCount || 0}</span>
                              </button>
                              <button 
                                onClick={() => handleSelectIssue({ _id: issue.issueId, ...issue, status: issue.status || 'SUBMITTED' })}
                                className="px-3 py-1.5 bg-indigo-650/80 hover:bg-indigo-600 text-white rounded-xl text-[10px] font-bold transition-colors"
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'notifications' && (
                <div className="bg-slate-800 border border-slate-700/50 rounded-3xl p-6 shadow-xl">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-display font-extrabold text-white">Notifications Inbox</h2>
                    {notifications.some(n => !n.isRead) && (
                      <button onClick={handleMarkNotificationsRead} className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                        Mark all as read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-slate-400 text-sm font-medium py-8 text-center">Your notifications inbox is empty.</p>
                  ) : (
                    <div className="space-y-3">
                      {notifications.map((n) => (
                        <div key={n._id} className={`p-4 rounded-2xl border text-sm flex items-start gap-3 transition-colors ${n.isRead ? 'bg-slate-900/30 border-slate-750/50 text-slate-400' : 'bg-slate-900/70 border-slate-700 text-slate-200'}`}>
                          <Bell className={`w-4 h-4 shrink-0 mt-0.5 ${n.isRead ? 'text-slate-650' : 'text-indigo-400'}`} />
                          <div>
                            <p className="font-bold text-xs text-white">{n.title}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{n.message}</p>
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
