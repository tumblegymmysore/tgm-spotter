// js/notifications.js - Centralized notification system
import { supabaseClient, supabaseKey } from './config.js';

/**
 * Get notification logs for a student
 * @param {string} leadId - Student lead ID
 * @returns {Promise<Array>} Array of notification log entries
 */
export async function getNotificationLogs(leadId) {
    try {
        const { data: lead } = await supabaseClient
            .from('leads')
            .select('parent_note')
            .eq('id', leadId)
            .single();
        
        if (!lead || !lead.parent_note) return [];
        
        const logMatch = lead.parent_note.match(/\[NOTIFICATION_LOG\](.*?)\[\/NOTIFICATION_LOG\]/s);
        if (!logMatch) return [];
        
        try {
            const logs = JSON.parse(logMatch[1]);
            // Sort by timestamp descending (most recent first)
            return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        } catch (e) {
            console.warn('Could not parse notification logs', e);
            return [];
        }
    } catch (error) {
        console.error('Error fetching notification logs:', error);
        return [];
    }
}

/**
 * Log notification to database for auditing
 * @param {Object} logData - Notification log data
 */
async function logNotification(logData) {
    const { leadId, type, channel, subject, message, template, params, status, error } = logData;
    
    try {
        // Get current lead to update parent_note
        const { data: lead } = await supabaseClient
            .from('leads')
            .select('parent_note')
            .eq('id', leadId)
            .single();
        
        if (!lead) return;
        
        const existingNote = lead.parent_note || '';
        
        // Extract existing notification logs
        const logMatch = existingNote.match(/\[NOTIFICATION_LOG\](.*?)\[\/NOTIFICATION_LOG\]/s);
        let logs = [];
        if (logMatch) {
            try {
                logs = JSON.parse(logMatch[1]);
            } catch (e) {
                console.warn('Could not parse notification logs', e);
            }
        }
        
        // Add new log entry
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: type || 'notification', // 'status_change', 'attendance', 'reminder', 'package_update', etc.
            channel: channel, // 'email', 'whatsapp', 'both'
            subject: subject || '',
            message: message || '',
            template: template || '',
            params: params || {},
            status: status || 'sent', // 'sent', 'failed'
            error: error || null
        };
        
        logs.push(logEntry);
        
        // Keep only last 100 logs per student (prevent bloat)
        if (logs.length > 100) {
            logs = logs.slice(-100);
        }
        
        // Update parent_note with new logs
        const logsJson = JSON.stringify(logs);
        const logsBlock = `[NOTIFICATION_LOG]${logsJson}[/NOTIFICATION_LOG]`;
        const cleanedNote = existingNote.replace(/\[NOTIFICATION_LOG\].*?\[\/NOTIFICATION_LOG\]/s, '').trim();
        const updatedNote = cleanedNote ? `${cleanedNote}\n${logsBlock}` : logsBlock;
        
        await supabaseClient
            .from('leads')
            .update({ parent_note: updatedNote })
            .eq('id', leadId);
            
    } catch (error) {
        console.error('Error logging notification:', error);
        // Don't throw - logging shouldn't break the main flow
    }
}

/**
 * Send email notification
 * @param {Object} params - Notification parameters
 * @param {string} params.to - Recipient email
 * @param {string} params.subject - Email subject
 * @param {string} params.html - Email HTML content
 * @param {string[]} params.cc - Optional CC recipients
 */
