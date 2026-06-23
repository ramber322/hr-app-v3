import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import { getJobPostings } from "../services/jobService";
import '../styles/BrowseJobsPage.css';

// =========================
// PYTHON API URL
// =========================
const API_URL = "http://127.0.0.1:8000";

export default function BrowseJobsPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("All");
  const [selectedJob, setSelectedJob] = useState(null);
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applicant, setApplicant] = useState(null);
  const [appliedJobs, setAppliedJobs] = useState({});
  const [screeningResult, setScreeningResult] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [successData, setSuccessData] = useState(null);
  
  const [application, setApplication] = useState({
    coverLetter: "",
    documents: {}
  });

  // =========================
  // EDUCATION & ELIGIBILITY LABELS
  // =========================
  const EDUCATION_LABELS = {
    0: "None Required",
    1: "Elementary Graduate",
    2: "High School Graduate",
    3: "2-Year College / Associate",
    4: "Bachelor's Degree",
    5: "Master's Degree"
  };

  const ELIGIBILITY_LABELS = {
    "none": "None Required",
    "subprofessional": "Career Service Subprofessional",
    "professional": "Career Service Professional"
  };

  const getEducationLabel = (value) => {
    if (value === undefined || value === null) return 'None Required';
    return EDUCATION_LABELS[value] || `Level ${value}`;
  };

  const getEligibilityLabel = (value) => {
    if (!value || value === 'none') return 'None Required';
    return ELIGIBILITY_LABELS[value] || value;
  };

  const getExperienceLabel = (value) => {
    if (!value || value === 0 || value === 'None Required') return 'None Required';
    const years = parseInt(value) || 0;
    if (years === 0) return 'None Required';
    return years === 1 ? `${years} year` : `${years} years`;
  };

  const getTrainingLabel = (value) => {
    if (!value || value === 'None Required' || value === 0) return 'None Required';
    const hours = parseInt(value) || 0;
    if (hours === 0) return 'None Required';
    return hours === 1 ? `${hours} hour` : `${hours} hours`;
  };

  useEffect(() => {
    const getApplicant = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setApplicant(user);
        await loadAppliedJobs(user.id);
      } else {
        navigate('/login');
      }
    };
    getApplicant();
  }, [navigate]);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    setLoading(true);
    const result = await getJobPostings();
    if (result.success) {
      setJobs(result.data);
    }
    setLoading(false);
  };

  const loadAppliedJobs = async (applicantId) => {
    try {
      const { data, error } = await supabase
        .from('applications')
        .select('job_id, status')
        .eq('applicant_id', applicantId)
        .neq('status', 'WITHDRAWN');
      
      if (error) {
        console.error('Error loading applied jobs:', error);
        return;
      }
      
      if (data) {
        const appliedMap = {};
        data.forEach(app => {
          appliedMap[app.job_id] = true;
        });
        setAppliedJobs(appliedMap);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // =========================
  // DETECT JOB CATEGORY
  // =========================
  const detectJobCategory = (positionTitle) => {
    const title = positionTitle.toLowerCase();
    if (title.includes('it') || title.includes('information technology') || title.includes('developer') || title.includes('tech')) return 'it';
    if (title.includes('engineer')) return 'engineering';
    if (title.includes('account') || title.includes('budget') || title.includes('finance')) return 'finance';
    if (title.includes('admin') || title.includes('clerk') || title.includes('officer')) return 'administrative';
    if (title.includes('building') || title.includes('construction') || title.includes('inspector')) return 'construction';
    if (title.includes('utility') || title.includes('mechanic') || title.includes('technician')) return 'technical';
    if (title.includes('information') || title.includes('media') || title.includes('communication')) return 'communications';
    if (title.includes('social') || title.includes('community') || title.includes('welfare')) return 'social_services';
    if (title.includes('planning') || title.includes('development')) return 'planning';
    if (title.includes('sports') || title.includes('recreation')) return 'sports';
    if (title.includes('agriculture') || title.includes('veterinary') || title.includes('slaughterhouse')) return 'agriculture';
    return 'administrative';
  };

  // =========================
  // SCREEN PDS WITH PYTHON API
  // =========================
  const screenPDSWithAPI = async (pdsFile, job) => {
    let educationValue = job.qualifications?.education || 3;
    let experienceValue = job.qualifications?.workExperience || 1;
    let trainingValue = job.qualifications?.training || 4;
    const eligibilityValue = job.qualifications?.eligibility || "professional";

    if (educationValue === "None Required" || educationValue === "" || educationValue === null) {
      educationValue = 0;
    } else {
      educationValue = parseInt(educationValue) || 0;
    }

    if (experienceValue === "None Required" || experienceValue === "" || experienceValue === null) {
      experienceValue = 0;
    } else {
      experienceValue = parseInt(experienceValue) || 0;
    }

    if (trainingValue === "None Required" || trainingValue === "" || trainingValue === null) {
      trainingValue = 0;
    } else {
      trainingValue = parseInt(trainingValue) || 0;
    }

    const formData = new FormData();
    formData.append('file', pdsFile);

    const params = new URLSearchParams({
      position_title: job.position_title || "Position",
      job_category: detectJobCategory(job.position_title),
      education: educationValue,
      experience: experienceValue,
      training_hours: trainingValue,
      eligibility_level: eligibilityValue
    });

    console.log('📤 Sending to API:', {
      url: `${API_URL}/upload-pds?${params}`,
      education: educationValue,
      experience: experienceValue,
      training_hours: trainingValue,
      eligibility_level: eligibilityValue
    });

    try {
      const response = await fetch(`${API_URL}/upload-pds?${params}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error (${response.status}): ${errorText}`);
      }

      const result = await response.json();
      console.log('📥 API Response:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error screening PDS:', error);
      throw error;
    }
  };

  const handleViewDetails = (job) => {
    setSelectedJob(job);
    setScreeningResult(null);
    setShowResults(false);
    setShowSuccessPopup(false);
    
    const requiredDocs = job.required_docs || {};
    const initialDocs = {};
    
    // Always include PDS
    initialDocs.pds = null;
    
    // Check each required document type
    if (requiredDocs.transcriptRecords) initialDocs.transcript = null;
    if (requiredDocs.performanceRating) initialDocs.performanceRating = null;
    
    setApplication({
      coverLetter: "",
      documents: initialDocs
    });
    setShowJobDetailsModal(true);
  };

  const handleFileChange = (e, docType) => {
    const file = e.target.files[0];
    if (file) {
      setApplication({
        ...application,
        documents: {
          ...application.documents,
          [docType]: file
        }
      });
    }
  };

  const handleRemoveFile = (docType) => {
    setApplication({
      ...application,
      documents: {
        ...application.documents,
        [docType]: null
      }
    });
  };

  // =============================================
  // UPLOAD FILE - RETURNS BOTH URL AND FILENAME
  // =============================================
  const uploadFile = async (file, folder, docType) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${docType}_${Date.now()}.${fileExt}`;
    const filePath = `${folder}/${fileName}`;
    
    const { error } = await supabase.storage
      .from('applicant_docs')
      .upload(filePath, file);
    
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
      .from('applicant_docs')
      .getPublicUrl(filePath);
    
    return { publicUrl, fileName };
  };

  const getOrCreateApplicant = async (user) => {
    const { data: existing } = await supabase
      .from('applicants')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (existing) return existing;
    
    const { data: newApplicant, error } = await supabase
      .from('applicants')
      .insert([{
        id: user.id,
        full_name: user.user_metadata?.full_name || user.email,
        email: user.email,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();
    
    if (error) throw error;
    return newApplicant;
  };

  // =========================
  // HANDLE SUBMIT APPLICATION WITH API INTEGRATION
  // =========================
  const handleSubmitApplication = async () => {
    if (!applicant) {
      alert("Please login to apply");
      return;
    }

    setSubmitting(true);
    setScreeningResult(null);
    setShowResults(false);

    try {
      // STEP 1: Check if already applied
      const { data: existingApp, error: checkError } = await supabase
        .from('applications')
        .select('id, status')
        .eq('job_id', selectedJob.id)
        .eq('applicant_id', applicant.id)
        .maybeSingle();

      if (checkError) {
        console.error('Error checking existing application:', checkError);
        alert('Error checking application status. Please try again.');
        setSubmitting(false);
        return;
      }

      if (existingApp) {
        if (existingApp.status === 'WITHDRAWN') {
          // STEP 1: Validate PDS file
          const pdsFile = application.documents.pds;
          if (!pdsFile) {
            alert('Please upload your Personal Data Sheet (PDS)');
            setSubmitting(false);
            return;
          }

          // STEP 2: Screen PDS with Python API (RE-RUN AI)
          let screeningResult;
          try {
            screeningResult = await screenPDSWithAPI(pdsFile, selectedJob);
          } catch (apiError) {
            alert('Error screening PDS: ' + apiError.message);
            setSubmitting(false);
            return;
          }

          if (!screeningResult.success) {
            alert('Error screening PDS: ' + (screeningResult.error || 'Unknown error'));
            setSubmitting(false);
            return;
          }

          // STEP 3: Save screening result
          setScreeningResult(screeningResult);

          // STEP 4: Upload new documents and store filenames
          const uploadedDocs = {};
          const docFileNames = {};
          
          for (const [docType, file] of Object.entries(application.documents)) {
            if (file && docType !== 'pds') {
              const result = await uploadFile(file, `${selectedJob.id}/${applicant.id}`, docType);
              uploadedDocs[docType] = result.publicUrl;
              docFileNames[docType] = result.fileName;
            }
          }
          
          // Upload PDS
          if (application.documents.pds) {
            const result = await uploadFile(application.documents.pds, `${selectedJob.id}/${applicant.id}`, 'pds');
            docFileNames.pds = result.fileName;
          }
          
          const docsSubmitted = {};
          for (const [docType, file] of Object.entries(application.documents)) {
            docsSubmitted[docType] = file !== null;
          }

          // STEP 5: Update the existing application with new data
          const { error: updateError } = await supabase
            .from('applications')
            .update({ 
              status: 'PENDING',
              docs_submitted: docsSubmitted,
              doc_filenames: docFileNames,
              applied_date: new Date().toISOString(),
              ai_match_score: screeningResult.fit_analysis?.percentage || 0,
              ai_explanation: {
                verdict: screeningResult.fit_analysis?.verdict || 'NOT FIT',
                breakdown: screeningResult.fit_analysis?.breakdown || {},
                requirements_met: screeningResult.fit_analysis?.requirements_met || '0/0',
                score: screeningResult.fit_analysis?.percentage || 0,
                binary_percentage: screeningResult.fit_analysis?.binary_percentage || 0,
                summary: screeningResult.explanation?.summary || '',
                feature_breakdown: screeningResult.explanation?.feature_breakdown || [],
                recommendations: screeningResult.explanation?.recommendations || [],
                verdict_description: screeningResult.explanation?.verdict_description || ''
              },
              updated_at: new Date().toISOString()
            })
            .eq('id', existingApp.id);

          if (updateError) {
            console.error('Error re-activating application:', updateError);
            alert('Error re-submitting application. Please try again.');
            setSubmitting(false);
            return;
          }

          // STEP 6: Update applicants count
          const { data: currentJob } = await supabase
            .from('job_postings')
            .select('applicants_count')
            .eq('id', selectedJob.id)
            .single();

          const newCount = (currentJob?.applicants_count || 0) + 1;
          await supabase
            .from('job_postings')
            .update({ applicants_count: newCount })
            .eq('id', selectedJob.id);

          // STEP 7: Show success popup
          const score = screeningResult.fit_analysis?.percentage || 0;
          const requirementsMet = screeningResult.fit_analysis?.requirements_met || '0/0';
          
          setSuccessData({
            positionTitle: selectedJob.position_title,
            score: score,
            requirementsMet: requirementsMet
          });
          setShowSuccessPopup(true);
          
          setShowJobDetailsModal(false);
          await loadAppliedJobs(applicant.id);
          setSubmitting(false);
          return;
        }

        alert('You have already applied for this position.');
        setSubmitting(false);
        return;
      }

      // STEP 2: Validate PDS file
      const pdsFile = application.documents.pds;
      if (!pdsFile) {
        alert('Please upload your Personal Data Sheet (PDS)');
        setSubmitting(false);
        return;
      }

      // STEP 3: Screen PDS with Python API
      let screeningResult;
      try {
        screeningResult = await screenPDSWithAPI(pdsFile, selectedJob);
      } catch (apiError) {
        alert('Error screening PDS: ' + apiError.message);
        setSubmitting(false);
        return;
      }

      if (!screeningResult.success) {
        alert('Error screening PDS: ' + (screeningResult.error || 'Unknown error'));
        setSubmitting(false);
        return;
      }

      // STEP 4: Save screening result
      setScreeningResult(screeningResult);

      // STEP 5: Get or create applicant record
      const applicantRecord = await getOrCreateApplicant(applicant);
      
      // STEP 6: Upload documents and store filenames
      const uploadedDocs = {};
      const docFileNames = {};
      
      for (const [docType, file] of Object.entries(application.documents)) {
        if (file && docType !== 'pds') {
          const result = await uploadFile(file, `${selectedJob.id}/${applicant.id}`, docType);
          uploadedDocs[docType] = result.publicUrl;
          docFileNames[docType] = result.fileName;
        }
      }
      
      // Upload PDS
      if (application.documents.pds) {
        const result = await uploadFile(application.documents.pds, `${selectedJob.id}/${applicant.id}`, 'pds');
        docFileNames.pds = result.fileName;
      }
      
      const docsSubmitted = {};
      for (const [docType, file] of Object.entries(application.documents)) {
        docsSubmitted[docType] = file !== null;
      }
      
      // STEP 7: Create application record with AI results
      const { error: appError } = await supabase
        .from('applications')
        .insert([{
          job_id: selectedJob.id,
          applicant_id: applicantRecord.id,
          status: 'PENDING',
          docs_submitted: docsSubmitted,
          doc_filenames: docFileNames,
          applied_date: new Date().toISOString(),
          ai_match_score: screeningResult.fit_analysis?.percentage || 0,
          ai_explanation: {
            verdict: screeningResult.fit_analysis?.verdict || 'NOT FIT',
            breakdown: screeningResult.fit_analysis?.breakdown || {},
            requirements_met: screeningResult.fit_analysis?.requirements_met || '0/0',
            score: screeningResult.fit_analysis?.percentage || 0,
            binary_percentage: screeningResult.fit_analysis?.binary_percentage || 0,
            summary: screeningResult.explanation?.summary || '',
            feature_breakdown: screeningResult.explanation?.feature_breakdown || [],
            recommendations: screeningResult.explanation?.recommendations || [],
            verdict_description: screeningResult.explanation?.verdict_description || ''
          }
        }]);
      
      if (appError) throw appError;
      
      // STEP 8: Update applicants count
      await supabase
        .from('job_postings')
        .update({ applicants_count: (selectedJob.applicants_count || 0) + 1 })
        .eq('id', selectedJob.id);
      
      await loadAppliedJobs(applicant.id);
      
      // STEP 9: Show success popup
      const score = screeningResult.fit_analysis?.percentage || 0;
      const requirementsMet = screeningResult.fit_analysis?.requirements_met || '0/0';
      
      setSuccessData({
        positionTitle: selectedJob.position_title,
        score: score,
        requirementsMet: requirementsMet
      });
      setShowSuccessPopup(true);
      
      setShowJobDetailsModal(false);
      setScreeningResult(null);
      setShowResults(false);
      
    } catch (error) {
      console.error("Error submitting application:", error);
      alert("Error submitting application: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const locations = [...new Set(jobs.map(job => job.place_of_assignment))];
  
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.position_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          job.place_of_assignment?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = selectedLocation === "All" || job.place_of_assignment === selectedLocation;
    return matchesSearch && matchesLocation;
  });

  // =========================
  // RENDER RESULTS (for screening results)
  // =========================
  const renderResults = () => {
    if (!screeningResult) return null;
    
    const { fit_analysis, explanation } = screeningResult;
    const breakdown = fit_analysis?.breakdown || {};
    const score = fit_analysis?.percentage || 0;
    const requirementsMet = fit_analysis?.requirements_met || '0/0';
    
    return (
      <div className="result-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div>
            <div className="score">{score}%</div>
            <div style={{ fontSize: '14px', color: '#6c757d' }}>AI Match Score</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', color: '#6c757d' }}>Requirements Met</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{requirementsMet}</div>
          </div>
        </div>
        
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontWeight: 600, marginBottom: '8px' }}>📊 Breakdown</div>
          {Object.entries(breakdown).map(([key, value]) => {
            const status = value.status || '';
            const isMet = status.includes('MET') || status.includes('EXCEEDS');
            return (
              <div key={key} className="breakdown-item">
                <span>{key}</span>
                <span className={isMet ? 'status-met' : 'status-not-met'}>
                  {isMet ? '✅' : '❌'} {status}
                </span>
              </div>
            );
          })}
        </div>
        
        {explanation?.recommendations && explanation.recommendations.length > 0 && (
          <div className="recommendations">
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>💡 Recommendations</div>
            <ul style={{ margin: 0, paddingLeft: '20px' }}>
              {explanation.recommendations.map((rec, idx) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div style={{ marginTop: '12px', fontSize: '13px', color: '#6c757d' }}>
          {explanation?.summary || ''}
        </div>
      </div>
    );
  };

  // =========================
  // RENDER RESULTS (for already applied modal)
  // =========================
  const renderAlreadyAppliedSummary = () => {
    return (
      <div className="already-applied-banner">
        <div>⚠️ You have already applied to this position.</div>
        <div className="sub-text">
          You can view your full application details and AI assessment in the My Applications page.
        </div>
      </div>
    );
  };

  // =========================
  // SUCCESS POPUP
  // =========================
  const SuccessPopup = () => {
    if (!showSuccessPopup || !successData) return null;
    
    const { positionTitle, score, requirementsMet } = successData;
    
    return (
      <div className="success-popup-overlay" onClick={() => setShowSuccessPopup(false)}>
        <div className="success-popup" onClick={(e) => e.stopPropagation()}>
          <div className="icon">✅</div>
          <h2>Application Submitted!</h2>
          <p className="sub-text">
            Your application for <strong>"{positionTitle}"</strong> has been submitted successfully.
          </p>
          
          <div className="score-summary">
            <div className="item">
              <div className="value">{score}%</div>
              <div className="label">AI Match Score</div>
            </div>
            <div className="item">
              <div className="value">{requirementsMet}</div>
              <div className="label">Requirements Met</div>
            </div>
          </div>
          
          <div className="popup-actions">
            <button className="ok-btn" onClick={() => setShowSuccessPopup(false)}>
              OK
            </button>
            <button 
              className="view-btn" 
              onClick={() => {
                setShowSuccessPopup(false);
                navigate('/applicant/applications');
              }}
            >
              📋 View My Applications
            </button>
          </div>
        </div>
      </div>
    );
  };

  const FileUploadField = ({ label, docType, jobRequires }) => {
    if (!jobRequires && docType !== 'pds') return null;
    
    const hasFile = application.documents[docType] !== null && application.documents[docType] !== undefined;
    
    return (
      <div className="form-group">
        <label>{label}</label>
        <div className="file-upload-container">
          {!hasFile ? (
            <div className="file-upload-box">
              <input
                id={`file-${docType}`}
                type="file"
                className="file-input-hidden"
                accept=".pdf,.xlsx,.xls,.docx"
                onChange={(e) => handleFileChange(e, docType)}
                disabled={appliedJobs[selectedJob?.id]}
              />
              <label htmlFor={`file-${docType}`} className="file-upload-label">
                📁 Choose File
              </label>
              <span className="file-name-placeholder">No file chosen</span>
            </div>
          ) : (
            <div className="file-uploaded-box">
              <span className="file-icon">📄</span>
              <span className="file-uploaded-name">{application.documents[docType].name}</span>
              <button 
                type="button" 
                className="file-remove-btn"
                onClick={() => handleRemoveFile(docType)}
                disabled={appliedJobs[selectedJob?.id]}
              >
                ✗ Remove
              </button>
            </div>
          )}
        </div>
        {docType === 'pds' && (
          <small>Upload your PDS (Excel or Word format). Accepted: .xlsx, .xls, .docx</small>
        )}
      </div>
    );
  };

  return (
    <>
      <Navbar userRole="applicant" />
      
      <div className="browse-container">
        <div className="page-header">
          <h1>Browse Job Vacancies</h1>
          <p>Find your next career opportunity in government service</p>
        </div>

        <div className="search-section">
          <input
            type="text"
            className="search-input"
            placeholder="Search by position title or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <select 
            className="filter-select"
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
          >
            <option value="All">All Locations</option>
            {locations.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>
        </div>

        <div className="jobs-grid">
          {loading ? (
            <div className="loading-state">Loading jobs...</div>
          ) : filteredJobs.length === 0 ? (
            <div className="empty-state">No job vacancies found</div>
          ) : (
            filteredJobs.map((job) => (
              <div key={job.id} className="job-card">
                <h3 className="job-title">{job.position_title}</h3>
                <div className="job-assignment">{job.place_of_assignment}</div>
                <div className="job-details">
                  <span className="job-detail-item">SG {job.salary_grade}</span>
                  <span className="job-detail-item">₱{job.monthly_salary?.toLocaleString()}</span>
                  <span className="job-detail-item">Item No: {job.item_no}</span>
                </div>
                <div className="job-deadline">
                  📅 Closing Date: {job.closing_date}
                </div>
                <div className="button-group">
                  <button 
                    className="view-details-btn" 
                    onClick={() => handleViewDetails(job)}
                  >
                    View Details
                  </button>
                  {appliedJobs[job.id] && (
                    <span className="applied-badge-btn">✅ Applied</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Success Popup */}
      <SuccessPopup />

      {showJobDetailsModal && selectedJob && (
        <div className="modal-overlay" onClick={() => setShowJobDetailsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedJob.position_title}</h3>
              <button className="close-modal" onClick={() => setShowJobDetailsModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <h4>Job Details</h4>
                <div className="detail-grid">
                  <div><span className="detail-label">Place of Assignment</span><span className="detail-value">{selectedJob.place_of_assignment}</span></div>
                  <div><span className="detail-label">Item No.</span><span className="detail-value">{selectedJob.item_no}</span></div>
                  <div><span className="detail-label">Salary Grade</span><span className="detail-value">{selectedJob.salary_grade}</span></div>
                  <div><span className="detail-label">Monthly Salary</span><span className="detail-value">₱{selectedJob.monthly_salary?.toLocaleString()}</span></div>
                  <div><span className="detail-label">Opening Date</span><span className="detail-value">{selectedJob.opening_date}</span></div>
                  <div><span className="detail-label">Closing Date</span><span className="detail-value">{selectedJob.closing_date}</span></div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Qualifications</h4>
                <div className="detail-grid">
                  <div>
                    <span className="detail-label">Education</span>
                    <span className="detail-value">{getEducationLabel(selectedJob.qualifications?.education)}</span>
                  </div>
                  <div>
                    <span className="detail-label">Eligibility</span>
                    <span className="detail-value">{getEligibilityLabel(selectedJob.qualifications?.eligibility)}</span>
                  </div>
                  <div>
                    <span className="detail-label">Training</span>
                    <span className="detail-value">{getTrainingLabel(selectedJob.qualifications?.training)}</span>
                  </div>
                  <div>
                    <span className="detail-label">Work Experience</span>
                    <span className="detail-value">{getExperienceLabel(selectedJob.qualifications?.workExperience)}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Required Documents</h4>
                <ul className="docs-list">
                  <li>Personal Data Sheet (PDS)</li>
                  {selectedJob.required_docs?.transcriptRecords && <li> Transcript of Records</li>}
                  {selectedJob.required_docs?.performanceRating && <li> Performance Rating</li>}
                </ul>
              </div>

              {selectedJob.instructions && (
                <div className="detail-section">
                  <h4>Instructions / Remarks</h4>
                  <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>{selectedJob.instructions}</p>
                </div>
              )}

              <hr />

              <div className="detail-section">
                <h4>Submit Your Application</h4>
                
                {appliedJobs[selectedJob.id] ? (
                  // === ALREADY APPLIED VIEW ===
                  <>
                    {renderAlreadyAppliedSummary()}
                    <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                      <button 
                        className="view-applications-btn"
                        style={{ flex: 1 }}
                        onClick={() => {
                          setShowJobDetailsModal(false);
                          navigate('/applicant/applications');
                        }}
                      >
                        📋 View My Applications
                      </button>
                      <button 
                        className="cancel-btn"
                        style={{ flex: 1 }}
                        onClick={() => setShowJobDetailsModal(false)}
                      >
                        Close
                      </button>
                    </div>
                  </>
                ) : (
                  // === NEW APPLICATION VIEW ===
                  <>
                    <div className="form-group">
                      <label>Cover Letter (Optional)</label>
                      <textarea 
                        rows="3" 
                        placeholder="Tell us why you're a great fit for this position..."
                        value={application.coverLetter}
                        onChange={(e) => setApplication({...application, coverLetter: e.target.value})}
                      />
                    </div>

                    <div className="required-docs-section">
                      <h4>📄 Upload Documents</h4>
                      <p className="info-text">Attach your documents below. PDS will be screened by AI.</p>
                      
                      <FileUploadField label="Personal Data Sheet (PDS) *" docType="pds" jobRequires={true} />
                      <FileUploadField 
                        label="Transcript of Records" 
                        docType="transcript" 
                        jobRequires={selectedJob.required_docs?.transcriptRecords} 
                      />
                      <FileUploadField 
                        label="Performance Rating" 
                        docType="performanceRating" 
                        jobRequires={selectedJob.required_docs?.performanceRating} 
                      />
                    </div>

                    {/* AI Screening Results - shown during submission */}
                    {showResults && renderResults()}

                    <div className="modal-actions">
                      <button className="cancel-btn" onClick={() => {
                        setShowJobDetailsModal(false);
                        setScreeningResult(null);
                        setShowResults(false);
                      }}>
                        {showResults ? 'Close' : 'Cancel'}
                      </button>
                      <button 
                        className="submit-btn" 
                        onClick={handleSubmitApplication} 
                        disabled={submitting}
                      >
                        {submitting ? "Processing..." : showResults ? "Submit Application" : "Submit Application"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}