import { supabase } from '../lib/supabase';

// Create a notification using the database function (bypasses RLS)
export const createNotification = async (userId, type, title, message, link = null) => {
  try {
    const { data, error } = await supabase
      .rpc('insert_notification', {
        p_user_id: userId,
        p_type: type,
        p_title: title,
        p_message: message,
        p_link: link
      });

    if (error) {
      console.error('Supabase RPC error:', error);
      throw error;
    }
    
    console.log('✅ Notification created:', data);
    return { success: true, data };
  } catch (error) {
    console.error('Error creating notification:', error);
    return { success: false, error: error.message };
  }
};

// Get all notifications for current user
export const getNotifications = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return { success: false, error: error.message };
  }
};

// Get unread count
export const getUnreadCount = async (userId) => {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return { success: true, count };
  } catch (error) {
    console.error('Error getting unread count:', error);
    return { success: false, error: error.message };
  }
};

// Mark a notification as read
export const markAsRead = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error: error.message };
  }
};

// Mark all as read
export const markAllAsRead = async (userId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error marking all as read:', error);
    return { success: false, error: error.message };
  }
};

// Delete a notification
export const deleteNotification = async (notificationId) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error deleting notification:', error);
    return { success: false, error: error.message };
  }
};

// Helper: Send notification when application status changes
export const notifyStatusChange = async (applicantId, jobTitle, oldStatus, newStatus) => {
  const statusLabels = {
    'PENDING': 'Pending Review',
    'REVIEWING': 'Under Review',
    'SHORTLISTED': 'Shortlisted',
    'INTERVIEW': 'Interview Scheduled',
    'HIRED': 'Hired',
    'REJECTED': 'Not Selected'
  };

  const title = `Application Status Updated`;
  const message = `Your application for "${jobTitle}" has been updated to ${statusLabels[newStatus] || newStatus}.`;
  const link = '/applicant/applications';

  console.log('📨 Creating notification for applicant:', applicantId);
  console.log('📨 Message:', message);

  return await createNotification(applicantId, 'status_update', title, message, link);
};

// Helper: Send notification for interview schedule
export const notifyInterviewScheduled = async (applicantId, jobTitle, interviewDate, interviewTime) => {
  const title = `Interview Scheduled`;
  const message = `You have been scheduled for an interview for "${jobTitle}" on ${interviewDate} at ${interviewTime}.`;
  const link = '/applicant/applications';

  return await createNotification(applicantId, 'interview_schedule', title, message, link);
};