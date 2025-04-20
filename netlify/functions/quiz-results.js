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

app.get('/:quiz_code/leaderboard', async (req, res) => {
    const { quiz_code } = req.params;

    try {
        // Get quiz details
        const { data: quiz, error: quizError } = await supabase
            .from('quizzes')
            .select('quiz_id, quiz_name')
            .eq('quiz_code', quiz_code)
            .single();

        if (quizError || !quiz) {
            return res.status(404).json({
                success: false,
                error: 'Quiz not found'
            });
        }

        // Get quiz attempts with student details
        const { data, error } = await supabase
            .from('quiz_attempts')
            .select(`
        user_id,
        score,
        total_questions,
        attempt_date,
        student_login (username)
      `)
            .eq('quiz_id', quiz.quiz_id)
            .order('score', { ascending: false })
            .order('attempt_date', { ascending: true });

        if (error) throw error;

        // Format leaderboard data
        const rankings = (data || []).map((row, index) => ({
            student_id: row.user_id,
            student_name: row.student_login?.username || 'Anonymous Student',
            score_percent: Math.round((row.score / row.total_questions) * 100) || 0,
            rank: index + 1,
            attempt_date: row.attempt_date
        }));

        res.json({
            success: true,
            quiz_name: quiz.quiz_name,
            rankings: rankings.length ? rankings : []
        });

    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch leaderboard',
            details: error.message
        });
    }
});

module.exports.handler = serverless(app)