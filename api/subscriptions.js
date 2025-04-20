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

app.get('/:student_id', async (req, res) => {
    const { student_id } = req.params;

    try {
        // Validate student_id
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

        // Extract teacher IDs (handle empty case)
        const teacherIds = subscriptions?.map(row => row.teacher_id) || [];

        // Get teacher details
        const { data: teachers, error: teacherError } = await supabase
            .from('teacher_login')
            .select('id, username, email')
            .in('id', teacherIds.length > 0 ? teacherIds : [0]); // [0] acts as fallback

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

module.exports.handler = serverless(app)