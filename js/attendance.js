// js/attendance.js - Attendance management system
import { supabaseClient } from './config.js';
import { showSuccessModal, showErrorModal, calculateAge } from './utils.js';
import { notifyAttendanceMarked } from './notifications.js';

/**
 * Get students eligible for a specific batch
 * @param {string} batchName - Batch name (e.g., "Toddler (3-5 Yrs)")
 * @returns {Promise<Array>} List of eligible students
 */
export async function getEligibleStudents(batchName) {
    try {
        const { data, error } = await supabaseClient
            .from('leads')
            .select('*')
            .eq('status', 'Enrolled')
            .eq('recommended_batch', batchName)
            .order('child_name', { ascending: true });
        
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching eligible students:', error);
        return [];
    }
}

/**
 * Get all active batches
 * @returns {Promise<Array>} List of unique batches
 */
export async function getAllBatches() {
    try {
        const { data, error } = await supabaseClient
            .from('leads')
            .select('recommended_batch')
            .eq('status', 'Enrolled')
            .not('recommended_batch', 'is', null);
        
        if (error) throw error;
        
        // Get unique batches
        const uniqueBatches = [...new Set(data.map(lead => lead.recommended_batch))];
        return uniqueBatches.sort();
    } catch (error) {
        console.error('Error fetching batches:', error);
        return [];
    }
}

/**
 * Record attendance for a student
 * @param {Object} attendanceData - Attendance information
 * @param {number} attendanceData.studentId - Student lead ID
 * @param {string} attendanceData.date - Attendance date (YYYY-MM-DD)
 * @param {string} attendanceData.batch - Batch name
 * @param {boolean} attendanceData.isMissed - Whether this is a missed attendance
 * @param {string} attendanceData.recordedBy - 'trainer' or 'admin'
 * @param {string} attendanceData.recordedById - User ID who recorded
 */
export async function recordAttendance(attendanceData) {
    const { studentId, date, batch, isMissed = false, recordedBy, recordedById } = attendanceData;
    
    try {
        // Get student data
        const { data: student, error: studentError } = await supabaseClient
            .from('leads')
            .select('*')
            .eq('id', studentId)
            .single();
        
        if (studentError || !student) {
            throw new Error('Student not found');
        }
        
        // Check if attendance already exists for this date
        const { data: existing } = await supabaseClient
            .from('attendance')
            .select('id')
            .eq('lead_id', studentId)
            .eq('attendance_date', date)
            .single();
        
        if (existing) {
            throw new Error('Attendance already recorded for this date');
        }
        
        // Insert attendance record
        const { error: attendanceError } = await supabaseClient
            .from('attendance')
            .insert([{
                lead_id: studentId,
                attendance_date: date,
                batch: batch,
                is_present: !isMissed,
                is_missed: isMissed,
                recorded_by: recordedBy,
                recorded_by_id: recordedById,
                created_at: new Date().toISOString(),
            }]);
        
        if (attendanceError) {
            // If attendance table doesn't exist, store in parent_note metadata
            if (attendanceError.code === '42P01') {
                await storeAttendanceInMetadata(studentId, date, batch, isMissed, recordedBy);
            } else {
                throw attendanceError;
            }
        }
        
        // Update package classes (decrement for missed, count for unlimited)
        await updatePackageClasses(studentId, isMissed);
        
        // Send notification to parent
        await notifyAttendanceMarked({
            childName: student.child_name,
            parentEmail: student.email,
            parentPhone: student.phone,
            date: date,
            batch: batch,
            isMissed: isMissed,
        });
        
        return { success: true };
    } catch (error) {
        console.error('Error recording attendance:', error);
        throw error;
    }
}

/**
 * Store attendance in metadata if table doesn't exist
 */
async function storeAttendanceInMetadata(studentId, date, batch, isMissed, recordedBy) {
    const { data: student } = await supabaseClient
        .from('leads')
        .select('parent_note')
        .eq('id', studentId)
        .single();
    
    const attendanceRecord = {
        date,
        batch,
        isMissed,
        recordedBy,
        timestamp: new Date().toISOString(),
    };
    
    const existingNote = student?.parent_note || '';
    const attendanceMatch = existingNote.match(/\[ATTENDANCE\](.*?)\[\/ATTENDANCE\]/);
    
    let attendanceArray = [];
    if (attendanceMatch) {
        try {
            attendanceArray = JSON.parse(attendanceMatch[1]);
        } catch (e) {
            console.warn('Could not parse attendance metadata', e);
        }
    }
    
    attendanceArray.push(attendanceRecord);
    const attendanceJson = JSON.stringify(attendanceArray);
    const attendanceBlock = `[ATTENDANCE]${attendanceJson}[/ATTENDANCE]`;
    
    const cleanedNote = existingNote.replace(/\[ATTENDANCE\].*?\[\/ATTENDANCE\]/g, '').trim();
    const updatedNote = cleanedNote ? `${cleanedNote}\n${attendanceBlock}` : attendanceBlock;
    
    await supabaseClient
        .from('leads')
        .update({ parent_note: updatedNote })
        .eq('id', studentId);
}

