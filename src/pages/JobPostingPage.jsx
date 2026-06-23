import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { createJobPosting, getJobPostings, updateJobStatuses } from "../services/jobService";
import '/src/styles/JobPostingPage.css';


// =========================
// POSITION TITLES (Combined with Level)
// =========================
const POSITION_TITLES = [
  "Administrative Assistant I",
  "Administrative Assistant II",
  "Administrative Assistant III",
  "Administrative Officer I",
  "Administrative Officer II",
  "Administrative Officer III",
  "Administrative Officer IV",
  "Assessment Clerk I",
  "Assessment Clerk II",
  "Building Inspector I",
  "Building Inspector II",
  "Clerk I",
  "Clerk II",
  "Clerk III",
  "Community Affairs Officer I",
  "Community Affairs Officer II",
  "Information Officer I",
  "Information Officer II",
  "Information Officer III",
  "Information Technology Officer I",
  "Information Technology Officer II",
  "Information Technology Officer III",
  "Utility Worker I",
  "Utility Worker II"
];

// =========================
// POSITION TITLE → SALARY GRADE MAPPING
// =========================
const POSITION_SG_MAPPING = {
  "Administrative Assistant I": 8,
  "Administrative Assistant II": 10,
  "Administrative Assistant III": 12,
  "Administrative Officer I": 11,
  "Administrative Officer II": 13,
  "Administrative Officer III": 15,
  "Administrative Officer IV": 17,
  "Assessment Clerk I": 4,
  "Assessment Clerk II": 6,
  "Building Inspector I": 11,
  "Building Inspector II": 13,
  "Clerk I": 3,
  "Clerk II": 5,
  "Clerk III": 7,
  "Community Affairs Officer I": 11,
  "Community Affairs Officer II": 13,
  "Information Officer I": 11,
  "Information Officer II": 13,
  "Information Officer III": 15,
  "Information Technology Officer I": 12,
  "Information Technology Officer II": 16,
  "Information Technology Officer III": 19,
  "Utility Worker I": 1,
  "Utility Worker II": 2
};

// =========================
// DBM SALARY TABLE (SG 1-33)
// =========================
const DBM_SALARY_TABLE = {
  1: 13000, 2: 14000, 3: 15000, 4: 16000, 5: 17000,
  6: 18000, 7: 19000, 8: 21000, 9: 23000, 10: 25000,
  11: 27000, 12: 29000, 13: 31000, 14: 34000, 15: 37000,
  16: 40000, 17: 43000, 18: 46000, 19: 50000, 20: 54000,
  21: 58000, 22: 62000, 23: 67000, 24: 72000, 25: 77000,
  26: 83000, 27: 89000, 28: 95000, 29: 102000, 30: 109000,
  31: 116000, 32: 124000, 33: 132000
};

// =========================
// EDUCATION OPTIONS
// =========================
const EDUCATION_OPTIONS = [
  { label: "None Required", value: 0 },
  { label: "Elementary Graduate", value: 1 },
  { label: "High School Graduate", value: 2 },
  { label: "2-Year College / Associate", value: 3 },
  { label: "Bachelor's Degree", value: 4 },
  { label: "Master's Degree", value: 5 }
];

// =========================
// EDUCATION LABELS (for display)
// =========================
const EDUCATION_LABELS = {
  0: "None Required",
  1: "Elementary Graduate",
  2: "High School Graduate",
  3: "2-Year College / Associate",
  4: "Bachelor's Degree",
  5: "Master's Degree"
};

// =========================
// ELIGIBILITY OPTIONS
// =========================
const ELIGIBILITY_OPTIONS = [
  { label: "None Required", value: "none" },
  { label: "Career Service Subprofessional", value: "subprofessional" },
  { label: "Career Service Professional", value: "professional" },
];

// =========================
// ELIGIBILITY LABELS (for display)
// =========================
const ELIGIBILITY_LABELS = {
  "none": "None Required",
  "subprofessional": "Career Service Subprofessional",
  "professional": "Career Service Professional"
};

