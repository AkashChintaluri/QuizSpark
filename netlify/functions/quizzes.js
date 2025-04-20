const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with environment variables
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

const app = express();
app.use(cors());
app.use(express.json());

/**
 * POST /api/quizzes
 * Create a new quiz
 */
app.post('/', async (req, res) => {
    const { quiz_name, quiz_code, created_by, questions, due_date } = req.body;

    try {
        const { data, error } = await supabase
            .from('quizzes')
            .insert({
                quiz_name,
                quiz_code,
                created_by,
                questions: { questions }, // Store as JSONB
                due_date,
            })
            .select('quiz_id')
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            message: 'Quiz created successfully',
            quizId: data.quiz_id,
        });
    } catch (error) {
        console.error('Error creating quiz:', error);
        res.status(500).json({ success: false, message: 'Failed to create quiz', error: error.message });
    }
});

/**
 * PUT /api/quizzes/:quiz_id
 * Update an existing quiz
 */
app.put('/:quiz_id', async (req, res) => {
    const { quiz_id } = req.params;
    const { quiz_name, due_date, questions } = req.body;

    try {
        const { data, error } = await supabase
            .from('quizzes')
            .update({
                quiz_name,
                due_date,
                questions,
            })
            .eq('quiz_id', quiz_id)
            .select('quiz_id')
            .single();

        if (error || !data) {
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }

        res.status(200).json({ success: true, message: 'Quiz updated successfully' });
    } catch (error) {
        console.error('Error updating quiz:', error);
        res.status(500).json({ success: false, message: 'Failed to update quiz', error: error.message });
    }
});

/**
 * GET /api/quizzes/created/:teacher_id
 * Get all quizzes created by a teacher
 */
app.get('/created/:teacher_id', async (req, res) => {
    const { teacher_id } = req.params;
    try {
        const teacherIdInt = parseInt(teacher_id, 10);
        if (isNaN(teacherIdInt)) {
            return res.status(400).json({ success: false, error: 'Invalid teacher_id: must be a number' });
        }
        const { data, error } = await supabase
            .from('quizzes')
            .select('quiz_id, quiz_name, quiz_code, due_date, created_at, questions')
            .eq('created_by', teacherIdInt);
        if (error) throw error;
        res.json({ success: true, quizzes: data || [] });
    } catch (error) {
        console.error('Error fetching created quizzes:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch quizzes' });
    }
});

/**
 * GET /api/quizzes/id/:quiz_id
 * Fetch a quiz by quiz_id
 */
app.get('/id/:quiz_id', async (req, res) => {
    const { quiz_id } = req.params;

    try {
        const { data, error } = await supabase
            .from('quizzes')
            .select('quiz_id, quiz_code, quiz_name')
            .eq('quiz_id', quiz_id)
            .single();

        if (error || !data) {
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }

        res.status(200).json({
            success: true,
            quiz_id: data.quiz_id,
            quiz_code: data.quiz_code,
            quiz_name: data.quiz_name,
        });
    } catch (error) {
        console.error('Error fetching quiz:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch quiz', error: error.message });
    }
});

/**
 * GET /api/quizzes/:quiz_code
 * Fetch a quiz by quiz_code
 * (placed last to avoid route conflicts)
 */
app.get('/:quiz_code', async (req, res) => {
    // Prevent conflict with /id/:quiz_id and /created/:teacher_id routes
    if (req.params.quiz_code === 'id' || req.params.quiz_code === 'created') {
        return res.status(400).json({ success: false, message: 'Invalid quiz code' });
    }

    const { quiz_code } = req.params;

    try {
        const { data, error } = await supabase
            .from('quizzes')
            .select('quiz_id, quiz_name, questions')
            .eq('quiz_code', quiz_code)
            .single();

        if (error || !data) {
            return res.status(404).json({ success: false, message: 'Quiz not found' });
        }

        res.status(200).json({
            success: true,
            quiz_id: data.quiz_id,
            quiz_name: data.quiz_name,
            questions: data.questions,
        });
    } catch (error) {
        console.error('Error fetching quiz:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch quiz', error: error.message });
    }
});

module.exports = serverless(app);