/**
 * Update package classes based on attendance
 */
async function updatePackageClasses(studentId, isMissed) {
    const { data: student } = await supabaseClient
        .from('leads')
        .select('*')
        .eq('id', studentId)
        .single();
    
    if (!student) return;
    
    // Get package metadata
    const metaMatch = student.parent_note?.match(/\[PACKAGE_META\](.*?)\[\/PACKAGE_META\]/);
    let metadata = {};
    if (metaMatch) {
        try {
            metadata = JSON.parse(metaMatch[1]);
        } catch (e) {
            console.warn('Could not parse package metadata', e);
        }
    }
    
    // Get package details from selected_package or metadata
    const packageInfo = metadata.selected_package || student.selected_package || '';
    const isUnlimited = packageInfo.includes('Unlimited') || packageInfo.includes('unlimited');
    
    if (isUnlimited) {
        // For unlimited, just count attendance
        metadata.attendance_count = (metadata.attendance_count || 0) + 1;
    } else {
        // For limited packages, decrement classes
        const currentClasses = metadata.remaining_classes || metadata.classes || 0;
        if (isMissed && currentClasses > 0) {
            metadata.remaining_classes = currentClasses - 1;
        }
    }
    
    // Update metadata
    const metaJson = JSON.stringify(metadata);
    const metaBlock = `[PACKAGE_META]${metaJson}[/PACKAGE_META]`;
    const existingNote = student.parent_note || '';
    const cleanedNote = existingNote.replace(/\[PACKAGE_META\].*?\[\/PACKAGE_META\]/g, '').trim();
    const updatedNote = cleanedNote ? `${cleanedNote}\n${metaBlock}` : metaBlock;
    
    await supabaseClient
        .from('leads')
        .update({ parent_note: updatedNote })
        .eq('id', studentId);
}

/**
 * Get attendance history for a student
 * @param {number} studentId - Student lead ID
 * @returns {Promise<Array>} Attendance records
 */
export async function getAttendanceHistory(studentId) {
    try {
        // Try to get from attendance table first
        const { data: attendanceData, error } = await supabaseClient
            .from('attendance')
            .select('*')
            .eq('lead_id', studentId)
            .order('attendance_date', { ascending: false });
        
        if (!error && attendanceData) {
            return attendanceData;
        }
        
        // Fallback to metadata
        const { data: student } = await supabaseClient
            .from('leads')
            .select('parent_note')
            .eq('id', studentId)
            .single();
        
        if (student?.parent_note) {
            const attendanceMatch = student.parent_note.match(/\[ATTENDANCE\](.*?)\[\/ATTENDANCE\]/);
            if (attendanceMatch) {
                try {
                    return JSON.parse(attendanceMatch[1]);
                } catch (e) {
                    console.warn('Could not parse attendance history', e);
                }
            }
        }
        
        return [];
    } catch (error) {
        console.error('Error fetching attendance history:', error);
        return [];
    }
}

/**
 * Get attendance summary for a date
 * @param {string} date - Date (YYYY-MM-DD)
 * @param {string} batch - Optional batch filter
 * @returns {Promise<Object>} Attendance summary
 */
export async function getAttendanceSummary(date, batch = null) {
    try {
        let query = supabaseClient
            .from('attendance')
            .select('*')
            .eq('attendance_date', date);
        
        if (batch) {
            query = query.eq('batch', batch);
        }
        
        const { data, error } = await query;
        
        if (error) {
            // If table doesn't exist, return empty summary
            if (error.code === '42P01') {
                return { present: 0, absent: 0, total: 0 };
            }
            throw error;
        }
        
        const present = data.filter(a => a.is_present).length;
        const absent = data.filter(a => a.is_missed).length;
        
        return {
            present,
            absent,
            total: data.length,
            records: data,
        };
    } catch (error) {
        console.error('Error fetching attendance summary:', error);
        return { present: 0, absent: 0, total: 0, records: [] };
    }
}

