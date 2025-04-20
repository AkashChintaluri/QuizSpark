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

app.get('/:user_id', async (req, res) => {
    const { user_id } = req.params;

    try {
        const userIdInt = parseInt(user_id, 10);
        if (isNaN(userIdInt)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user_id: must be a number'
            });
        }

        const { data, error } = await supabase
            .from('quiz_attempts')
            .select(`
        score,
        total_questions,
        quiz_id,
        quizzes (quiz_name)
      `)
            .eq('user_id', userIdInt);

        if (error) throw error;

        const stats = {
            total_attempts: data.length,
            average_score: data.length > 0
                ? data.reduce((sum, row) => sum + (row.score / row.total_questions) * 100, 0) / data.length
                : 0,
            highest_score: 0,
            highest_quiz_name: 'None'
        };

        if (data.length > 0) {
            const highestAttempt = data.reduce((max, row) =>
                    (row.score / row.total_questions) > (max.score / max.total_questions) ? row : max,
                data[0]
            );
            stats.highest_score = Math.round((highestAttempt.score / highestAttempt.total_questions) * 100);
            stats.highest_quiz_name = highestAttempt.quizzes?.quiz_name || 'Unknown Quiz';
        }

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user stats',
            details: error.message
        });
    }
});

module.exports.handler = serverless(app)