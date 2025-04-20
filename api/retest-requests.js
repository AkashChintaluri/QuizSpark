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

// POST - Create retest request
app.post('/', async (req, res) => {
    const { student_id, quiz_id, attempt_id } = req.body;

    try {
        // Validate all required fields
        if (!student_id || !quiz_id || !attempt_id) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: student_id, quiz_id, or attempt_id'
            });
        }

        const { data, error } = await supabase
            .from('retest_requests')
            .insert({ student_id, quiz_id, attempt_id })
            .select()
            .single();

        if (error?.code === '23505') {
            return res.status(409).json({
                success: false,
                error: 'Retest request already exists'
            });
        }
        if (error) throw error;

        res.status(201).json({
            success: true,
            request: data
        });

    } catch (error) {
        console.error('Retest request error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create retest request'
        });
    }
});

// GET - Get requests for teacher
app.get('/teacher/:teacher_id', async (req, res) => {
    const { teacher_id } = req.params;

    try {
        const teacherIdInt = parseInt(teacher_id, 10);
        if (isNaN(teacherIdInt)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid teacher ID'
            });
        }

        const { data, error } = await supabase
            .from('retest_requests')
            .select(`
        request_id,
        student_id,
        quiz_id,
        attempt_id,
        request_date,
        status,
        student_login (username),
        quizzes (quiz_name, quiz_code, created_by)
      `)
            .eq('quizzes.created_by', teacherIdInt)
            .order('request_date', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            requests: data.map(row => ({
                request_id: row.request_id,
                student_id: row.student_id,
                student_name: row.student_login?.username || 'Unknown Student',
                quiz_id: row.quiz_id,
                quiz_name: row.quizzes?.quiz_name || 'Unknown Quiz',
                quiz_code: row.quizzes?.quiz_code,
                attempt_id: row.attempt_id,
                request_date: row.request_date,
                status: row.status
            }))
        });

    } catch (error) {
        console.error('Retest requests error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch retest requests'
        });
    }
});

// PUT - Update request status
app.put('/:request_id', async (req, res) => {
    const { request_id } = req.params;
    const { status, teacher_password } = req.body;

    try {
        // Get associated quiz and teacher
        const { data: requestData, error: fetchError } = await supabase
            .from('retest_requests')
            .select(`
        quizzes!inner (
          created_by,
          teacher_login (password)
        )
      `)
            .eq('request_id', request_id)
            .single();

        if (fetchError || !requestData?.quizzes) {
            return res.status(404).json({
                success: false,
                error: 'Request not found'
            });
        }

        // Verify teacher password (consider using auth tokens instead)
        if (requestData.quizzes.teacher_login?.password !== teacher_password) {
            return res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

        // Update request status
        const { data: updatedRequest, error: updateError } = await supabase
            .from('retest_requests')
            .update({
                status,
                updated_at: new Date().toISOString()
            })
            .eq('request_id', request_id)
            .select()
            .single();

        if (updateError) throw updateError;

        // Delete attempt if approved
        if (status === 'approved') {
            const { error: deleteError } = await supabase
                .from('quiz_attempts')
                .delete()
                .eq('attempt_id', updatedRequest.attempt_id);

            if (deleteError) throw deleteError;
        }

        res.json({
            success: true,
            request: updatedRequest
        });

    } catch (error) {
        console.error('Update request error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update retest request'
        });
    }
});

module.exports.handler = serverless(app)