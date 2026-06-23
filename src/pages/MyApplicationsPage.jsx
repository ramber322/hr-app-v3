import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import "../styles/MyApplicationsPage.css";

export default function MyApplicationsPage() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  // Education level labels
  const EDUCATION_LABELS = {
    0: "None Required",
    1: "Elementary Graduate",
    2: "High School Graduate",
    3: "2-Year College / Associate",
    4: "Bachelor's Degree",
    5: "Master's Degree"
  };

  // Eligibility level labels
  const ELIGIBILITY_LABELS = {
    "none": "None Required",
    "subprofessional": "Career Service Subprofessional",
    "professional": "Career Service Professional"
  };

  useEffect(() => {
    checkUserAndLoadApplications();
  }, []);

  const checkUserAndLoadApplications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/login');
      return;
    }
    await loadApplications(user.id);
  };

  const loadApplications = async (applicantId) => {
    setLoading(true);
    
    const { data: applicationsData, error: applicationsError } = await supabase
      .from('applications')
      .select('*')
      .eq('applicant_id', applicantId)
      .neq('status', 'WITHDRAWN')
      .order('applied_date', { ascending: false });
    
    if (applicationsError) {
      console.error('Error loading applications:', applicationsError);
      setLoading(false);
      return;
    }
    
    if (!applicationsData || applicationsData.length === 0) {
      setApplications([]);
      setLoading(false);
      return;
    }
    
    const jobIds = [...new Set(applicationsData.map(app => app.job_id))];
    
    const { data: jobsData, error: jobsError } = await supabase
      .from('job_postings')
      .select('*')
      .in('id', jobIds);
    
    if (jobsError) {
      console.error('Error loading jobs:', jobsError);
      setLoading(false);
      return;
    }
    
    const jobsMap = {};
    jobsData.forEach(job => {
      jobsMap[job.id] = job;
    });
    
    const combinedData = applicationsData.map(app => ({
      ...app,
      job_postings: jobsMap[app.job_id] || null

      
    }));
    
    setApplications(combinedData);
    setLoading(false);
  };

 const getStatusColor = (status) => {
  const colors = {
    'PENDING': { bg: '#FFF3E0', color: '#E65100', text: 'Pending Review' },
    'REVIEWING': { bg: '#E3F2FD', color: '#1565C0', text: 'Under Review' },
    'QUALIFIED': { bg: '#E8F5E9', color: '#2E7D32', text: 'Qualified' },
    'SHORTLISTED': { bg: '#E8F5E9', color: '#2E7D32', text: 'Shortlisted' },
    'FOR_INTERVIEW': { bg: '#F3E5F5', color: '#7B1FA2', text: 'For Interview' },
    'INTERVIEW_SCHEDULED': { bg: '#F3E5F5', color: '#7B1FA2', text: 'Interview Scheduled' },
    'HIRED': { bg: '#E8F5E9', color: '#1B5E20', text: 'Hired' },
    'NOT_SELECTED': { bg: '#FFEBEE', color: '#C62828', text: 'Not Selected' },
    'REJECTED': { bg: '#FFEBEE', color: '#C62828', text: 'Rejected' },
    'WITHDRAWN': { bg: '#F3E5F5', color: '#6A1B9A', text: 'Withdrawn' }
  };
  return colors[status] || colors['PENDING'];
};

  const getDocumentStatus = (docsSubmitted, docType) => {
    if (!docsSubmitted) return false;
    return docsSubmitted[docType] === true;
  };

  const canWithdraw = (application) => {
    if (application.status === 'WITHDRAWN') return false;
    const withdrawableStatuses = ['PENDING', 'REVIEWING'];
    const today = new Date().toISOString().split('T')[0];
    const closingDate = application.job_postings?.closing_date;
    return withdrawableStatuses.includes(application.status) && closingDate >= today;
  };

  const handleWithdraw = async (application) => {
    if (!window.confirm('Are you sure you want to withdraw this application? This action cannot be undone.')) {
      return;
    }
    
    setWithdrawing(true);
    
    try {
      const { error: updateError } = await supabase
        .from('applications')
        .update({ 
          status: 'WITHDRAWN',
          updated_at: new Date().toISOString()
        })
        .eq('id', application.id);
      
      if (updateError) throw updateError;
      
      const { data: currentJob } = await supabase
        .from('job_postings')
        .select('applicants_count')
        .eq('id', application.job_id)
        .single();

      const newCount = Math.max((currentJob?.applicants_count || 0) - 1, 0);

      const { error: countError } = await supabase
        .from('job_postings')
        .update({ applicants_count: newCount })
        .eq('id', application.job_id);
      
      if (countError) throw countError;
      
      alert('Application withdrawn successfully.');
      const { data: { user } } = await supabase.auth.getUser();
      await loadApplications(user.id);
      
    } catch (error) {
      console.error('Error withdrawing application:', error);
      alert('Failed to withdraw application. Please try again.');
    }
    
    setWithdrawing(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  const formatSalary = (salary) => {
    if (!salary) return 'N/A';
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(salary);
  };

  const getEducationLabel = (value) => {
    if (value === undefined || value === null) return 'None Required';
    return EDUCATION_LABELS[value] || `Level ${value}`;
  };

  const getEligibilityLabel = (value) => {
    if (!value || value === 'none') return 'None Required';
    return ELIGIBILITY_LABELS[value] || value;
  };

  const getTrainingLabel = (value) => {
    if (!value || value === 'None Required' || value === 0) return 'None Required';
    const hours = parseInt(value) || 0;
    if (hours === 0) return 'None Required';
    return hours === 1 ? `${hours} hour` : `${hours} hours`;
  };

  const getExperienceLabel = (value) => {
    if (!value || value === 0 || value === 'None Required') return 'None Required';
    const years = parseInt(value) || 0;
    if (years === 0) return 'None Required';
    return years === 1 ? `${years} year` : `${years} years`;
  };

  // FIXED: Helper to check if a requirement is met based on status
  const isRequirementMet = (value) => {
    if (!value || !value.status) return false;
    const status = value.status;
    
    // Check if status contains "NOT MET" - if so, return false immediately
    if (status.toUpperCase().includes('NOT MET')) {
      return false;
    }
    
    // Check if status contains MET or EXCEEDS (case insensitive)
    return status.toUpperCase().includes('MET') || status.toUpperCase().includes('EXCEEDS');
  };

  // FIXED: Generate human-readable display for breakdown items
  const getBreakdownDisplay = (key, value) => {
    const status = value.status || '';
    const required = value.required || 0;
    const actual = value.actual || 0;
    
    // Clean status - remove emojis and extra text
    let cleanStatus = status;
    
    // Remove EXCEEDS prefix and just show the message
    if (cleanStatus.includes('EXCEEDS')) {
      const match = cleanStatus.match(/EXCEEDS\s*\((.+)\)/);
      if (match) {
        return match[1];
      }
      return cleanStatus.replace('EXCEEDS', '').trim();
    }
    
    // Check if it's NOT MET
    const isNotMet = status.toUpperCase().includes('NOT MET');
    
    // For MET or partial
    if (key === 'Training Hours') {
      const progress = required > 0 ? Math.round((actual / required) * 100) : 0;
      const gap = required - actual;
      if (status.toUpperCase().includes('MET') && !isNotMet) {
        return `${actual}/${required} hours (met)`;
      } else if (status.toUpperCase().includes('NOT REQUIRED')) {
        return 'Not Required';
      } else {
        return `${actual}/${required} hours (needs ${gap} more hours)`;
      }
    }
    
    if (key === 'Education') {
      const eduLabels = ['', 'Elementary', 'High School', '2-Year College', "Bachelor's", "Master's", "PhD/Doctorate"];
      const actualLabel = eduLabels[actual] || `Level ${actual}`;
      const reqLabel = eduLabels[required] || `Level ${required}`;
      if (status.toUpperCase().includes('MET') && !isNotMet) {
        return `${actualLabel} (meets ${reqLabel} requirement)`;
      } else if (status.toUpperCase().includes('NOT REQUIRED')) {
        return 'Not Required';
      } else {
        return `${actualLabel} (needs ${reqLabel})`;
      }
    }
    
    if (key === 'Experience') {
      if (status.toUpperCase().includes('MET') && !isNotMet) {
        return `${actual} years (meets ${required} year requirement)`;
      } else if (status.toUpperCase().includes('NOT REQUIRED')) {
        return 'Not Required';
      } else {
        return `${actual} years (needs ${required} years)`;
      }
    }
    
    if (key === 'Eligibility') {
      // Handle unknown/no eligibility
      if (actual === 'unknown' || actual === 'none' || !actual) {
        if (status.toUpperCase().includes('NOT REQUIRED')) {
          return 'Not Required';
        } else {
          return `No eligibility (needs ${required})`;
        }
      }
      
      // FIXED: Handle NOT MET first
      if (isNotMet) {
        const eligLabel = getEligibilityLabel(actual);
        const reqLabel = getEligibilityLabel(required);
        if (eligLabel && eligLabel !== 'None Required') {
          return `${eligLabel} (needs ${reqLabel})`;
        }
        return `No eligibility (needs ${required})`;
      }
      
      if (status.toUpperCase().includes('EXCEEDS')) {
        const match = status.match(/EXCEEDS\s*\((.+)\)/);
        if (match) {
          return match[1];
        }
        return cleanStatus.replace('EXCEEDS', '').trim();
      } else if (status.toUpperCase().includes('MET')) {
        const eligLabel = getEligibilityLabel(actual);
        if (eligLabel && eligLabel !== 'None Required') {
          return `${eligLabel} (meets requirement)`;
        }
        return 'Meets requirement';
      } else if (status.toUpperCase().includes('NOT REQUIRED')) {
        return 'Not Required';
      } else {
        const eligLabel = getEligibilityLabel(actual);
        if (eligLabel && eligLabel !== 'None Required') {
          return `${eligLabel} (needs ${required})`;
        }
        return `No eligibility (needs ${required})`;
      }
    }
    
    return cleanStatus;
  };

  // Helper to get the display score (hybrid score from ai_explanation.percentage or fallback to ai_match_score)
  const getDisplayScore = (app) => {
    if (app.ai_explanation?.percentage !== undefined && app.ai_explanation?.percentage !== null) {
      return app.ai_explanation.percentage;
    }
    return app.ai_match_score;
  };

  // Helper to get the requirements met display
  const getRequirementsMetDisplay = (app) => {
    if (app.ai_explanation?.requirements_met) {
      return app.ai_explanation.requirements_met;
    }
    return null;
  };

  const stats = {
    total: applications.length,
    pending: applications.filter(a => a.status === 'PENDING' || a.status === 'REVIEWING').length,
    shortlisted: applications.filter(a => a.status === 'SHORTLISTED' || a.status === 'INTERVIEW').length,
    hired: applications.filter(a => a.status === 'HIRED').length
  };

  return (
    <>
      <Navbar userRole="applicant" />
      
      <div className="applications-container">
        <div className="page-header">
          <h1>My Applications</h1>
          <p>Track the status of all your job applications</p>
        </div>

        <div className="stats-cards">
          <div className="stat-card">
            <span className="stat-number">{stats.total}</span>
            <span className="stat-label">Total Applications</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.pending}</span>
            <span className="stat-label">Active Applications</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.shortlisted}</span>
            <span className="stat-label">Shortlisted/Interview</span>
          </div>
          <div className="stat-card">
            <span className="stat-number">{stats.hired}</span>
            <span className="stat-label">Offers Received</span>
          </div>
        </div>

        <div className="applications-list">
          {loading ? (
            <div className="loading-state">Loading your applications...</div>
          ) : applications.length === 0 ? (
            <div className="empty-state">
              <p>You haven't submitted any applications yet.</p>
              <p style={{ fontSize: 13, marginTop: 8 }}>
                <a href="/applicant/jobs" style={{ color: '#4f46e5' }}>Browse Jobs</a> to get started!
              </p>
            </div>
          ) : (
            applications.map((app) => {
              const job = app.job_postings;
              const statusStyle = getStatusColor(app.status);
              const canWithdrawApp = canWithdraw(app);
              const displayScore = getDisplayScore(app);
              const requirementsMet = getRequirementsMetDisplay(app);
              
              return (
                <div key={app.id} className="application-card">
                  <div className="card-header">
                    <h3 className="job-title">{job?.position_title || 'Position Not Found'}</h3>
                    <span className="status-badge" style={{ backgroundColor: statusStyle.bg, color: statusStyle.color }}>
                      {statusStyle.text}
                    </span>
                  </div>
                  <div className="job-location">
                    📍 {job?.place_of_assignment || 'N/A'}
                  </div>
                  <div className="job-details">
                    <span>📅 Applied: {formatDate(app.applied_date)}</span>
                    <span>💰 Salary Grade {job?.salary_grade || 'N/A'}</span>
                    {displayScore !== null && displayScore !== undefined && (
                      <span style={{ 
                        background: displayScore >= 80 ? '#e8f5e9' : displayScore >= 60 ? '#fff3e0' : '#ffebee',
                        color: displayScore >= 80 ? '#2e7d32' : displayScore >= 60 ? '#e65100' : '#c62828',
                        padding: '2px 10px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}>
                        Score: {displayScore}% {requirementsMet && `(${requirementsMet} met)`}
                      </span>
                    )}
                  </div>

                  <div className="documents-section">
                    <div className="documents-title">Required Documents</div>
                    <div className="documents-list">
                      <span className="doc-item">
                        {getDocumentStatus(app.docs_submitted, 'pds') ? 
                          <span className="doc-check">✓ PDS</span> : 
                          <span className="doc-missing">✗ PDS</span>}
                      </span>
                      {job?.required_docs?.transcriptRecords && (
                        <span className="doc-item">
                          {getDocumentStatus(app.docs_submitted, 'transcript') ? 
                            <span className="doc-check">✓ Transcript</span> : 
                            <span className="doc-missing">✗ Transcript</span>}
                        </span>
                      )}
                      {job?.required_docs?.performanceRating && (
                        <span className="doc-item">
                          {getDocumentStatus(app.docs_submitted, 'performanceRating') ? 
                            <span className="doc-check">✓ Performance Rating</span> : 
                            <span className="doc-missing">✗ Performance Rating</span>}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="card-actions">
                    <button className="view-btn" onClick={() => {
                      setSelectedApplication(app);
                      setShowDetailsModal(true);
                    }}>
                      View Details
                    </button>
                    {canWithdrawApp && (
                      <button 
                        className="withdraw-btn" 
                        onClick={() => handleWithdraw(app)}
                        disabled={withdrawing}
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal */}
      {showDetailsModal && selectedApplication && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Application Details</h3>
              <button className="close-modal" onClick={() => setShowDetailsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <h4>Position Information</h4>
                <div className="detail-grid">
                  <div><span className="detail-label">Position Title</span><span className="detail-value">{selectedApplication.job_postings?.position_title}</span></div>
                  <div><span className="detail-label">Place of Assignment</span><span className="detail-value">{selectedApplication.job_postings?.place_of_assignment}</span></div>
                  <div><span className="detail-label">Item No.</span><span className="detail-value">{selectedApplication.job_postings?.item_no || 'N/A'}</span></div>
                  <div><span className="detail-label">Salary Grade</span><span className="detail-value">{selectedApplication.job_postings?.salary_grade || 'N/A'}</span></div>
                  <div><span className="detail-label">Monthly Salary</span><span className="detail-value">{formatSalary(selectedApplication.job_postings?.monthly_salary)}</span></div>
                  <div><span className="detail-label">Closing Date</span><span className="detail-value">{formatDate(selectedApplication.job_postings?.closing_date)}</span></div>
                </div>
              </div>

              {/* AI Assessment */}
              {selectedApplication.ai_match_score && (
                <div className="detail-section">
                  <h4>AI Assessment</h4>
                  
                  <div className="ai-assessment-section">
                    <div style={{ marginBottom: '12px' }}>
                      <span style={{ fontSize: '12px', color: '#6c757d' }}>Suitability Score</span>
                      <div className="ai-score-large">
                        {selectedApplication.ai_explanation?.percentage || selectedApplication.ai_match_score}%
                      </div>
                      {selectedApplication.ai_explanation?.requirements_met && (
                        <div className="ai-score-subtitle">
                          {selectedApplication.ai_explanation.requirements_met} requirements met
                        </div>
                      )}
                    </div>

                    {/* Breakdown */}
                    {selectedApplication.ai_explanation?.breakdown && Object.keys(selectedApplication.ai_explanation.breakdown).length > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px' }}>Breakdown</div>
                        {Object.entries(selectedApplication.ai_explanation.breakdown).map(([key, value]) => {
                          // Skip if NOT REQUIRED
                          if (value.status && value.status.toUpperCase().includes('NOT REQUIRED')) {
                            return null;
                          }
                          // Use the helper function to check if requirement is met
                          const isMet = isRequirementMet(value);
                          const displayText = getBreakdownDisplay(key, value);
                          // Get progress percentage for display
                          const progressPercent = value.progress ? Math.round(value.progress * 100) : 0;
                          return (
                            <div key={key} className="breakdown-item">
                              <span>{key}</span>
                              <span className={isMet ? 'breakdown-met' : 'breakdown-partial'}>
                                {displayText} ({progressPercent}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Summary - Applicant-facing */}
                    {selectedApplication.ai_explanation?.summary && (
                      <div style={{ marginTop: '8px', fontSize: '13px', color: '#6c757d' }}>
                        {selectedApplication.ai_explanation.summary}
                      </div>
                    )}

                    {/* Recommendations */}
                    {selectedApplication.ai_explanation?.recommendations && selectedApplication.ai_explanation.recommendations.length > 0 && (
                      <div className="ai-recommendations">
                        <div style={{ fontWeight: 600 }}>Recommendations</div>
                        <ul>
                          {selectedApplication.ai_explanation.recommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Qualifications Required */}
              <div className="detail-section">
                <h4>Qualifications Required</h4>
                <div className="detail-grid">
                  <div>
                    <span className="detail-label">Education</span>
                    <span className="detail-value">
                      {getEducationLabel(selectedApplication.job_postings?.qualifications?.education)}
                    </span>
                  </div>
                  <div>
                    <span className="detail-label">Eligibility</span>
                    <span className="detail-value">
                      {getEligibilityLabel(selectedApplication.job_postings?.qualifications?.eligibility)}
                    </span>
                  </div>
                  <div>
                    <span className="detail-label">Training</span>
                    <span className="detail-value">
                      {getTrainingLabel(selectedApplication.job_postings?.qualifications?.training)}
                    </span>
                  </div>
                  <div>
                    <span className="detail-label">Work Experience</span>
                    <span className="detail-value">
                      {getExperienceLabel(selectedApplication.job_postings?.qualifications?.workExperience)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Application Status</h4>
                <div className="detail-grid">
                  <div><span className="detail-label">Current Status</span><span className="detail-value">{selectedApplication.status}</span></div>
                  <div><span className="detail-label">Date Applied</span><span className="detail-value">{formatDate(selectedApplication.applied_date)}</span></div>
                  <div><span className="detail-label">Last Updated</span><span className="detail-value">{formatDate(selectedApplication.updated_at)}</span></div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Documents Submitted</h4>
                <div className="documents-list">
                  {selectedApplication.docs_submitted?.pds && <span className="doc-check">✓ Personal Data Sheet (PDS)</span>}
                  {selectedApplication.docs_submitted?.transcript && <span className="doc-check">✓ Transcript of Records</span>}
                  {selectedApplication.docs_submitted?.performanceRating && <span className="doc-check">✓ Performance Rating</span>}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button className="close-btn" onClick={() => setShowDetailsModal(false)} style={{ flex: 1, padding: '10px', background: 'white', border: '1px solid #dee2e6', borderRadius: '8px', cursor: 'pointer', fontWeight: 500 }}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}