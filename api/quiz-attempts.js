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

app.get('/:quiz_code', async (req, res) => {
    const { quiz_code } = req.params;

    try {
        // Verify quiz exists
        const { data: quiz, error: quizError } = await supabase
            .from('quizzes')
            .select('quiz_id, quiz_name')
            .eq('quiz_code', quiz_code)
            .single();

        if (quizError || !quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        // Get attempts with related data
        const { data, error } = await supabase
            .from('quiz_attempts')
            .select(`
        attempt_id,
        user_id,
        score,
        total_questions,
        attempt_date,
        student_login (username),
        quizzes (quiz_name),
        retest_requests (request_id, status)
      `)
            .eq('quiz_id', quiz.quiz_id)
            .order('attempt_date', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            attempts: data.map(row => ({
                attempt_id: row.attempt_id,
                user_id: row.user_id,
                student_username: row.student_login?.username || 'Unknown Student',
                score: row.score,
                total_questions: row.total_questions,
                attempt_date: row.attempt_date,
                quiz_name: row.quizzes?.quiz_name || quiz.quiz_name,
                request_id: row.retest_requests?.request_id,
                retest_status: row.retest_requests?.status
            }))
        });

    } catch (error) {
        console.error('Error fetching quiz attempts:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch quiz attempts',
            details: error.message
        });
    }
});

module.exports = serverless(app);