export async function sendEmailNotification({ to, subject, html, cc = [] }) {
    try {
        const recipients = Array.isArray(to) ? to : [to];
        if (cc.length > 0) recipients.push(...cc);
        
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.RESEND_API_KEY || 're_placeholder'}`,
            },
            body: JSON.stringify({
                from: 'onboarding@resend.dev',
                to: recipients,
                subject,
                html,
            }),
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.message || 'Email sending failed');
        }
        return data;
    } catch (error) {
        console.error('Email notification error:', error);
        throw error;
    }
}

/**
 * Send WhatsApp notification via Supabase Edge Function
 * @param {Object} params - Notification parameters
 * @param {string} params.phone - Recipient phone number
 * @param {string} params.template - WhatsApp template name
 * @param {Object} params.params - Template parameters
 */
export async function sendWhatsAppNotification({ phone, template, params = {} }) {
    try {
        const response = await fetch('https://znfsbuconoezbjqksxnu.supabase.co/functions/v1/notify', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
                type: 'whatsapp',
                phone,
                template,
                params,
            }),
        });
        
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'WhatsApp sending failed');
        }
        return data;
    } catch (error) {
        console.error('WhatsApp notification error:', error);
        throw error;
    }
}

/**
 * Send attendance notification to parent
 * @param {Object} attendanceData - Attendance information
 */
export async function notifyAttendanceMarked(attendanceData) {
    const { childName, parentEmail, parentPhone, date, batch, isMissed = false } = attendanceData;
    
    // Email notification
    const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background: #f4f4f5; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
                .header { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 30px; text-align: center; color: white; }
                .content { padding: 30px; }
                .info-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="margin: 0;">${isMissed ? '⚠️' : '✅'} Attendance ${isMissed ? 'Missed' : 'Recorded'}</h1>
                </div>
                <div class="content">
                    <p><strong>Dear Parent,</strong></p>
                    <p>${isMissed ? 'We noticed that' : 'Great news! We\'ve recorded'} <strong>${childName}</strong>'s attendance for:</p>
                    <div class="info-box">
                        <p><strong>Date:</strong> ${new Date(date).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        <p><strong>Batch:</strong> ${batch}</p>
                        ${isMissed ? '<p><strong>Status:</strong> Missed (will be deducted from package)</p>' : ''}
                    </div>
                    ${!isMissed ? '<p>Keep up the great work! 🎉</p>' : '<p>If this was marked in error, please contact us.</p>'}
                </div>
            </div>
        </body>
        </html>
    `;
    
    // Extract studentId from attendanceData (should be passed)
    const studentId = attendanceData.studentId;
    
    // Send email notification
    let emailStatus = 'sent';
    let emailError = null;
    try {
        await sendEmailNotification({
            to: parentEmail,
            subject: `${isMissed ? '⚠️' : '✅'} Attendance ${isMissed ? 'Missed' : 'Recorded'} - ${childName}`,
            html: emailHtml,
        });
    } catch (error) {
        console.error('Failed to send attendance email:', error);
        emailStatus = 'failed';
        emailError = error.message;
    }
    
    // Log email notification
    if (studentId) {
        await logNotification({
            leadId: studentId,
            type: 'attendance',
            channel: 'email',
            subject: `${isMissed ? '⚠️' : '✅'} Attendance ${isMissed ? 'Missed' : 'Recorded'} - ${childName}`,
            message: `Attendance ${isMissed ? 'missed' : 'recorded'} for ${date} in ${batch}`,
            template: 'attendance',
            params: { date, batch, isMissed },
            status: emailStatus,
            error: emailError
        });
    }
    
    // WhatsApp notification (if phone provided)
    if (parentPhone) {
        let whatsappStatus = 'sent';
        let whatsappError = null;
        try {
            await sendWhatsAppNotification({
                phone: parentPhone,
                template: isMissed ? 'attendance_missed' : 'attendance_recorded',
                params: {
                    child_name: childName,
                    date: new Date(date).toLocaleDateString('en-IN'),
                    batch: batch,
                },
            });
        } catch (error) {
            console.error('Failed to send attendance WhatsApp:', error);
            whatsappStatus = 'failed';
            whatsappError = error.message;
        }
        
        // Log WhatsApp notification
        if (studentId) {
            await logNotification({
                leadId: studentId,
                type: 'attendance',
                channel: 'whatsapp',
                subject: '',
                message: `Attendance ${isMissed ? 'missed' : 'recorded'} notification sent`,
                template: isMissed ? 'attendance_missed' : 'attendance_recorded',
                params: { child_name: childName, date: new Date(date).toLocaleDateString('en-IN'), batch },
                status: whatsappStatus,
                error: whatsappError
            });
        }
    }
}

/**
 * Send package update notification
 * @param {Object} packageData - Package information
 */