// =========================
// EXPERIENCE OPTIONS
// =========================
const EXPERIENCE_OPTIONS = [
  { label: "None Required", value: 0 },
  { label: "1 year", value: 1 },
  { label: "2 years", value: 2 },
  { label: "3 years", value: 3 },
  { label: "4 years", value: 4 },
  { label: "5 years", value: 5 },
  { label: "6 years", value: 6 },
  { label: "7 years", value: 7 },
  { label: "8 years", value: 8 },
  { label: "9 years", value: 9 },
  { label: "10 years", value: 10 }
];

// =========================
// TRAINING OPTIONS
// =========================
const TRAINING_OPTIONS = [
  { label: "None Required", value: 0 },
  { label: "4 hours", value: 4 },
  { label: "8 hours", value: 8 },
  { label: "16 hours", value: 16 },
  { label: "24 hours", value: 24 },
  { label: "32 hours", value: 32 },
  { label: "40 hours", value: 40 },
  { label: "80 hours", value: 80 },
  { label: "120 hours", value: 120 }
];

// =========================
// LGU OFFICES / PLACE OF ASSIGNMENT OPTIONS
// =========================
const LGU_OFFICES = [
  "City Mayor's Office",
  "City Health Office",
  "City Administrator's Office",
  "City Social Welfare and Development Office",
  "City Budget Office",
  "City Public Information Office",
  "Iligan City Water Works System",
  "Barangay Affairs Office",
  "Senior Citizens Affairs Office",
  "Other (Specify)"
];

// =========================
// HELPER FUNCTIONS FOR DISPLAY
// =========================
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

