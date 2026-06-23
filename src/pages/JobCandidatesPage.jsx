import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Navbar from "../components/Navbar";
import { notifyStatusChange } from '../services/notificationService';
import { supabase } from "../lib/supabase";
import "../styles/JobCandidatesPage.css";

export default function JobCandidatesPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const returnPath = location.state?.from || '/hr/jobs';

  const [loading, setLoading] = useState(true);
  const [job, setJob] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterDocuments, setFilterDocuments] = useState("All");
  const [sortBy, setSortBy] = useState("rank");
  const [sortOrder, setSortOrder] = useState("asc");
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showExplainModal, setShowExplainModal] = useState(false);
  const [selectedForExplain, setSelectedForExplain] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    loadJobAndCandidates();
  }, [jobId]);

  const loadJobAndCandidates = async () => {
    setLoading(true);
    
    try {
      const { data: jobData, error: jobError } = await supabase
        .from('job_postings')
        .select('*')
        .eq('id', jobId)
        .single();
      
      if (jobError) throw jobError;
      setJob(jobData);
      
      const { data: applicationsData, error: appsError } = await supabase
        .from('applications')
        .select('*')
        .eq('job_id', jobId)
        .neq('status', 'WITHDRAWN')
        .order('applied_date', { ascending: false });
      
      if (appsError) throw appsError;
      
      if (!applicationsData || applicationsData.length === 0) {
        setCandidates([]);
        setLoading(false);
        return;
      }
      
      const applicantIds = [...new Set(applicationsData.map(app => app.applicant_id))];
      
      const { data: applicantsData, error: applicantsError } = await supabase
        .from('applicants')
        .select('*')
        .in('id', applicantIds);
      
      if (applicantsError) throw applicantsError;
      
      const applicantsMap = {};
      applicantsData.forEach(applicant => {
        applicantsMap[applicant.id] = applicant;
      });
      
      const candidatesWithRank = applicationsData.map((app, index) => {
        const applicant = applicantsMap[app.applicant_id] || {};
        const aiData = app.ai_explanation || {};
        const breakdown = aiData.breakdown || {};
        
        const contributingFactors = [];
        const scoreReduced = [];
        
        for (const [key, value] of Object.entries(breakdown)) {
          const status = value.status || '';
          const required = value.required || 0;
          const actual = value.actual || 0;
          
          const isExactMet = status === 'MET' || 
                             (status.includes('EXCEEDS')) ||
                             (status.startsWith('MET ') && !status.startsWith('NOT MET'));
          
          const isNotMet = status.includes('NOT MET');
          const requirementMet = isExactMet && !isNotMet;
          
          if (requirementMet) {
            if (key === 'Education') {
              const eduLevels = ['', 'Elementary', 'High School', '2-Year College', "Bachelor's", "Master's", "PhD/Doctorate"];
              const actualLevel = eduLevels[actual] || `Level ${actual}`;
              const reqLevel = eduLevels[required] || `Level ${required}`;
              contributingFactors.push(`Has ${actualLevel} degree (meets ${reqLevel} requirement)`);
            } else if (key === 'Experience') {
              contributingFactors.push(`Has ${actual} years of relevant experience (meets ${required} year requirement)`);
            } else if (key === 'Training Hours') {
              contributingFactors.push(`Completed ${actual} training hours (meets ${required} hour requirement)`);
            } else if (key === 'Eligibility') {
              const eligDisplay = typeof actual === 'string' ? actual : actual;
              contributingFactors.push(`Has ${eligDisplay} eligibility`);
            } else {
              contributingFactors.push(`${key}: ${status}`);
            }
          } else if (status.includes('%') && !status.includes('NOT REQUIRED')) {
            if (key === 'Experience') {
              scoreReduced.push(`Experience: ${actual} years (needs ${required} years)`);
            } else if (key === 'Training Hours') {
              const gap = required - actual;
              scoreReduced.push(`Training Hours: ${actual}/${required} hours (needs ${gap} more hours)`);
            } else if (key === 'Education') {
              const eduLevels = ['', 'Elementary', 'High School', '2-Year College', "Bachelor's", "Master's", "PhD/Doctorate"];
              const actualLevel = eduLevels[actual] || `Level ${actual}`;
              const reqLevel = eduLevels[required] || `Level ${required}`;
              scoreReduced.push(`Education: ${actualLevel} (needs ${reqLevel})`);
            } else {
              scoreReduced.push(`${key}: ${status}`);
            }
          } else if (isNotMet || (!status.includes('NOT REQUIRED') && !requirementMet)) {
            if (key === 'Eligibility') {
              const eligDisplay = typeof actual === 'string' ? actual : actual;
              const reqDisplay = typeof required === 'string' ? required : required;
              scoreReduced.push(`Eligibility: Has ${eligDisplay} (needs ${reqDisplay})`);
            } else if (key === 'Experience') {
              scoreReduced.push(`Experience: ${actual} years (needs ${required} years)`);
            } else if (key === 'Training Hours') {
              const gap = required - actual;
              scoreReduced.push(`Training Hours: ${actual}/${required} hours (needs ${gap} more hours)`);
            } else if (key === 'Education') {
              const eduLevels = ['', 'Elementary', 'High School', '2-Year College', "Bachelor's", "Master's", "PhD/Doctorate"];
              const actualLevel = eduLevels[actual] || `Level ${actual}`;
              const reqLevel = eduLevels[required] || `Level ${required}`;
              scoreReduced.push(`Education: ${actualLevel} (needs ${reqLevel})`);
            } else if (!status.includes('NOT REQUIRED')) {
              scoreReduced.push(`${key}: ${status}`);
            }
          }
        }
        
        if (contributingFactors.length === 0) {
          contributingFactors.push('Meets minimum qualifications');
        }
        
        return {
          id: app.id,
          applicant_id: app.applicant_id,
          applicant_name: applicant.full_name || 'Unknown',
          applicant_email: applicant.email || 'No email',
          applied_date: app.applied_date,
          status: app.status || 'PENDING',
          docs_submitted: app.docs_submitted || {},
          ai_match_score: app.ai_match_score || 0,
          rank: index + 1,
          education: extractEducation(breakdown),
          eligibility: extractEligibility(breakdown),
          training: extractTraining(breakdown),
          experience: extractExperience(breakdown),
          explanation: {
            contributing_factors: contributingFactors,
            score_reduced: scoreReduced,
            recommendation: aiData.recommendation || aiData.summary || 'Review candidate qualifications.',
            summary: aiData.summary || '',
            requirements_met: aiData.requirements_met || '0/0',
            verdict: aiData.verdict || 'NOT FIT'
          }
        };
      });
      
      setCandidates(candidatesWithRank);
      
    } catch (error) {
      console.error('Error loading job candidates:', error);
      alert('Error loading candidates: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const extractEducation = (breakdown) => {
    if (breakdown.Education) {
      const edu = breakdown.Education;
      const eduLevels = ['', 'Elementary', 'High School', '2-Year College', "Bachelor's", "Master's", "PhD/Doctorate"];
      const actualLevel = eduLevels[edu.actual] || `Level ${edu.actual}`;
      const reqLevel = eduLevels[edu.required] || `Level ${edu.required}`;
      return `${actualLevel} (Required: ${reqLevel})`;
    }
    return 'N/A';
  };

  const extractEligibility = (breakdown) => {
    if (breakdown.Eligibility) {
      const elig = breakdown.Eligibility;
      return elig.actual || 'None';
    }
    return 'N/A';
  };

  const extractTraining = (breakdown) => {
    if (breakdown['Training Hours']) {
      const train = breakdown['Training Hours'];
      return `${train.actual || 0} hours (Required: ${train.required || 0})`;
    }
    return 'N/A';
  };

  const extractExperience = (breakdown) => {
    if (breakdown.Experience) {
      const exp = breakdown.Experience;
      return `${exp.actual || 0} years (Required: ${exp.required || 0})`;
    }
    return 'N/A';
  };

  const getStatusColor = (status) => {
    const colors = {
      PENDING: { bg: "#FFF3E0", color: "#E65100", label: "Pending" },
      REVIEWING: { bg: "#E3F2FD", color: "#1565C0", label: "Under Review" },
      QUALIFIED: { bg: "#E8F5E9", color: "#2E7D32", label: "Qualified" },
      SHORTLISTED: { bg: "#E8F5E9", color: "#2E7D32", label: "Shortlisted" },
      FOR_INTERVIEW: { bg: "#F3E5F5", color: "#7B1FA2", label: "For Interview" },
      INTERVIEW_SCHEDULED: { bg: "#F3E5F5", color: "#7B1FA2", label: "Interview Scheduled" },
      HIRED: { bg: "#E8F5E9", color: "#1B5E20", label: "Hired" },
      NOT_SELECTED: { bg: "#FFEBEE", color: "#C62828", label: "Not Selected" },
      REJECTED: { bg: "#FFEBEE", color: "#C62828", label: "Rejected" },
      WITHDRAWN: { bg: "#F3E5F5", color: "#6A1B9A", label: "Withdrawn" }
    };
    return colors[status] || colors["PENDING"];
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
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const checkDocumentsComplete = (docs, jobRequiredDocs) => {
    if (!docs) return false;
    
    let allComplete = docs.pds === true;
    
    if (jobRequiredDocs?.transcriptRecords) {
      allComplete = allComplete && docs.transcript === true;
    }
    
    if (jobRequiredDocs?.performanceRating) {
      allComplete = allComplete && docs.performanceRating === true;
    }
    
    return allComplete;
  };

  // =============================================
  // EXPORT SHORTLIST TO PDF
  // =============================================
  const exportShortlistPDF = () => {
    // Get shortlisted or qualified candidates
    const shortlisted = candidates.filter(c => 
      c.status === 'SHORTLISTED' || c.status === 'QUALIFIED'
    );

    if (shortlisted.length === 0) {
      alert('No shortlisted candidates to export.');
      return;
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    // === HEADER ===
    // Agency Name
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('CITY GOVERNMENT OF ILIGAN', pageWidth / 2, 25, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('HUMAN RESOURCE MANAGEMENT OFFICE', pageWidth / 2, 33, { align: 'center' });

    // Divider
    doc.setDrawColor(100);
    doc.line(margin, 38, pageWidth - margin, 38);

    // === TITLE ===
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('SHORTLIST OF QUALIFIED CANDIDATES', pageWidth / 2, 48, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(`For the Position of: ${job?.position_title || 'N/A'}`, pageWidth / 2, 56, { align: 'center' });

    // === DETAILS ===
    const today = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Date Generated: ${today}`, margin, 68);
    doc.text(`Item No.: ${job?.item_no || 'N/A'}`, margin, 75);
    doc.text(`Total Applicants: ${candidates.length}  |  Shortlisted: ${shortlisted.length}`, margin, 82);

    // === TABLE ===
    const tableData = shortlisted.map((c, index) => [
      index + 1,
      c.applicant_name,
      c.education || 'N/A',
      c.eligibility || 'N/A',
      `${c.ai_match_score || 0}%`
    ]);

    autoTable(doc, {
      startY: 90,
      head: [['#', 'Name', 'Education', 'Eligibility', 'Score']],
      body: tableData,
      theme: 'grid',
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 10,
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35 },
        3: { cellWidth: 35 },
        4: { cellWidth: 25, halign: 'center' },
      },
      margin: { left: margin, right: margin },
    });

    // === FOOTER ===
    const finalY = doc.lastAutoTable.finalY + 15;

    // Divider
    doc.setDrawColor(100);
    doc.line(margin, finalY, pageWidth - margin, finalY);

    // Signatures
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Prepared by:', margin, finalY + 15);
    doc.text('Approved by:', pageWidth - margin - 40, finalY + 15);

    doc.setFont('helvetica', 'normal');
    doc.text('___________________________', margin, finalY + 25);
    doc.text('___________________________', pageWidth - margin - 40, finalY + 25);

    doc.setFontSize(9);
    doc.text('HRMO Designate', margin, finalY + 32);
    doc.text('HRMPSB Chairperson', pageWidth - margin - 40, finalY + 32);

    // Certification
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('This is a certified true copy of the shortlist.', pageWidth / 2, finalY + 45, { align: 'center' });

    // Watermark
    doc.setFontSize(40);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(200, 200, 200);
    doc.text('FOR HRMPSB REVIEW', pageWidth / 2, 160, { align: 'center', angle: 45 });
    doc.setTextColor(0, 0, 0);

    // === SAVE ===
    doc.save(`Shortlist_${job?.position_title?.replace(/\s+/g, '_') || 'Candidates'}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // =============================================
  // UPDATE CANDIDATE STATUS WITH NOTIFICATIONS
  // =============================================
  const updateCandidateStatus = async (applicationId, newStatus) => {
    if (!window.confirm(`Change status to "${newStatus}"?`)) return;
    
    setUpdatingStatus(true);
    
    try {
      // Get the old status from selectedApplication
      const oldStatus = selectedApplication?.status || 'PENDING';
      
      // Get the application to find the applicant_id
      const { data: appData, error: appError } = await supabase
        .from('applications')
        .select('applicant_id, job_id')
        .eq('id', applicationId)
        .single();
      
      if (appError) throw appError;
      
      // Get job title for the notification
      const { data: jobData, error: jobError } = await supabase
        .from('job_postings')
        .select('position_title')
        .eq('id', appData.job_id)
        .single();
      
      if (jobError) throw jobError;
      
      // Update the status
      const { error } = await supabase
        .from('applications')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', applicationId);
      
      if (error) throw error;
      
      console.log('📨 Sending notification to applicant...');
      
      // Send notification to the APPLICANT (not HR)
      const result = await notifyStatusChange(
        appData.applicant_id,
        jobData.position_title,
        oldStatus,
        newStatus
      );
      
      console.log('📨 Notification result:', result);
      
      alert(`Status updated to ${newStatus}`);
      loadJobAndCandidates();
      
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status: ' + error.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Filter logic with documents filter
  const filteredCandidates = candidates
    .filter((c) => {
      const matchesSearch = c.applicant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           c.applicant_email.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === "All" || c.status === filterStatus;
      
      let matchesDocuments = true;
      if (filterDocuments === "Complete") {
        matchesDocuments = checkDocumentsComplete(c.docs_submitted, job?.required_docs);
      } else if (filterDocuments === "Incomplete") {
        matchesDocuments = !checkDocumentsComplete(c.docs_submitted, job?.required_docs);
      }
      
      return matchesSearch && matchesStatus && matchesDocuments;
    })
    .sort((a, b) => {
      let aVal, bVal;
      if (sortBy === "ai_score") {
        aVal = a.ai_match_score || 0;
        bVal = b.ai_match_score || 0;
        return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
      } else if (sortBy === "rank") {
        aVal = a.rank || 999;
        bVal = b.rank || 999;
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      } else if (sortBy === "status") {
        aVal = a.status || '';
        bVal = b.status || '';
        return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        aVal = new Date(a.applied_date);
        bVal = new Date(b.applied_date);
        return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
      }
    });

  const stats = {
    total: candidates.length,
    qualified: candidates.filter(c => c.status === "QUALIFIED" || c.status === "REVIEWING" || c.status === "SHORTLISTED").length,
    interviewed: candidates.filter(c => c.status === "INTERVIEW_SCHEDULED" || c.status === "FOR_INTERVIEW").length,
    pending: candidates.filter(c => c.status === "PENDING").length,
  };

  return (
    <>
      <Navbar userRole="hr" />

      <div className="candidate-container">
        <div className="page-header">
          <div className="back-link" onClick={() => navigate(returnPath)}>
            ← Back
          </div>
          <h1>👥 Candidates for {job?.position_title || 'Loading...'}</h1>
          <p>Showing {candidates.length} applicant(s) for this position</p>
        </div>

        {loading ? (
          <div className="loading-state">Loading candidates...</div>
        ) : (
          <>
            <div className="stats-cards">
              <div className="stat-card">
                <span className="stat-number">{stats.total}</span>
                <span className="stat-label">Total Applicants</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats.qualified}</span>
                <span className="stat-label">Qualified</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats.interviewed}</span>
                <span className="stat-label">For Interview</span>
              </div>
              <div className="stat-card">
                <span className="stat-number">{stats.pending}</span>
                <span className="stat-label">Pending</span>
              </div>
            </div>

            <div className="controls">
              <input
                type="text"
                className="search-input"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <select
                className="filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="REVIEWING">Under Review</option>
                <option value="SHORTLISTED">Shortlisted</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="FOR_INTERVIEW">For Interview</option>
                <option value="INTERVIEW_SCHEDULED">Interview Scheduled</option>
                <option value="HIRED">Hired</option>
                <option value="NOT_SELECTED">Not Selected</option>
                <option value="REJECTED">Rejected</option>
              </select>
              <select
                className="filter-select"
                value={filterDocuments}
                onChange={(e) => setFilterDocuments(e.target.value)}
              >
                <option value="All">All Documents</option>
                <option value="Complete">Complete Only</option>
                <option value="Incomplete">Incomplete Only</option>
              </select>
              <span className="sort-label">Sort:</span>
              <button
                className={`sort-btn ${sortBy === "rank" ? "active" : ""}`}
                onClick={() => {
                  if (sortBy === "rank") {
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  } else {
                    setSortBy("rank");
                    setSortOrder("asc");
                  }
                }}
              >
                Rank {sortBy === "rank" && (sortOrder === "asc" ? "↑" : "↓")}
              </button>
              <button
                className={`sort-btn ${sortBy === "ai_score" ? "active" : ""}`}
                onClick={() => {
                  if (sortBy === "ai_score") {
                    setSortOrder(sortOrder === "desc" ? "asc" : "desc");
                  } else {
                    setSortBy("ai_score");
                    setSortOrder("desc");
                  }
                }}
              >
                AI Score {sortBy === "ai_score" && (sortOrder === "desc" ? "↓" : "↑")}
              </button>
              <button
                className={`sort-btn ${sortBy === "status" ? "active" : ""}`}
                onClick={() => {
                  if (sortBy === "status") {
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  } else {
                    setSortBy("status");
                    setSortOrder("asc");
                  }
                }}
              >
                Status {sortBy === "status" && (sortOrder === "asc" ? "↑" : "↓")}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
              <button 
                onClick={exportShortlistPDF}
                style={{
                  padding: '10px 20px',
                  background: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px'
                }}
              >
                📄 Export Shortlist (PDF)
              </button>
            </div>

            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Documents</th>
                    <th>Score</th>
                    <th>XAI</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCandidates.length === 0 ? (
                    <tr>
                      <td colSpan="7">
                        <div className="empty-state">No candidates found</div>
                      </td>
                    </tr>
                  ) : (
                    filteredCandidates.map((candidate) => {
                      const statusStyle = getStatusColor(candidate.status);
                      const docsComplete = checkDocumentsComplete(candidate.docs_submitted, job?.required_docs);

                      return (
                        <tr key={candidate.id}>
                          <td className="rank-cell">#{candidate.rank}</td>
                          <td>
                            <div className="applicant-cell">
                              <div className="avatar">{candidate.applicant_name.charAt(0)}</div>
                              <div className="applicant-info">
                                <span className="applicant-name">{candidate.applicant_name}</span>
                                <span className="applicant-email">{candidate.applicant_email}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`doc-status ${docsComplete ? 'doc-complete' : 'doc-incomplete'}`}>
                              {docsComplete ? '✅ Complete' : '❌ Incomplete'}
                            </span>
                          </td>
                          <td>
                            <span
                              className="score-badge"
                              style={{
                                background: getScoreBg(candidate.ai_match_score),
                                color: getScoreColor(candidate.ai_match_score),
                              }}
                            >
                              {candidate.ai_match_score}%
                            </span>
                          </td>
                          <td>
                            <button 
                              className="explain-btn"
                              onClick={() => {
                                setSelectedForExplain(candidate);
                                setShowExplainModal(true);
                              }}
                            >
                              🔍 XAI
                            </button>
                          </td>
                          <td>
                            <span
                              className="status-badge"
                              style={{
                                backgroundColor: statusStyle.bg,
                                color: statusStyle.color,
                              }}
                            >
                              {statusStyle.label}
                            </span>
                          </td>
                          <td>
                            <button
                              className="view-btn"
                              onClick={() => {
                                setSelectedApplication(candidate);
                                setShowDetailsModal(true);
                              }}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="job-req-note">
              <span><strong>Education:</strong> {job?.qualifications?.education || 'N/A'}</span>
              <span><strong>Eligibility:</strong> {job?.qualifications?.eligibility || 'N/A'}</span>
              <span><strong>Training:</strong> {job?.qualifications?.training || 'N/A'}</span>
              <span><strong>Work Experience:</strong> {job?.qualifications?.workExperience || 'N/A'}</span>
            </div>
          </>
        )}
      </div>

      {/* XAI Explanation Modal */}
      {showExplainModal && selectedForExplain && (
        <div className="modal-overlay" onClick={() => setShowExplainModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔍 XAI Explanation</h3>
              <button className="close-modal" onClick={() => setShowExplainModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}>
                <strong style={{ fontSize: 18, color: '#1a1f36' }}>
                  {selectedForExplain.applicant_name}
                </strong>
                <span style={{ marginLeft: 12, fontSize: 14, color: '#6c757d' }}>
                  Rank: #{selectedForExplain.rank}
                </span>
              </div>

              <div className="explanation-container">
                <div className="explanation-score" style={{ color: getScoreColor(selectedForExplain.ai_match_score) }}>
                  Suitability Score: {selectedForExplain.ai_match_score}%
                </div>

                <div className="requirements-met">
                  Requirements Met: {selectedForExplain.explanation.requirements_met || '0/0'}
                </div>

                <div className="explanation-section-title">Contributing Factors:</div>
                {selectedForExplain.explanation.contributing_factors.map((factor, idx) => (
                  <div key={idx} className="explanation-factor">✓ {factor}</div>
                ))}

                {selectedForExplain.explanation.score_reduced.length > 0 && (
                  <>
                    <div className="explanation-section-title">Score reduced because:</div>
                    {selectedForExplain.explanation.score_reduced.map((factor, idx) => (
                      <div key={idx} className="explanation-factor-reduced">• {factor}</div>
                    ))}
                  </>
                )}

                <div className="explanation-summary">
                  {selectedForExplain.explanation.summary || selectedForExplain.explanation.recommendation}
                </div>
              </div>

              <div className="modal-actions">
                <button className="close-btn" onClick={() => setShowExplainModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Application Details Modal */}
      {showDetailsModal && selectedApplication && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Candidate Details</h3>
              <button className="close-modal" onClick={() => setShowDetailsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <h4>Profile</h4>
                <div className="detail-grid">
                  <div><span className="detail-label">Name</span><span className="detail-value">{selectedApplication.applicant_name}</span></div>
                  <div><span className="detail-label">Email</span><span className="detail-value">{selectedApplication.applicant_email}</span></div>
                  <div><span className="detail-label">Rank</span><span className="detail-value">#{selectedApplication.rank}</span></div>
                  <div><span className="detail-label">AI Match Score</span><span className="detail-value">{selectedApplication.ai_match_score}%</span></div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Documents Status</h4>
                <ul className="docs-list">
                  {/* PDS is always required */}
                  <li>{selectedApplication.docs_submitted?.pds ? '✅' : '❌'} Personal Data Sheet (PDS)</li>
                  
                  {/* Only show Transcript if required by the job */}
                  {job?.required_docs?.transcriptRecords && (
                    <li>{selectedApplication.docs_submitted?.transcript ? '✅' : '❌'} Transcript of Records</li>
                  )}
                  
                  {/* Only show Performance Rating if required by the job */}
                  {job?.required_docs?.performanceRating && (
                    <li>{selectedApplication.docs_submitted?.performanceRating ? '✅' : '❌'} Performance Rating</li>
                  )}
                </ul>
              </div>

              <div className="detail-section">
                <h4>Qualifications</h4>
                <div className="detail-grid">
                  <div><span className="detail-label">Education</span><span className="detail-value">{selectedApplication.education}</span></div>
                  <div><span className="detail-label">Eligibility</span><span className="detail-value">{selectedApplication.eligibility || 'None'}</span></div>
                  <div><span className="detail-label">Training</span><span className="detail-value">{selectedApplication.training}</span></div>
                  <div><span className="detail-label">Experience</span><span className="detail-value">{selectedApplication.experience}</span></div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Application Details</h4>
                <div className="detail-grid">
                  <div><span className="detail-label">Status</span>
                    <div className="status-update-section">
                      <select 
                        value={selectedApplication.status}
                        onChange={(e) => {
                          const newStatus = e.target.value;
                          setSelectedApplication({...selectedApplication, status: newStatus});
                        }}
                      >
                        <option value="PENDING">Pending</option>
                        <option value="REVIEWING">Under Review</option>
                        <option value="SHORTLISTED">Shortlisted</option>
                        <option value="QUALIFIED">Qualified</option>
                        <option value="FOR_INTERVIEW">For Interview</option>
                        <option value="INTERVIEW_SCHEDULED">Interview Scheduled</option>
                        <option value="HIRED">Hired</option>
                        <option value="NOT_SELECTED">Not Selected</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                      <button 
                        onClick={() => updateCandidateStatus(selectedApplication.id, selectedApplication.status)}
                        disabled={updatingStatus}
                      >
                        Update
                      </button>
                    </div>
                  </div>
                  <div><span className="detail-label">Applied Date</span><span className="detail-value">{formatDate(selectedApplication.applied_date)}</span></div>
                </div>
              </div>

              <div className="modal-actions">
                <button className="close-btn" onClick={() => setShowDetailsModal(false)}>Close</button>
                {selectedApplication.status !== 'INTERVIEW_SCHEDULED' && (
                  <button 
                    className="schedule-btn" 
                    onClick={() => updateCandidateStatus(selectedApplication.id, 'INTERVIEW_SCHEDULED')}
                    disabled={updatingStatus}
                  >
                    📅 Schedule Interview
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}