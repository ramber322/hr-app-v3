import { supabase } from '../lib/supabase';

// Create a new job posting
export const createJobPosting = async (jobData) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('You must be logged in to post a job');
    }
    
    // Check if user is HR
    const userRole = user.user_metadata?.role;
    if (userRole !== 'hr') {
      throw new Error('Only HR personnel can post jobs');
    }
    
    // Format the data for database (using separate columns now)
    const formattedData = {
      position_title: jobData.positionTitle,
      place_of_assignment: jobData.placeOfAssignment,
      item_no: jobData.itemNo,
      salary_grade: parseInt(jobData.salaryGrade) || null,
      monthly_salary: parseFloat(jobData.monthlySalary) || null,
      opening_date: jobData.openingDate,
      closing_date: jobData.closingDate,
      status: jobData.status || 'OPEN',
      
      // Separate qualification columns (not JSONB anymore)
      required_education: jobData.qualifications?.education || "None Required",
      required_eligibility: jobData.qualifications?.eligibility || "None Required",
      required_training: jobData.qualifications?.training || "None Required",
      required_work_experience: jobData.qualifications?.workExperience || "None Required",
      required_competency: jobData.qualifications?.competency || "N/A",
      
      instructions: jobData.instructions,
      required_docs: jobData.requiredDocs,
      applicants_count: 0,
      created_by: user.id
    };
    
    const { data, error } = await supabase
      .from('job_postings')
      .insert([formattedData])
      .select();
    
    if (error) throw error;
    
    return { success: true, data: data[0] };
  } catch (error) {
    console.error('Error creating job posting:', error);
    return { success: false, error: error.message };
  }
};

// Get all job postings
export const getJobPostings = async () => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const userRole = user?.user_metadata?.role;
    
    let query = supabase.from('job_postings').select('*');
    
    // Applicants can only see OPEN jobs
    if (userRole === 'applicant') {
      query = query.eq('status', 'OPEN');
    }
    
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Transform snake_case back to camelCase for frontend
    const transformedData = data?.map(job => ({
      id: job.id,
      position_title: job.position_title,
      place_of_assignment: job.place_of_assignment,
      item_no: job.item_no,
      salary_grade: job.salary_grade,
      monthly_salary: job.monthly_salary,
      opening_date: job.opening_date,
      closing_date: job.closing_date,
      status: job.status,
      qualifications: {
        education: job.required_education,
        eligibility: job.required_eligibility,
        training: job.required_training,
        workExperience: job.required_work_experience,
        competency: job.required_competency
      },
      instructions: job.instructions,
      required_docs: job.required_docs,
      applicants_count: job.applicants_count,
      created_at: job.created_at
    }));
    
    return { success: true, data: transformedData || [] };
  } catch (error) {
    console.error('Error fetching job postings:', error);
    return { success: false, error: error.message, data: [] };
  }
};

// Update job status based on closing date
export const updateJobStatuses = async () => {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    const { error } = await supabase
      .from('job_postings')
      .update({ status: 'CLOSED' })
      .lt('closing_date', today)
      .eq('status', 'OPEN');
    
    if (error) throw error;
    
    return { success: true };
  } catch (error) {
    console.error('Error updating job statuses:', error);
    return { success: false, error: error.message };
  }
};

// Get a single job posting by ID
export const getJobPostingById = async (id) => {
  try {
    const { data, error } = await supabase
      .from('job_postings')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    return { 
      success: true, 
      data: {
        id: data.id,
        position_title: data.position_title,
        place_of_assignment: data.place_of_assignment,
        item_no: data.item_no,
        salary_grade: data.salary_grade,
        monthly_salary: data.monthly_salary,
        opening_date: data.opening_date,
        closing_date: data.closing_date,
        status: data.status,
        qualifications: {
          education: data.required_education,
          eligibility: data.required_eligibility,
          training: data.required_training,
          workExperience: data.required_work_experience,
          competency: data.required_competency
        },
        instructions: data.instructions,
        required_docs: data.required_docs,
        applicants_count: data.applicants_count
      }
    };
  } catch (error) {
    console.error('Error fetching job posting:', error);
    return { success: false, error: error.message };
  }
};