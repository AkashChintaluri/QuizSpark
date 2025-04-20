const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

const app = express();
app.use(cors());
app.use(express.json());

/**
 * Subscribe a student to a teacher
 * POST /subscribe
 * Body: { student_id, teacher_id }
 */
app.post('/subscribe', async (req, res) => {
    const { student_id, teacher_id } = req.body;

    try {
        if (!student_id || !teacher_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing student_id or teacher_id'
            });
        }

        const { data, error } = await supabase
            .from('subscriptions')
            .insert({ student_id, teacher_id })
            .select()
            .single();

        // Handle unique constraint violation
        if (error?.code === '23505') {
            return res.json({
                success: true,
                message: 'Already subscribed to this teacher'
            });
        }

        if (error) throw error;

        res.json({
            success: true,
            subscription: data
        });

    } catch (error) {
        console.error('Subscription error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Subscription failed'
        });
    }
});

/**
 * Unsubscribe a student from a teacher
 * POST /unsubscribe
 * Body: { student_id, teacher_id }
 */
app.post('/unsubscribe', async (req, res) => {
    const { student_id, teacher_id } = req.body;

    try {
        if (!student_id || !teacher_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing student_id or teacher_id'
            });
        }

        const { error } = await supabase
            .from('subscriptions')
            .delete()
            .eq('student_id', student_id)
            .eq('teacher_id', teacher_id);

        if (error) throw error;

        res.json({
            success: true,
            message: 'Unsubscribed successfully'
        });

    } catch (error) {
        console.error('Unsubscription error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to unsubscribe'
        });
    }
});

/**
 * Get all teachers a student is subscribed to
 * GET /:student_id
 */
app.get('/:student_id', async (req, res) => {
    const { student_id } = req.params;

    try {
        const studentIdInt = parseInt(student_id, 10);
        if (isNaN(studentIdInt)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid student ID: must be a number'
            });
        }

        // Get subscribed teacher IDs
        const { data: subscriptions, error: subError } = await supabase
            .from('subscriptions')
            .select('teacher_id')
            .eq('student_id', studentIdInt);

        if (subError) throw subError;

        const teacherIds = subscriptions?.map(row => row.teacher_id) || [];

        // Get teacher details
        const { data: teachers, error: teacherError } = await supabase
            .from('teacher_login')
            .select('id, username, email')
            .in('id', teacherIds.length > 0 ? teacherIds : [0]); // fallback for empty

        if (teacherError) throw teacherError;

        res.json({
            success: true,
            teachers: teachers || []
        });

    } catch (error) {
        console.error('Subscriptions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch subscriptions'
        });
    }
});

module.exports.handler = serverless(app);