export async function notifyPackageUpdate(packageData) {
    const { childName, parentEmail, parentPhone, packageName, totalAmount } = packageData;
    
    const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background: #f4f4f5; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
                .header { background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); padding: 30px; text-align: center; color: white; }
                .content { padding: 30px; }
                .info-box { background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 15px 0; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="margin: 0;">📦 Package Updated!</h1>
                </div>
                <div class="content">
                    <p><strong>Dear Parent,</strong></p>
                    <p>Your package for <strong>${childName}</strong> has been updated:</p>
                    <div class="info-box">
                        <p><strong>Package:</strong> ${packageName}</p>
                        ${totalAmount ? `<p><strong>Total Amount:</strong> ₹${totalAmount}</p>` : ''}
                    </div>
                    <p>Please log in to view the details and proceed with enrollment if required.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    // Extract studentId from packageData (should be passed)
    const studentId = packageData.studentId;
    
    // Send email notification
    let emailStatus = 'sent';
    let emailError = null;
    try {
        await sendEmailNotification({
            to: parentEmail,
            subject: `📦 Package Updated - ${childName}`,
            html: emailHtml,
        });
    } catch (error) {
        console.error('Failed to send package update email:', error);
        emailStatus = 'failed';
        emailError = error.message;
    }
    
    // Log email notification
    if (studentId) {
        await logNotification({
            leadId: studentId,
            type: 'package_update',
            channel: 'email',
            subject: `📦 Package Updated - ${childName}`,
            message: `Package updated: ${packageName}`,
            template: 'package_updated',
            params: { packageName, totalAmount },
            status: emailStatus,
            error: emailError
        });
    }
    
    // Send WhatsApp notification (if phone provided)
    if (parentPhone) {
        let whatsappStatus = 'sent';
        let whatsappError = null;
        try {
            await sendWhatsAppNotification({
                phone: parentPhone,
                template: 'package_updated',
                params: {
                    child_name: childName,
                    package_name: packageName,
                },
            });
        } catch (error) {
            console.error('Failed to send package update WhatsApp:', error);
            whatsappStatus = 'failed';
            whatsappError = error.message;
        }
        
        // Log WhatsApp notification
        if (studentId) {
            await logNotification({
                leadId: studentId,
                type: 'package_update',
                channel: 'whatsapp',
                subject: '',
                message: `Package updated notification sent`,
                template: 'package_updated',
                params: { child_name: childName, package_name: packageName },
                status: whatsappStatus,
                error: whatsappError
            });
        }
    }
}

/**
 * Send workflow status change notification
 * @param {Object} statusData - Status change information
 */
