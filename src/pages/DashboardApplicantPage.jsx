import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import { WelcomeIcon, CalendarIcon, MyApplicationsIcon } from "../components/icons/CustomIcons";


export default function DashboardApplicant() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    shortlisted: 0,
    hired: 0
  });
  const [recentApplications, setRecentApplications] = useState([]);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [todayDate, setTodayDate] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // Set user name
      const metadata = user.user_metadata || {};
      const firstName = metadata.first_name || "";
      const surname = metadata.surname || "";
      setUserName(firstName && surname ? `${firstName} ${surname}` : user.email || "User");

      // Set today's date
      const today = new Date();
      setTodayDate(today.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }));

      await loadStats(user.id);
      await loadRecentApplications(user.id);
      await loadRecentNotifications(user.id);
      setLoading(false);
    };

    loadDashboard();
  }, [navigate]);

  const loadStats = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('status')
        .eq('applicant_id', userId)
        .neq('status', 'WITHDRAWN');

      if (error) throw error;

      const total = data.length;
      const pending = data.filter(a => a.status === 'PENDING' || a.status === 'REVIEWING').length;
      const shortlisted = data.filter(a => a.status === 'SHORTLISTED' || a.status === 'INTERVIEW' || a.status === 'FOR_INTERVIEW' || a.status === 'INTERVIEW_SCHEDULED' || a.status === 'QUALIFIED').length;
      const hired = data.filter(a => a.status === 'HIRED').length;

      setStats({ total, pending, shortlisted, hired });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadRecentApplications = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
          job_postings (
            position_title,
            place_of_assignment,
            salary_grade
          )
        `)
        .eq('applicant_id', userId)
        .neq('status', 'WITHDRAWN')
        .order('applied_date', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentApplications(data || []);
    } catch (error) {
      console.error('Error loading recent applications:', error);
    }
  };

  const loadRecentNotifications = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'PENDING': { bg: '#FFF3E0', color: '#E65100', text: 'Pending Review' },
      'REVIEWING': { bg: '#E3F2FD', color: '#1565C0', text: 'Under Review' },
      'QUALIFIED': { bg: '#E8F5E9', color: '#2E7D32', text: 'Qualified' },
      'SHORTLISTED': { bg: '#E8F5E9', color: '#2E7D32', text: 'Shortlisted' },
      'FOR_INTERVIEW': { bg: '#F3E5F5', color: '#7B1FA2', text: 'For Interview' },
      'INTERVIEW_SCHEDULED': { bg: '#F3E5F5', color: '#7B1FA2', text: 'Interview Scheduled' },
      'INTERVIEW': { bg: '#F3E5F5', color: '#7B1FA2', text: 'Interview Scheduled' },
      'HIRED': { bg: '#E8F5E9', color: '#1B5E20', text: 'Hired' },
      'NOT_SELECTED': { bg: '#FFEBEE', color: '#C62828', text: 'Not Selected' },
      'REJECTED': { bg: '#FFEBEE', color: '#C62828', text: 'Rejected' },
      'WITHDRAWN': { bg: '#F3E5F5', color: '#6A1B9A', text: 'Withdrawn' }
    };
    return colors[status] || colors['PENDING'];
  };

  const getScoreColor = (score) => {
    if (!score) return "#6c757d";
    if (score >= 80) return "#2e7d32";
    if (score >= 60) return "#e65100";
    return "#c62828";
  };

  const getScoreBg = (score) => {
    if (!score) return "#f5f5f5";
    if (score >= 80) return "#e8f5e9";
    if (score >= 60) return "#fff3e0";
    return "#ffebee";
  };

  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (timestamp) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const styles = `
    .dashboard-container {
      padding-top: 80px;
      padding-left: 24px;
      padding-right: 24px;
      background: #f5f6f8;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .dashboard-header {
      margin-bottom: 24px;
    }

    .dashboard-header h1 {
      margin: 0;
      font-size: 28px;
      color: #1a1f36;
    }

    .dashboard-header .subtitle {
      color: #6c757d;
      margin-top: 4px;
      font-size: 14px;
    }

    .dashboard-header .date-display {
      color: #000000;
      font-size: 24px;
      margin-top: 4px;
    }
      

    .stats-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      transition: all 0.3s;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .stat-number {
      font-size: 32px;
      font-weight: bold;
      color: #1a1f36;
      display: block;
    }

    .stat-label {
      font-size: 13px;
      color: #6c757d;
      margin-top: 4px;
    }

    .stat-icon {
      font-size: 24px;
      margin-bottom: 8px;
      display: block;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    .dashboard-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      overflow: hidden;
    }

    .card-header {
      padding: 16px 20px;
      border-bottom: 1px solid #e9ecef;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .card-header h3 {
      margin: 0;
      font-size: 16px;
      color: #1a1f36;
    }

    .card-header .view-all {
      font-size: 13px;
      color: #4f46e5;
      cursor: pointer;
      text-decoration: none;
    }

    .card-header .view-all:hover {
      text-decoration: underline;
    }

    .card-body {
      padding: 16px 20px;
    }

    .application-item {
      padding: 12px 0;
      border-bottom: 1px solid #f0f0f0;
      cursor: pointer;
      transition: all 0.2s;
    }

    .application-item:last-child {
      border-bottom: none;
    }

    .application-item:hover {
      background: #f8f9fa;
      margin: 0 -20px;
      padding-left: 20px;
      padding-right: 20px;
      border-radius: 6px;
    }

    .app-item-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 4px;
    }

    .app-item-title {
      font-weight: 500;
      color: #1a1f36;
      font-size: 14px;
    }

    .app-item-location {
      font-size: 12px;
      color: #6c757d;
    }

    .app-item-details {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #6c757d;
      flex-wrap: wrap;
      margin-top: 4px;
    }

    .app-item-status {
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      display: inline-block;
    }

    .app-item-score {
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      display: inline-block;
    }

    .notification-item {
      padding: 10px 0;
      border-bottom: 1px solid #f0f0f0;
    }

    .notification-item:last-child {
      border-bottom: none;
    }

    .notification-item.unread {
      border-left: 3px solid #4f46e5;
      padding-left: 12px;
    }

    .notification-message {
      font-size: 13px;
      color: #1a1f36;
    }

    .notification-time {
      font-size: 11px;
      color: #adb5bd;
      margin-top: 4px;
    }

    .empty-state {
      text-align: center;
      padding: 30px 0;
      color: #6c757d;
      font-size: 14px;
    }

    .empty-state .icon {
      font-size: 32px;
      margin-bottom: 8px;
      display: block;
    }

    .loading-state {
      text-align: center;
      padding: 60px;
      color: #6c757d;
    }

    @media (max-width: 768px) {
      .dashboard-container { padding: 16px; padding-top: 80px; }
      .stats-cards { grid-template-columns: repeat(2, 1fr); }
      .dashboard-grid { grid-template-columns: 1fr; }
    }
  `;

  if (loading) {
    return (
      <>
        <Navbar userRole="applicant" />
        <div className="dashboard-container">
          <style>{styles}</style>
          <div className="loading-state">Loading dashboard...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar userRole="applicant" />
      <div className="dashboard-container">
        <style>{styles}</style>

       <div className="dashboard-header">
  <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
    <WelcomeIcon size={40} /> 
    Welcome back, {userName}
  </h1>
  <div className="date-display">
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
    <CalendarIcon size={40} />
    {todayDate}
  </span>
</div>
</div>

        <div className="stats-cards">
          <div className="stat-card">
            <span className="stat-icon">📋</span>
            <span className="stat-number">{stats.total}</span>
            <span className="stat-label">Total Applications</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon">⏳</span>
            <span className="stat-number">{stats.pending}</span>
            <span className="stat-label">Pending Review</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon">✅</span>
            <span className="stat-number">{stats.shortlisted}</span>
            <span className="stat-label">Shortlisted / Interview</span>
          </div>
          <div className="stat-card">
            <span className="stat-icon">🎉</span>
            <span className="stat-number">{stats.hired}</span>
            <span className="stat-label">Offers Received</span>
          </div>
        </div>

        <div className="dashboard-grid">
          {/* Recent Applications */}
          <div className="dashboard-card">
            <div className="card-header">
              <h3>📌 Recent Applications</h3>
              <span className="view-all" onClick={() => navigate('/applicant/applications')}>
                View All →
              </span>
            </div>
            <div className="card-body">
              {recentApplications.length === 0 ? (
                <div className="empty-state">
                  <span className="icon">📭</span>
                  No applications yet. Start browsing jobs!
                </div>
              ) : (
                recentApplications.map((app) => {
                  const job = app.job_postings || {};
                  const statusStyle = getStatusColor(app.status);
                  const score = app.ai_match_score || 0;

                  return (
                    <div 
                      key={app.id} 
                      className="application-item"
                      onClick={() => navigate('/applicant/applications')}
                    >
                      <div className="app-item-header">
                        <div>
                          <div className="app-item-title">{job.position_title || 'Position Not Found'}</div>
                          <div className="app-item-location">📍 {job.place_of_assignment || 'N/A'}</div>
                        </div>
                        <span 
                          className="app-item-status"
                          style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}
                        >
                          {statusStyle.text}
                        </span>
                      </div>
                      <div className="app-item-details">
                        <span>📅 {formatDate(app.applied_date)}</span>
                        <span>💰 SG {job.salary_grade || 'N/A'}</span>
                        {score > 0 && (
                          <span 
                            className="app-item-score"
                            style={{ background: getScoreBg(score), color: getScoreColor(score) }}
                          >
                            Score: {score}%
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Notifications */}
          <div className="dashboard-card">
            <div className="card-header">
              <h3>🔔 Recent Notifications</h3>
              <span className="view-all" onClick={() => navigate('/applicant/applications')}>
                View All →
              </span>
            </div>
            <div className="card-body">
              {recentNotifications.length === 0 ? (
                <div className="empty-state">
                  <span className="icon">🔕</span>
                  No notifications yet
                </div>
              ) : (
                recentNotifications.map((notification) => (
                  <div 
                    key={notification.id} 
                    className={`notification-item ${!notification.is_read ? 'unread' : ''}`}
                  >
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">{formatTime(notification.created_at)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}