export default function JobPostingPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showDetails, setShowDetails] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("All");
  const [showOtherInput, setShowOtherInput] = useState(false);
  
  const [newJob, setNewJob] = useState({
    positionTitle: "",
    placeOfAssignment: "",
    itemNo: "",
    salaryGrade: "",
    monthlySalary: 0,
    openingDate: new Date().toISOString().split("T")[0],
    closingDate: "",
    qualifications: {
      education: 4,
      eligibility: "professional",
      training: 0,
      workExperience: 0,
      competency: ""
    },
    instructions: "",
    requiredDocs: {
      pds: true,
      transcriptRecords: false,
      performanceRating: false
    }
  });

  useEffect(() => {
    loadJobPostings();
  }, []);

  const loadJobPostings = async () => {
    setLoading(true);
    await updateJobStatuses();
    const result = await getJobPostings();
    if (result.success) {
      setJobs(result.data);
    } else {
      console.error('Failed to load jobs:', result.error);
    }
    setLoading(false);
  };

  const handleAddJob = async () => {
    if (!newJob.positionTitle || !newJob.placeOfAssignment || !newJob.closingDate) {
      alert("Please fill in all required fields (*)");
      return;
    }
    
    const today = new Date().toISOString().split("T")[0];
    const closingDate = newJob.closingDate;
    const status = closingDate >= today ? "OPEN" : "CLOSED";
    
    const jobToSave = {
      ...newJob,
      status: status,
      monthlySalary: parseFloat(newJob.monthlySalary) || 0,
      salaryGrade: parseInt(newJob.salaryGrade) || 0,
      qualifications: {
        education: newJob.qualifications.education,
        eligibility: newJob.qualifications.eligibility,
        training: newJob.qualifications.training,
        workExperience: newJob.qualifications.workExperience,
        competency: newJob.qualifications.competency || "N/A"
      }
    };
    
    const result = await createJobPosting(jobToSave);
    
    if (result.success) {
      alert("Job posted successfully!");
      setShowForm(false);
      loadJobPostings();
      setNewJob({
        positionTitle: "",
        placeOfAssignment: "",
        itemNo: "",
        salaryGrade: "",
        monthlySalary: 0,
        openingDate: new Date().toISOString().split("T")[0],
        closingDate: "",
        qualifications: {
          education: 4,
          eligibility: "professional",
          training: 0,
          workExperience: 0,
          competency: ""
        },
        instructions: "",
        requiredDocs: {
          pds: true,
          transcriptRecords: false,
          performanceRating: false
        }
      });
      setShowOtherInput(false);
    } else {
      alert("Error posting job: " + result.error);
    }
  };

  const toggleRequiredDoc = (docName) => {
    setNewJob({
      ...newJob,
      requiredDocs: {
        ...newJob.requiredDocs,
        [docName]: !newJob.requiredDocs[docName]
      }
    });
  };

  const handlePositionTitleChange = (title) => {
    const sg = POSITION_SG_MAPPING[title] || "";
    const salary = sg ? DBM_SALARY_TABLE[sg] || 0 : 0;
    
    setNewJob({
      ...newJob,
      positionTitle: title,
      salaryGrade: sg,
      monthlySalary: salary
    });
  };

  const handlePlaceOfAssignmentChange = (value) => {
    if (value === "Other (Specify)") {
      setShowOtherInput(true);
      setNewJob({
        ...newJob,
        placeOfAssignment: ""
      });
    } else {
      setShowOtherInput(false);
      setNewJob({
        ...newJob,
        placeOfAssignment: value
      });
    }
  };

  // Get unique locations for filter
  const locations = [...new Set(jobs.map(job => job.place_of_assignment).filter(Boolean))];
  
  // Filter jobs based on search and location
  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.position_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          job.place_of_assignment?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = selectedLocation === "All" || job.place_of_assignment === selectedLocation;
    return matchesSearch && matchesLocation;
  });

  return (
    <>
      <Navbar userRole="hr" />
      
      <div className="jobs-container">
        <div className="jobs-header">
          <div>
            <h1>Job Postings</h1>
            <p>Find and manage all job vacancies</p>
          </div>
          <button className="add-btn" onClick={() => setShowForm(true)}>
            + Post New Job
          </button>
        </div>

        {/* Search and Filter Section */}
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
            <div className="empty-state">
              {jobs.length === 0 ? (
                <>
                  <p>No job postings yet.</p>
                  <p style={{ fontSize: 13, marginTop: 8 }}>Click "Post New Job" to get started.</p>
                </>
              ) : (
                <p>No jobs match your search criteria.</p>
              )}
            </div>
          ) : (
            filteredJobs.map((job) => (
              <div key={job.id} className="job-card">
                <div className={`job-status ${job.status === 'OPEN' ? 'status-open' : 'status-closed'}`}>
                  {job.status}
                </div>
                <h3 className="job-title">{job.position_title}</h3>
                <div className="job-assignment">{job.place_of_assignment}</div>
                <div className="job-details">
                  <span className="job-detail-item">SG {job.salary_grade}</span>
                  <span className="job-detail-item">₱{job.monthly_salary?.toLocaleString()}</span>
                  <span className="job-detail-item">Item No: {job.item_no}</span>
                </div>
                <div className="job-applicants">
                  📋 {job.applicants_count || 0} applicant(s) applied
                </div>
                <div className="job-deadline">
                  📅 Closing Date: {job.closing_date}
                </div>
                <div className="job-card-actions">
                  <button className="view-btn" onClick={() => setShowDetails(job)}>
                    View Details
                  </button>
                  <button 
                    className="view-candidates-btn" 
                    onClick={() => navigate(`/hr/jobs/${job.id}/candidates`)}
                  >
                    👥 View Candidates ({job.applicants_count || 0})
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Job Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Post New Job Vacancy</h2>
              <button className="close-modal" onClick={() => setShowForm(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Position Title *</label>
                <select
                  value={newJob.positionTitle}
                  onChange={(e) => handlePositionTitleChange(e.target.value)}
                  required
                >
                  <option value="">Select Position...</option>
                  {POSITION_TITLES.map((title) => (
                    <option key={title} value={title}>{title}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Place of Assignment *</label>
                <select
                  value={showOtherInput ? "Other (Specify)" : newJob.placeOfAssignment || ""}
                  onChange={(e) => handlePlaceOfAssignmentChange(e.target.value)}
                  required
                >
                  <option value="">Select Office/Department...</option>
                  {LGU_OFFICES.map((office) => (
                    <option key={office} value={office}>{office}</option>
                  ))}
                </select>
                {showOtherInput && (
                  <input
                    type="text"
                    className="other-input"
                    placeholder="Please specify office/department..."
                    value={newJob.placeOfAssignment}
                    onChange={(e) => setNewJob({...newJob, placeOfAssignment: e.target.value})}
                    style={{ marginTop: '8px', width: '100%', padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: '6px' }}
                    required
                  />
                )}
                <small>Select an office from the list or choose "Other (Specify)" to type manually</small>
              </div>

              <div className="form-group">
                <label>Item No.</label>
                <input 
                  type="text" 
                  placeholder="e.g., ICWS-025" 
                  value={newJob.itemNo}
                  onChange={(e) => setNewJob({...newJob, itemNo: e.target.value})} 
                />
              </div>

              <div className="form-group">
                <label>Salary Grade</label>
                <div className="salary-input-wrapper">
                  <input 
                    type="number" 
                    value={newJob.salaryGrade || ""}
                    readOnly
                    className="salary-input"
                    style={{ 
                      background: '#f3f4f6', 
                      cursor: 'not-allowed',
                      fontWeight: 'bold',
                      paddingRight: '140px'
                    }}
                  />
                  <span className="salary-display">
                    {newJob.monthlySalary > 0 && `₱${newJob.monthlySalary.toLocaleString()} / month`}
                  </span>
                </div>
                <small>Auto-filled based on position title</small>
              </div>

              <div className="form-group">
                <label>Closing Date *</label>
                <input 
                  type="date" 
                  value={newJob.closingDate}
                  onChange={(e) => setNewJob({...newJob, closingDate: e.target.value})} 
                />
                <small>Opening date is automatically set to today</small>
              </div>

              <div className="qualifications-section">
                <h4>📋 Qualifications</h4>
                
                <div className="form-group">
                  <label>Education</label>
                  <select
                    value={newJob.qualifications.education}
                    onChange={(e) => setNewJob({
                      ...newJob, 
                      qualifications: {...newJob.qualifications, education: parseInt(e.target.value)}
                    })}
                  >
                    {EDUCATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Eligibility</label>
                  <select
                    value={newJob.qualifications.eligibility}
                    onChange={(e) => setNewJob({
                      ...newJob, 
                      qualifications: {...newJob.qualifications, eligibility: e.target.value}
                    })}
                  >
                    {ELIGIBILITY_OPTIONS.map((opt, index) => (
                      <option key={index} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Training (in hours)</label>
                  <select
                    value={newJob.qualifications.training}
                    onChange={(e) => setNewJob({
                      ...newJob, 
                      qualifications: {...newJob.qualifications, training: parseInt(e.target.value)}
                    })}
                  >
                    {TRAINING_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Work Experience (in years)</label>
                  <select
                    value={newJob.qualifications.workExperience}
                    onChange={(e) => setNewJob({
                      ...newJob, 
                      qualifications: {...newJob.qualifications, workExperience: parseInt(e.target.value)}
                    })}
                  >
                    {EXPERIENCE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Instructions / Remarks</label>
                <textarea 
                  rows="3" 
                  placeholder="Application instructions..." 
                  value={newJob.instructions}
                  onChange={(e) => setNewJob({...newJob, instructions: e.target.value})} 
                />
              </div>

              <div className="form-group">
                <label>Required Documents</label>
                <div className="required-docs-section">
                  <div className="checkbox-group">
                    <input 
                      type="checkbox" 
                      checked={newJob.requiredDocs.pds} 
                      onChange={() => toggleRequiredDoc('pds')} 
                    />
                    <label>Personal Data Sheet (PDS)</label>
                  </div>
                  <div className="checkbox-group">
                    <input 
                      type="checkbox" 
                      checked={newJob.requiredDocs.transcriptRecords} 
                      onChange={() => toggleRequiredDoc('transcriptRecords')} 
                    />
                    <label>Transcript of Records</label>
                  </div>
                  <div className="checkbox-group">
                    <input 
                      type="checkbox" 
                      checked={newJob.requiredDocs.performanceRating} 
                      onChange={() => toggleRequiredDoc('performanceRating')} 
                    />
                    <label>Performance Rating</label>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button className="cancel-btn" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="save-btn" onClick={handleAddJob}>Post Job</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Job Details Modal */}
      {showDetails && (
        <div className="modal-overlay" onClick={() => setShowDetails(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{showDetails.position_title}</h2>
              <button className="close-modal" onClick={() => setShowDetails(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-section">
                <h4>Job Details</h4>
                <div className="detail-grid">
                  <div>
                    <span className="detail-label">Place of Assignment</span>
                    <span className="detail-value">{showDetails.place_of_assignment}</span>
                  </div>
                  <div>
                    <span className="detail-label">Item No.</span>
                    <span className="detail-value">{showDetails.item_no}</span>
                  </div>
                  <div>
                    <span className="detail-label">Salary Grade</span>
                    <span className="detail-value">{showDetails.salary_grade}</span>
                  </div>
                  <div>
                    <span className="detail-label">Monthly Salary</span>
                    <span className="detail-value">₱{showDetails.monthly_salary?.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="detail-label">Opening Date</span>
                    <span className="detail-value">{showDetails.opening_date}</span>
                  </div>
                  <div>
                    <span className="detail-label">Closing Date</span>
                    <span className="detail-value">{showDetails.closing_date}</span>
                  </div>
                  <div>
                    <span className="detail-label">Status</span>
                    <span className="detail-value">{showDetails.status}</span>
                  </div>
                  <div>
                    <span className="detail-label">Total Applicants</span>
                    <span className="detail-value">{showDetails.applicants_count || 0}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Qualifications</h4>
                <div className="detail-grid">
                  <div>
                    <span className="detail-label">Education</span>
                    <span className="detail-value">{getEducationLabel(showDetails.qualifications?.education)}</span>
                  </div>
                  <div>
                    <span className="detail-label">Eligibility</span>
                    <span className="detail-value">{getEligibilityLabel(showDetails.qualifications?.eligibility)}</span>
                  </div>
                  <div>
                    <span className="detail-label">Training</span>
                    <span className="detail-value">{getTrainingLabel(showDetails.qualifications?.training)}</span>
                  </div>
                  <div>
                    <span className="detail-label">Work Experience</span>
                    <span className="detail-value">{getExperienceLabel(showDetails.qualifications?.workExperience)}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h4>Required Documents</h4>
                <ul className="docs-list">
                  {showDetails.required_docs?.pds && <li>✓ Personal Data Sheet (PDS)</li>}
                  {showDetails.required_docs?.transcriptRecords && <li>✓ Transcript of Records</li>}
                  {showDetails.required_docs?.performanceRating && <li>✓ Performance Rating</li>}
                </ul>
              </div>

              {showDetails.instructions && (
                <div className="detail-section">
                  <h4>Instructions / Remarks</h4>
                  <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>{showDetails.instructions}</p>
                </div>
              )}

              <div className="modal-actions" style={{ marginTop: 24 }}>
                <button className="cancel-btn" onClick={() => setShowDetails(null)} style={{ flex: 1 }}>
                  Close
                </button>
                <button 
                  className="view-candidates-btn" 
                  onClick={() => {
                    setShowDetails(null);
                    navigate(`/hr/jobs/${showDetails.id}/candidates`);
                  }}
                  style={{ flex: 1 }}
                >
                  👥 View All Candidates ({showDetails.applicants_count || 0})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}