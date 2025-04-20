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
        // Validate user ID
        const userIdInt = parseInt(user_id, 10);
        if (isNaN(userIdInt)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid user ID: must be a number'
            });
        }

        // Fetch recent attempts with quiz names
        const { data, error } = await supabase
            .from('quiz_attempts')
            .select(`
        attempt_id,
        score,
        total_questions,
        attempt_date,
        quizzes (quiz_name)
      `)
            .eq('user_id', userIdInt)
            .order('attempt_date', { ascending: false })
            .limit(5);

        if (error) throw error;

        // Format response
        res.json({
            success: true,
            results: data.map(row => ({
                quiz_name: row.quizzes?.quiz_name || 'Unknown Quiz',
                attempt_id: row.attempt_id,
                score: row.score,
                total_questions: row.total_questions,
                attempt_date: row.attempt_date
            }))
        });

    } catch (error) {
        console.error('Recent results error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch recent results'
        });
    }
});

module.exports.handler = serverless(app)