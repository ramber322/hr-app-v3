import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import "../styles/DashboardPage.css";
import { WelcomeIcon, CalendarIcon, MyApplicationsIcon } from "../components/icons/CustomIcons";

// Chart.js imports
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalJobs: 0,
    totalApplicants: 0,
    totalHired: 0,
    openJobs: 0,
  });
  const [applicantsByStatus, setApplicantsByStatus] = useState({});
  const [recentActivity, setRecentActivity] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDays, setCalendarDays] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      // 1. Fetch all jobs
      const { data: jobs, error: jobsError } = await supabase
        .from('job_postings')
        .select('*');

      if (jobsError) throw jobsError;

      const totalJobs = jobs.length;
      const openJobs = jobs.filter(j => j.status === 'OPEN').length;

      // 2. Fetch all applications (non-withdrawn)
      const { data: applications, error: appsError } = await supabase
        .from('applications')
        .select('*, job_postings(position_title)')
        .neq('status', 'WITHDRAWN');

      if (appsError) throw appsError;

      const totalApplicants = applications.length;
      const hired = applications.filter(a => a.status === 'HIRED').length;

      // 3. Status breakdown - Grouped into 4 categories
      const statusGroups = {
        'Pending': 0,
        'Under Review': 0,
        'Shortlisted': 0,
        'Rejected': 0,
      };

      applications.forEach(app => {
        const status = app.status;
        if (status === 'PENDING') {
          statusGroups['Pending']++;
        } else if (status === 'REVIEWING') {
          statusGroups['Under Review']++;
        } else if (['QUALIFIED', 'SHORTLISTED', 'FOR_INTERVIEW', 'INTERVIEW_SCHEDULED', 'HIRED'].includes(status)) {
          statusGroups['Shortlisted']++;
        } else if (['NOT_SELECTED', 'REJECTED'].includes(status)) {
          statusGroups['Rejected']++;
        }
      });

      setApplicantsByStatus(statusGroups);

      setStats({
        totalJobs,
        totalApplicants,
        totalHired: hired,
        openJobs,
      });

      // 4. Recent activity (last 10)
      const sortedApps = [...applications].sort((a, b) => 
        new Date(b.applied_date) - new Date(a.applied_date)
      ).slice(0, 10);

      const activity = sortedApps.map(app => ({
        id: app.id,
        type: 'application',
        message: `New application received for ${app.job_postings?.position_title || 'a position'}`,
        time: app.applied_date,
        link: `/hr/jobs/${app.job_id}/candidates`
      }));
      setRecentActivity(activity);

      // 5. Build calendar
      buildCalendar(currentMonth);

    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildCalendar = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    const days = [];
    
    // Previous month days
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({
        day: daysInPrevMonth - i,
        isCurrentMonth: false,
      });
    }
    
    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
      });
    }
    
    // Next month days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
      });
    }
    
    setCalendarDays(days);
  };

  const changeMonth = (offset) => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + offset);
    setCurrentMonth(newMonth);
    buildCalendar(newMonth);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (weeks < 4) return `${weeks}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Chart data - Hiring Trends
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const trendsData = {
    labels: months,
    datasets: [
      {
        label: 'Applied',
        data: [65, 78, 90, 85, 95, 110, 105, 120, 115, 130, 125, 140],
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#4f46e5',
      },
      {
        label: 'Hired',
        data: [12, 15, 18, 20, 22, 25, 28, 30, 32, 35, 38, 40],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#10b981',
      },
      {
        label: 'Rejected',
        data: [20, 25, 30, 28, 32, 35, 30, 40, 38, 42, 45, 48],
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 3,
        pointBackgroundColor: '#ef4444',
      },
    ],
  };

  const trendsOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: 'white',
        titleColor: '#1a1f36',
        bodyColor: '#4a5568',
        borderColor: '#e9ecef',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0,0,0,0.05)',
        },
        ticks: {
          font: {
            size: 11,
          },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
          },
        },
      },
    },
  };

  // Status colors
  const statusColors = {
    'Pending': { bg: '#FFF3E0', color: '#E65100', barColor: '#FF9800' },
    'Under Review': { bg: '#E3F2FD', color: '#1565C0', barColor: '#2196F3' },
    'Shortlisted': { bg: '#E8F5E9', color: '#2E7D32', barColor: '#4CAF50' },
    'Rejected': { bg: '#FFEBEE', color: '#C62828', barColor: '#F44336' },
  };

  // Stats cards data
  const statCards = [
    {
      title: 'Total Jobs',
      value: stats.totalJobs,
      change: '+1.4%',
      icon: '💼',
      color: '#4f46e5',
      bgColor: '#eef2ff',
    },
    {
      title: 'Total Applications',
      value: stats.totalApplicants,
      change: '+2.4%',
      icon: '👥',
      color: '#10b981',
      bgColor: '#ecfdf5',
    },
    {
      title: 'Total Hired',
      value: stats.totalHired,
      change: '+1.2%',
      icon: '🎉',
      color: '#f59e0b',
      bgColor: '#fffbeb',
    },
    {
      title: 'Open Jobs',
      value: stats.openJobs,
      change: '-0.8%',
      icon: '📌',
      color: '#ef4444',
      bgColor: '#fef2f2',
    },
  ];

  // Month name for calendar
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  const styles = `
    .hr-dashboard {
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

    .dashboard-header p {
      color: #6c757d;
      margin-top: 4px;
      font-size: 14px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      transition: all 0.3s;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .stat-card .stat-icon {
      font-size: 20px;
      margin-bottom: 8px;
      display: block;
    }

    .stat-card .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: #1a1f36;
      display: block;
    }

    .stat-card .stat-title {
      font-size: 13px;
      color: #6c757d;
      display: block;
      margin-top: 4px;
    }

    .stat-card .stat-change {
      font-size: 12px;
      font-weight: 500;
      display: inline-block;
      margin-top: 8px;
      padding: 2px 10px;
      border-radius: 12px;
    }

    .stat-change.positive {
      color: #10b981;
      background: #ecfdf5;
    }

    .stat-change.negative {
      color: #ef4444;
      background: #fef2f2;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }

    .dashboard-card {
      background: white;
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      overflow: hidden;
    }

    .dashboard-card .card-header {
      padding: 16px 20px;
      border-bottom: 1px solid #e9ecef;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .dashboard-card .card-header h3 {
      margin: 0;
      font-size: 16px;
      color: #1a1f36;
      font-weight: 600;
    }

    .dashboard-card .card-body {
      padding: 20px;
    }

    .chart-container {
      height: 280px;
      position: relative;
    }

    /* Status Breakdown List */
    .status-list {
      padding: 4px 0;
    }

    .status-item {
      margin-bottom: 16px;
    }

    .status-item:last-child {
      margin-bottom: 0;
    }

    .status-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .status-item-label {
      font-size: 13px;
      color: #1a1f36;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-item-label .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      display: inline-block;
    }

    .status-item-value {
      font-weight: 600;
      font-size: 14px;
      color: #1a1f36;
    }

    .status-progress-bar {
      width: 100%;
      height: 8px;
      background: #e9ecef;
      border-radius: 4px;
      overflow: hidden;
      margin-top: 4px;
    }

    .status-progress-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.6s ease;
    }

    .status-item-percent {
      font-size: 12px;
      color: #6c757d;
      text-align: right;
      margin-top: 2px;
    }

    .status-total {
      font-size: 13px;
      color: #6c757d;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #e9ecef;
      text-align: center;
    }

    .activity-list {
      max-height: 300px;
      overflow-y: auto;
    }

    .activity-item {
      padding: 12px 0;
      border-bottom: 1px solid #f0f0f0;
      cursor: pointer;
      transition: all 0.2s;
    }

    .activity-item:hover {
      background: #f8f9fa;
      margin: 0 -20px;
      padding-left: 20px;
      padding-right: 20px;
      border-radius: 6px;
    }

    .activity-item .activity-message {
      font-size: 13px;
      color: #1a1f36;
    }

    .activity-item .activity-time {
      font-size: 11px;
      color: #adb5bd;
      margin-top: 4px;
    }

    .activity-empty {
      text-align: center;
      padding: 30px 0;
      color: #6c757d;
      font-size: 14px;
    }

    /* Calendar */
    .calendar-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .calendar-header .month-label {
      font-weight: 600;
      font-size: 16px;
      color: #1a1f36;
    }

    .calendar-nav-btn {
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      padding: 4px 12px;
      border-radius: 6px;
      color: #6c757d;
    }

    .calendar-nav-btn:hover {
      background: #f3f4f6;
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;
    }

    .calendar-day-header {
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      color: #6c757d;
      padding: 4px 0;
    }

    .calendar-day {
      text-align: center;
      font-size: 13px;
      padding: 6px 0;
      border-radius: 6px;
      color: #1a1f36;
    }

    .calendar-day.current-month {
      color: #1a1f36;
    }

    .calendar-day.other-month {
      color: #adb5bd;
    }

    .calendar-day.today {
      background: #4f46e5;
      color: white;
      font-weight: 600;
    }

    .loading-state {
      text-align: center;
      padding: 60px;
      color: #6c757d;
    }

    .view-more-btn {
      font-size: 13px;
      color: #4f46e5;
      cursor: pointer;
      text-decoration: none;
    }

    .view-more-btn:hover {
      text-decoration: underline;
    }

    @media (max-width: 1024px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 768px) {
      .hr-dashboard { padding: 16px; padding-top: 80px; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .dashboard-grid { grid-template-columns: 1fr; }
      .dashboard-card .card-body { padding: 16px; }
      .chart-container { height: 220px; }
      .document-chart { width: 140px; height: 140px; }
      .document-container { height: 220px; }
    }
  `;

  if (loading) {
    return (
      <>
        <Navbar userRole="hr" />
        <div className="hr-dashboard">
          <style>{styles}</style>
          <div className="loading-state">Loading dashboard...</div>
        </div>
      </>
    );
  }

  const totalApplicants = Object.values(applicantsByStatus).reduce((a, b) => a + b, 0) || 1;

  return (
    <>
      <Navbar userRole="hr" />
      <div className="hr-dashboard">
        <style>{styles}</style>

        <div className="dashboard-header">
          <h1>👋 Welcome Back, Admin!</h1>
          <p>Here's your hiring summary for this month.</p>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          {statCards.map((card, index) => (
            <div key={index} className="stat-card">
              <span className="stat-icon">{card.icon}</span>
              <span className="stat-value">{card.value}</span>
              <span className="stat-title">{card.title}</span>
              <span className={`stat-change ${card.change.startsWith('+') ? 'positive' : 'negative'}`}>
                {card.change} vs last month
              </span>
            </div>
          ))}
        </div>

        {/* Main Grid: Charts */}
        <div className="dashboard-grid">
          {/* Hiring Trends */}
          <div className="dashboard-card">
            <div className="card-header">
              <h3>📊 Hiring Trends</h3>
            </div>
            <div className="card-body">
              <div className="chart-container">
                <Line data={trendsData} options={trendsOptions} />
              </div>
            </div>
          </div>

          {/* Application Status Breakdown */}
          <div className="dashboard-card">
            <div className="card-header">
              <h3>📋 Application Status</h3>
            </div>
            <div className="card-body">
              <div className="status-list">
                {Object.entries(applicantsByStatus).map(([label, count]) => {
                  const percent = totalApplicants > 0 ? Math.round((count / totalApplicants) * 100) : 0;
                  const colors = statusColors[label] || { color: '#6c757d', barColor: '#adb5bd' };
                  
                  return (
                    <div key={label} className="status-item">
                      <div className="status-item-header">
                        <span className="status-item-label">
                          <span className="dot" style={{ background: colors.barColor }}></span>
                          {label}
                        </span>
                        <span className="status-item-value">{count}</span>
                      </div>
                      <div className="status-progress-bar">
                        <div 
                          className="status-progress-fill" 
                          style={{ 
                            width: `${percent}%`, 
                            background: colors.barColor 
                          }}
                        ></div>
                      </div>
                      <div className="status-item-percent">{percent}%</div>
                    </div>
                  );
                })}
                <div className="status-total">from {totalApplicants} applicants</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Grid: Recent Activity + Calendar */}
        <div className="dashboard-grid">
          {/* Recent Activity */}
          <div className="dashboard-card">
            <div className="card-header">
              <h3>🕐 Recent Activity</h3>
              <span className="view-more-btn" onClick={() => navigate('/hr/applications')}>
                View more →
              </span>
            </div>
            <div className="card-body">
              <div className="activity-list">
                {recentActivity.length === 0 ? (
                  <div className="activity-empty">No recent activity</div>
                ) : (
                  recentActivity.slice(0, 6).map((item) => (
                    <div 
                      key={item.id} 
                      className="activity-item"
                      onClick={() => navigate(item.link)}
                    >
                      <div className="activity-message">{item.message}</div>
                      <div className="activity-time">{formatDate(item.time)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Calendar */}
          <div className="dashboard-card">
            <div className="card-header">
              <h3>📅 {monthNames[currentMonth.getMonth()]}, {currentMonth.getFullYear()}</h3>
            </div>
            <div className="card-body">
              <div className="calendar-header">
                <button className="calendar-nav-btn" onClick={() => changeMonth(-1)}>‹</button>
                <span className="month-label">{monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
                <button className="calendar-nav-btn" onClick={() => changeMonth(1)}>›</button>
              </div>
              <div className="calendar-grid">
                {dayNames.map((day, i) => (
                  <div key={i} className="calendar-day-header">{day}</div>
                ))}
                {calendarDays.map((day, i) => {
                  const isToday = day.isCurrentMonth && 
                    day.day === new Date().getDate() && 
                    currentMonth.getMonth() === new Date().getMonth() && 
                    currentMonth.getFullYear() === new Date().getFullYear();
                  return (
                    <div 
                      key={i} 
                      className={`calendar-day ${day.isCurrentMonth ? 'current-month' : 'other-month'} ${isToday ? 'today' : ''}`}
                    >
                      {day.day}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}