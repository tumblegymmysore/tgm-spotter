// js/notifications.js - Centralized notification system
import { supabaseClient, supabaseKey } from './config.js';

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
    
    try {
        await sendEmailNotification({
            to: parentEmail,
            subject: `${isMissed ? '⚠️' : '✅'} Attendance ${isMissed ? 'Missed' : 'Recorded'} - ${childName}`,
            html: emailHtml,
        });
    } catch (error) {
        console.error('Failed to send attendance email:', error);
    }
    
    // WhatsApp notification (if phone provided)
    if (parentPhone) {
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
                        <p><strong>Total Amount:</strong> ₹${totalAmount}</p>
                    </div>
                    <p>Please log in to view the details and proceed with payment if required.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    
    try {
        await sendEmailNotification({
            to: parentEmail,
            subject: `📦 Package Updated - ${childName}`,
            html: emailHtml,
        });
    } catch (error) {
        console.error('Failed to send package update email:', error);
    }
}