export async function notifyStatusChange(statusData) {
    const { childName, parentEmail, parentPhone, oldStatus, newStatus, message, details } = statusData;
    
    // Map status to user-friendly messages
    const statusMessages = {
        'Trial Completed': {
            subject: '✅ Trial Completed - Next Steps',
            title: 'Trial Completed!',
            icon: '✅',
            message: message || `Great news! ${childName}'s trial class has been completed. Please check the assessment feedback and proceed with registration.`
        },
        'Enrollment Requested': {
            subject: '📝 Enrollment Requested - Under Review',
            title: 'Enrollment Requested',
            icon: '📝',
            message: message || `Your enrollment request for ${childName} has been received and is under review. We'll notify you once it's approved.`
        },
        'Registration Requested': {
            subject: '💰 Payment Received - Verifying',
            title: 'Registration Submitted',
            icon: '💰',
            message: message || `Thank you! Your registration for ${childName} has been submitted. We're verifying your payment and will confirm soon.`
        },
        'Ready to Pay': {
            subject: '✅ Package Approved - Payment Required',
            title: 'Package Approved!',
            icon: '✅',
            message: message || `Your package for ${childName} has been approved! Please proceed with payment to complete enrollment.`
        },
        'Enrolled': {
            subject: '🎉 Welcome! Enrollment Confirmed',
            title: 'Enrollment Confirmed!',
            icon: '🎉',
            message: message || `Congratulations! ${childName} is now enrolled. Welcome to Tumble Gym Mysore!`
        },
        'Follow Up': {
            subject: '📅 Follow-up Scheduled',
            title: 'Follow-up Scheduled',
            icon: '📅',
            message: message || `A follow-up has been scheduled for ${childName}. We'll contact you soon.`
        }
    };
    
    const statusInfo = statusMessages[newStatus] || {
        subject: `Status Update - ${newStatus}`,
        title: 'Status Updated',
        icon: '📬',
        message: message || `The status for ${childName} has been updated to ${newStatus}.`
    };
    
    const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background: #f4f4f5; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
                .header { background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding: 30px; text-align: center; color: white; }
                .content { padding: 30px; }
                .info-box { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="margin: 0;">${statusInfo.icon} ${statusInfo.title}</h1>
                </div>
                <div class="content">
                    <p><strong>Dear Parent,</strong></p>
                    <p>${statusInfo.message}</p>
                    ${details ? `<div class="info-box">${details}</div>` : ''}
                    <p>Please log in to your account to view more details.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    // Extract studentId from statusData (should be passed)
    const studentId = statusData.studentId;
    
    // Send email notification
    let emailStatus = 'sent';
    let emailError = null;
    try {
        await sendEmailNotification({
            to: parentEmail,
            subject: `${statusInfo.subject} - ${childName}`,
            html: emailHtml,
        });
    } catch (error) {
        console.error('Failed to send status change email:', error);
        emailStatus = 'failed';
        emailError = error.message;
    }
    
    // Log email notification
    if (studentId) {
        await logNotification({
            leadId: studentId,
            type: 'status_change',
            channel: 'email',
            subject: `${statusInfo.subject} - ${childName}`,
            message: statusInfo.message,
            template: 'status_change',
            params: { oldStatus, newStatus, childName },
            status: emailStatus,
            error: emailError
        });
    }
    
    // Send WhatsApp notification (if phone provided)
    if (parentPhone) {
        let whatsappStatus = 'sent';
        let whatsappError = null;
        try {
            await sendWhatsAppNotification({
                phone: parentPhone,
                template: 'status_change',
                params: {
                    child_name: childName,
                    status: newStatus,
                    message: statusInfo.message,
                },
            });
        } catch (error) {
            console.error('Failed to send status change WhatsApp:', error);
            whatsappStatus = 'failed';
            whatsappError = error.message;
        }
        
        // Log WhatsApp notification
        if (studentId) {
            await logNotification({
                leadId: studentId,
                type: 'status_change',
                channel: 'whatsapp',
                subject: '',
                message: statusInfo.message,
                template: 'status_change',
                params: { child_name: childName, status: newStatus },
                status: whatsappStatus,
                error: whatsappError
            });
        }
    }
}

/**
 * Send trial slot change notification to parent
 * @param {Object} slotData - Trial slot change information
 */
export async function notifyTrialSlotChanged(slotData) {
    const { studentId, childName, parentEmail, parentPhone, oldSlot, newSlot } = slotData;
    
    // Format the dates for display
    const formatSlot = (slot) => {
        if (!slot) return 'Not Set';
        const [dateStr, time] = slot.split('|').map(s => s.trim());
        if (!dateStr || !time) return slot;
        try {
            const date = new Date(dateStr);
            const formattedDate = date.toLocaleDateString('en-IN', { 
                weekday: 'long', 
                day: 'numeric', 
                month: 'long', 
                year: 'numeric' 
            });
            return `${formattedDate} at ${time}`;
        } catch (e) {
            return slot;
        }
    };
    
    const oldSlotFormatted = formatSlot(oldSlot);
    const newSlotFormatted = formatSlot(newSlot);
    
    const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Trial Slot Changed</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .info-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 4px; }
                .new-slot { background: #d1ecf1; border-left: 4px solid #0dcaf0; padding: 15px; margin: 15px 0; border-radius: 4px; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1 style="margin: 0;">📅 Trial Slot Changed</h1>
            </div>
            <div class="content">
                <p><strong>Dear Parent,</strong></p>
                <p>We wanted to inform you that <strong>${childName}</strong>'s trial class slot has been updated.</p>
                
                <div class="info-box">
                    <p><strong>Previous Slot:</strong><br>${oldSlotFormatted}</p>
                </div>
                
                <div class="new-slot">
                    <p><strong>New Trial Slot:</strong><br>${newSlotFormatted}</p>
                </div>
                
                <p>Please make a note of this change. We look forward to seeing ${childName} on the new date!</p>
                <p>If you have any questions or concerns, please don't hesitate to contact us.</p>
                <p><strong>Best regards,<br>Tumble Gym Mysore Team</strong></p>
            </div>
        </body>
        </html>
    `;
    
    // Extract studentId from slotData (should be passed)
    const leadId = studentId;
    
    // Send email notification
    let emailStatus = 'sent';
    let emailError = null;
    try {
        await sendEmailNotification({
            to: parentEmail,
            subject: `📅 Trial Slot Changed - ${childName}`,
            html: emailHtml,
        });
    } catch (error) {
        console.error('Failed to send trial slot change email:', error);
        emailStatus = 'failed';
        emailError = error.message;
    }
    
    // Log email notification
    if (leadId) {
        await logNotification({
            leadId: leadId,
            type: 'trial_slot_change',
            channel: 'email',
            subject: `📅 Trial Slot Changed - ${childName}`,
            message: `Trial slot changed from ${oldSlotFormatted} to ${newSlotFormatted}`,
            template: 'trial_slot_change',
            params: { oldSlot, newSlot },
            status: emailStatus,
            error: emailError
        });
    }
    
    // Send WhatsApp notification (if phone provided)
    if (parentPhone) {
        let whatsappStatus = 'sent';
        let whatsappError = null;
        try {
            await sendWhatsAppNotification({
                phone: parentPhone,
                template: 'trial_slot_change',
                params: {
                    child_name: childName,
                    old_slot: oldSlotFormatted,
                    new_slot: newSlotFormatted,
                },
            });
        } catch (error) {
            console.error('Failed to send trial slot change WhatsApp:', error);
            whatsappStatus = 'failed';
            whatsappError = error.message;
        }
        
        // Log WhatsApp notification
        if (leadId) {
            await logNotification({
                leadId: leadId,
                type: 'trial_slot_change',
                channel: 'whatsapp',
                subject: '',
                message: `Trial slot change notification sent`,
                template: 'trial_slot_change',
                params: { child_name: childName, old_slot: oldSlotFormatted, new_slot: newSlotFormatted },
                status: whatsappStatus,
                error: whatsappError
            });
        }
    }
}

/**
 * Send follow-up reminder notification (3 days before due date)
 * @param {Object} followUpData - Follow-up information
 */
export async function notifyFollowUpReminder(followUpData) {
    const { childName, parentEmail, parentPhone, followUpDate, reason } = followUpData;
    
    const formattedDate = new Date(followUpDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background: #f4f4f5; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
                .header { background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 30px; text-align: center; color: white; }
                .content { padding: 30px; }
                .info-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="margin: 0;">📅 Follow-up Reminder</h1>
                </div>
                <div class="content">
                    <p><strong>Dear Parent,</strong></p>
                    <p>This is a friendly reminder that we have a follow-up scheduled for <strong>${childName}</strong> in 3 days.</p>
                    <div class="info-box">
                        <p><strong>Follow-up Date:</strong> ${formattedDate}</p>
                        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
                    </div>
                    <p>We look forward to speaking with you soon. Please log in to your account if you'd like to update any information.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    // Extract studentId from followUpData (should be passed)
    const studentId = followUpData.studentId;
    
    // Send email notification
    let emailStatus = 'sent';
    let emailError = null;
    try {
        await sendEmailNotification({
            to: parentEmail,
            subject: `📅 Follow-up Reminder - ${childName}`,
            html: emailHtml,
        });
    } catch (error) {
        console.error('Failed to send follow-up reminder email:', error);
        emailStatus = 'failed';
        emailError = error.message;
    }
    
    // Log email notification
    if (studentId) {
        await logNotification({
            leadId: studentId,
            type: 'follow_up_reminder',
            channel: 'email',
            subject: `📅 Follow-up Reminder - ${childName}`,
            message: `Follow-up reminder: ${formattedDate}`,
            template: 'follow_up_reminder',
            params: { followUpDate, reason },
            status: emailStatus,
            error: emailError
        });
    }
    
    // Send WhatsApp notification (if phone provided)
    if (parentPhone) {
        let whatsappStatus = 'sent';
        let whatsappError = null;
        try {
            await sendWhatsAppNotification({
                phone: parentPhone,
                template: 'follow_up_reminder',
                params: {
                    child_name: childName,
                    follow_up_date: formattedDate,
                    reason: reason || '',
                },
            });
        } catch (error) {
            console.error('Failed to send follow-up reminder WhatsApp:', error);
            whatsappStatus = 'failed';
            whatsappError = error.message;
        }
        
        // Log WhatsApp notification
        if (studentId) {
            await logNotification({
                leadId: studentId,
                type: 'follow_up_reminder',
                channel: 'whatsapp',
                subject: '',
                message: `Follow-up reminder notification sent`,
                template: 'follow_up_reminder',
                params: { child_name: childName, follow_up_date: formattedDate, reason: reason || '' },
                status: whatsappStatus,
                error: whatsappError
            });
        }
    }
}

/**
 * Send renewal reminder notification (3 days before package expiry)
 * @param {Object} renewalData - Renewal information
 */
export async function notifyRenewalReminder(renewalData) {
    const { childName, parentEmail, parentPhone, expiryDate, packageName, remainingClasses } = renewalData;
    
    const formattedDate = new Date(expiryDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; background: #f4f4f5; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; }
                .header { background: linear-gradient(135deg, #10b981 0%, #3b82f6 100%); padding: 30px; text-align: center; color: white; }
                .content { padding: 30px; }
                .info-box { background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; margin: 15px 0; border-radius: 4px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1 style="margin: 0;">🔄 Package Renewal Reminder</h1>
                </div>
                <div class="content">
                    <p><strong>Dear Parent,</strong></p>
                    <p>This is a friendly reminder that <strong>${childName}</strong>'s package is expiring in 3 days.</p>
                    <div class="info-box">
                        <p><strong>Package:</strong> ${packageName || 'Current Package'}</p>
                        <p><strong>Expiry Date:</strong> ${formattedDate}</p>
                        ${remainingClasses !== null && remainingClasses !== undefined ? `<p><strong>Remaining Classes:</strong> ${remainingClasses}</p>` : ''}
                    </div>
                    <p>Please log in to your account to renew the package and continue your child's journey with us!</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    // Extract studentId from renewalData (should be passed)
    const studentId = renewalData.studentId;
    
    // Send email notification
    let emailStatus = 'sent';
    let emailError = null;
    try {
        await sendEmailNotification({
            to: parentEmail,
            subject: `🔄 Package Renewal Reminder - ${childName}`,
            html: emailHtml,
        });
    } catch (error) {
        console.error('Failed to send renewal reminder email:', error);
        emailStatus = 'failed';
        emailError = error.message;
    }
    
    // Log email notification
    if (studentId) {
        await logNotification({
            leadId: studentId,
            type: 'renewal_reminder',
            channel: 'email',
            subject: `🔄 Package Renewal Reminder - ${childName}`,
            message: `Renewal reminder: Package expires on ${formattedDate}`,
            template: 'renewal_reminder',
            params: { expiryDate, packageName, remainingClasses },
            status: emailStatus,
            error: emailError
        });
    }
    
    // Send WhatsApp notification (if phone provided)
    if (parentPhone) {
        let whatsappStatus = 'sent';
        let whatsappError = null;
        try {
            await sendWhatsAppNotification({
                phone: parentPhone,
                template: 'renewal_reminder',
                params: {
                    child_name: childName,
                    expiry_date: formattedDate,
                    package_name: packageName || 'Current Package',
                    remaining_classes: remainingClasses !== null && remainingClasses !== undefined ? remainingClasses.toString() : '',
                },
            });
        } catch (error) {
            console.error('Failed to send renewal reminder WhatsApp:', error);
            whatsappStatus = 'failed';
            whatsappError = error.message;
        }
        
        // Log WhatsApp notification
        if (studentId) {
            await logNotification({
                leadId: studentId,
                type: 'renewal_reminder',
                channel: 'whatsapp',
                subject: '',
                message: `Renewal reminder notification sent`,
                template: 'renewal_reminder',
                params: {
                    child_name: childName,
                    expiry_date: formattedDate,
                    package_name: packageName || 'Current Package',
                    remaining_classes: remainingClasses !== null && remainingClasses !== undefined ? remainingClasses.toString() : ''
                },
                status: whatsappStatus,
                error: whatsappError
            });
        }
    }
}

/**
 * Check and send scheduled reminders (follow-ups and renewals)
 * This should be called daily (via cron or scheduled function)
 */
export async function checkAndSendReminders() {
    try {
        const today = new Date();
        const threeDaysFromNow = new Date(today);
        threeDaysFromNow.setDate(today.getDate() + 3);
        
        // Format dates for database query (YYYY-MM-DD)
        const targetDateStr = threeDaysFromNow.toISOString().split('T')[0];
        
        // 1. Check for follow-ups due in 3 days
        const { data: followUpLeads, error: followUpError } = await supabaseClient
            .from('leads')
            .select('*')
            .eq('status', 'Follow Up')
            .not('follow_up_date', 'is', null)
            .eq('follow_up_date', targetDateStr);
        
        if (!followUpError && followUpLeads) {
            for (const lead of followUpLeads) {
                // Check if notification was already sent (optional: store notification_sent_date)
                await notifyFollowUpReminder({
                    studentId: lead.id,
                    childName: lead.child_name,
                    parentEmail: lead.email,
                    parentPhone: lead.phone,
                    followUpDate: lead.follow_up_date,
                    reason: lead.feedback_reason || '',
                });
            }
        }
        
        // 2. Check for renewals (expiry dates) due in 3 days
        const { data: enrolledLeads, error: enrolledError } = await supabaseClient
            .from('leads')
            .select('*')
            .eq('status', 'Enrolled');
        
        if (!enrolledError && enrolledLeads) {
            for (const lead of enrolledLeads) {
                // Extract actual_end_date from metadata
                let expiryDate = null;
                let packageName = null;
                let remainingClasses = null;
                
                if (lead.parent_note) {
                    const metaMatch = lead.parent_note.match(/\[PACKAGE_META\](.*?)\[\/PACKAGE_META\]/);
                    if (metaMatch) {
                        try {
                            const meta = JSON.parse(metaMatch[1]);
                            expiryDate = meta.actual_end_date;
                            packageName = meta.selected_package || lead.selected_package;
                            remainingClasses = meta.remaining_classes;
                        } catch (e) {
                            console.warn('Could not parse package metadata for renewal check', e);
                        }
                    }
                }
                
                if (expiryDate) {
                    const expiryDateObj = new Date(expiryDate);
                    const expiryDateStr = expiryDateObj.toISOString().split('T')[0];
                    
                    if (expiryDateStr === targetDateStr) {
                        await notifyRenewalReminder({
                            childName: lead.child_name,
                            parentEmail: lead.email,
                            parentPhone: lead.phone,
                            expiryDate: expiryDate,
                            packageName: packageName,
                            remainingClasses: remainingClasses,
                        });
                    }
                }
            }
        }
        
        return { success: true, followUps: followUpLeads?.length || 0, renewals: enrolledLeads?.filter(l => {
            if (l.parent_note) {
                const metaMatch = l.parent_note.match(/\[PACKAGE_META\](.*?)\[\/PACKAGE_META\]/);
                if (metaMatch) {
                    try {
                        const meta = JSON.parse(metaMatch[1]);
                        if (meta.actual_end_date) {
                            const expiryDateStr = new Date(meta.actual_end_date).toISOString().split('T')[0];
                            return expiryDateStr === targetDateStr;
                        }
                    } catch (e) {}
                }
            }
            return false;
        }).length || 0 };
        
    } catch (error) {
        console.error('Error checking and sending reminders:', error);
        throw error;
    }
}

