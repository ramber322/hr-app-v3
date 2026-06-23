import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import "../styles/ReportsPage.css";

// Chart.js imports
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function ReportsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [reports, setReports] = useState({
    totalJobs: 0,
    totalApplications: 0,
    totalHired: 0,
    openJobs: 0,
    applicationsByMonth: [],
    applicationsByDepartment: [],
    statusBreakdown: {},
  });
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: '',
  });
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    try {
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
        .select('*, job_postings(position_title, place_of_assignment)')
        .neq('status', 'WITHDRAWN');

      if (appsError) throw appsError;

      const totalApplications = applications.length;
      const hired = applications.filter(a => a.status === 'HIRED').length;

      // 3. Applications by month
      const monthCount = {};
      applications.forEach(app => {
        const date = new Date(app.applied_date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthCount[monthKey] = (monthCount[monthKey] || 0) + 1;
      });

      const applicationsByMonth = Object.entries(monthCount)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([month, count]) => ({
          month,
          count,
        }));

      // 4. Applications by department
      const deptCount = {};
      applications.forEach(app => {
        const dept = app.job_postings?.place_of_assignment || 'Unknown';
        deptCount[dept] = (deptCount[dept] || 0) + 1;
      });

      const applicationsByDepartment = Object.entries(deptCount)
        .sort((a, b) => b[1] - a[1])
        .map(([department, count]) => ({
          department,
          count,
        }));

      // 5. Status breakdown
      const statusCount = {
        'Pending': 0,
        'Under Review': 0,
        'Shortlisted': 0,
        'Rejected': 0,
      };

      applications.forEach(app => {
        const status = app.status;
        if (status === 'PENDING') {
          statusCount['Pending']++;
        } else if (status === 'REVIEWING') {
          statusCount['Under Review']++;
        } else if (['QUALIFIED', 'SHORTLISTED', 'FOR_INTERVIEW', 'INTERVIEW_SCHEDULED', 'HIRED'].includes(status)) {
          statusCount['Shortlisted']++;
        } else if (['NOT_SELECTED', 'REJECTED'].includes(status)) {
          statusCount['Rejected']++;
        }
      });

      // 6. Get unique departments for filter
      const uniqueDepts = [...new Set(applications.map(app => app.job_postings?.place_of_assignment).filter(Boolean))];
      setDepartments(uniqueDepts);

      setReports({
        totalJobs,
        totalApplications,
        totalHired: hired,
        openJobs,
        applicationsByMonth,
        applicationsByDepartment,
        statusBreakdown: statusCount,
      });

      setJob({ position_title: 'All Positions' });

    } catch (error) {
      console.error('Error loading reports:', error);
      alert('Error loading reports: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // =============================================
  // EXPORT TO PDF
  // =============================================
  const exportPDF = () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    // Header
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('CITY GOVERNMENT OF ILIGAN', pageWidth / 2, 25, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('HUMAN RESOURCE MANAGEMENT OFFICE', pageWidth / 2, 33, { align: 'center' });

    doc.setDrawColor(100);
    doc.line(margin, 38, pageWidth - margin, 38);

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('RECRUITMENT REPORT', pageWidth / 2, 48, { align: 'center' });

    const today = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date Generated: ${today}`, margin, 60);

    // Summary Stats
    const statsData = [
      ['Total Jobs', reports.totalJobs],
      ['Total Applications', reports.totalApplications],
      ['Total Hired', reports.totalHired],
      ['Open Jobs', reports.openJobs],
    ];

    autoTable(doc, {
      startY: 68,
      head: [['Metric', 'Value']],
      body: statsData,
      theme: 'striped',
      headStyles: {
        fillColor: [43, 108, 176],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      margin: { left: margin, right: margin },
    });

    // Status Breakdown
    const statusData = Object.entries(reports.statusBreakdown).map(([status, count]) => [
      status,
      count,
    ]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Status', 'Count']],
      body: statusData,
      theme: 'striped',
      headStyles: {
        fillColor: [43, 108, 176],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      margin: { left: margin, right: margin },
    });

    // Department Breakdown
    const deptData = reports.applicationsByDepartment.map(d => [
      d.department,
      d.count,
    ]);

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [['Department', 'Applications']],
      body: deptData,
      theme: 'striped',
      headStyles: {
        fillColor: [43, 108, 176],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      margin: { left: margin, right: margin },
    });

    doc.save(`Recruitment_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // =============================================
  // EXPORT TO EXCEL
  // =============================================
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Summary Sheet
    const summaryData = [
      ['Metric', 'Value'],
      ['Total Jobs', reports.totalJobs],
      ['Total Applications', reports.totalApplications],
      ['Total Hired', reports.totalHired],
      ['Open Jobs', reports.openJobs],
      [''],
      ['Status Breakdown'],
      ['Status', 'Count'],
    ];

    Object.entries(reports.statusBreakdown).forEach(([status, count]) => {
      summaryData.push([status, count]);
    });

    summaryData.push(['']);
    summaryData.push(['Department Breakdown']);
    summaryData.push(['Department', 'Applications']);

    reports.applicationsByDepartment.forEach(d => {
      summaryData.push([d.department, d.count]);
    });

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1['!cols'] = [{ wch: 30 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Summary');

    // Monthly Applications Sheet
    const monthData = [
      ['Month', 'Applications'],
    ];
    reports.applicationsByMonth.forEach(d => {
      monthData.push([d.month, d.count]);
    });

    const ws2 = XLSX.utils.aoa_to_sheet(monthData);
    ws2['!cols'] = [{ wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Monthly Applications');

    XLSX.writeFile(wb, `Recruitment_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Chart Data - Monthly Applications
  const monthLabels = reports.applicationsByMonth.map(d => d.month);
  const monthCounts = reports.applicationsByMonth.map(d => d.count);

  const monthlyChartData = {
    labels: monthLabels.length > 0 ? monthLabels : ['No Data'],
    datasets: [
      {
        label: 'Applications',
        data: monthCounts.length > 0 ? monthCounts : [0],
        backgroundColor: 'rgba(43, 108, 176, 0.7)',
        borderColor: 'rgba(43, 108, 176, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const monthlyOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.y} applications`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  // Status Breakdown - Doughnut Chart
  const statusLabels = Object.keys(reports.statusBreakdown);
  const statusCounts = Object.values(reports.statusBreakdown);

  const statusChartData = {
    labels: statusLabels.length > 0 ? statusLabels : ['No Data'],
    datasets: [
      {
        data: statusCounts.length > 0 ? statusCounts : [1],
        backgroundColor: ['#ED8936', '#4299E1', '#48BB78', '#FC8181'],
        borderWidth: 0,
      },
    ],
  };

  const statusOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          boxWidth: 8,
          padding: 15,
        },
      },
    },
    cutout: '65%',
  };

  // Department Chart Data
  const deptLabels = reports.applicationsByDepartment.slice(0, 8).map(d => d.department);
  const deptCounts = reports.applicationsByDepartment.slice(0, 8).map(d => d.count);

  const deptChartData = {
    labels: deptLabels.length > 0 ? deptLabels : ['No Data'],
    datasets: [
      {
        label: 'Applications',
        data: deptCounts.length > 0 ? deptCounts : [0],
        backgroundColor: 'rgba(72, 187, 120, 0.7)',
        borderColor: 'rgba(72, 187, 120, 1)',
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const deptOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.x} applications`,
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  const styles = `
    .reports-container {
      padding-top: 80px;
      padding-left: 24px;
      padding-right: 24px;
      background: #f5f6f8;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }

    .page-header {
      margin-bottom: 24px;
    }

    .page-header h1 {
      margin: 0;
      font-size: 28px;
      color: #1a1f36;
    }

    .page-header p {
      color: #6c757d;
      margin-top: 4px;
      font-size: 14px;
    }

    .export-buttons {
      display: flex;
      gap: 12px;
      margin-top: 12px;
      flex-wrap: wrap;
    }

    .export-btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      transition: all 0.2s;
    }

    .export-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .export-btn.pdf {
      background: #dc3545;
      color: white;
    }

    .export-btn.excel {
      background: #10b981;
      color: white;
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
      text-align: center;
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
      margin-top: 4px;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
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
      height: 250px;
      position: relative;
    }

    .loading-state {
      text-align: center;
      padding: 60px;
      color: #6c757d;
    }

    @media (max-width: 1024px) {
      .stats-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 768px) {
      .reports-container { padding: 16px; padding-top: 80px; }
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
      .dashboard-grid { grid-template-columns: 1fr; }
      .export-buttons { flex-direction: column; }
      .export-btn { justify-content: center; }
    }
  `;

  if (loading) {
    return (
      <>
        <Navbar userRole="hr" />
        <div className="reports-container">
          <style>{styles}</style>
          <div className="loading-state">Loading reports...</div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar userRole="hr" />
      <div className="reports-container">
        <style>{styles}</style>

        <div className="page-header">
          <h1>📈 Reports</h1>
          <p>Generate and export recruitment reports</p>
          <div className="export-buttons">
            <button className="export-btn pdf" onClick={exportPDF}>
              📄 Export as PDF
            </button>
            <button className="export-btn excel" onClick={exportExcel}>
              📊 Export as Excel
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{reports.totalJobs}</span>
            <span className="stat-title">Total Jobs</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{reports.totalApplications}</span>
            <span className="stat-title">Total Applications</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{reports.totalHired}</span>
            <span className="stat-title">Total Hired</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{reports.openJobs}</span>
            <span className="stat-title">Open Jobs</span>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="dashboard-grid">
          {/* Monthly Applications */}
          <div className="dashboard-card">
            <div className="card-header">
              <h3>📊 Applications Per Month</h3>
            </div>
            <div className="card-body">
              <div className="chart-container">
                <Bar data={monthlyChartData} options={monthlyOptions} />
              </div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="dashboard-card">
            <div className="card-header">
              <h3>📋 Status Breakdown</h3>
            </div>
            <div className="card-body">
              <div className="chart-container">
                <Doughnut data={statusChartData} options={statusOptions} />
              </div>
            </div>
          </div>
        </div>

        {/* Department Breakdown */}
        <div className="dashboard-grid">
          <div className="dashboard-card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <h3>🏢 Applications By Department</h3>
            </div>
            <div className="card-body">
              <div className="chart-container" style={{ height: '300px' }}>
                <Bar data={deptChartData} options={deptOptions} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}