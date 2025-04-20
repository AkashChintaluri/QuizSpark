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

        // Fetch quiz attempts with related data
        const { data, error } = await supabase
            .from('quiz_attempts')
            .select(`
        quiz_id,
        quizzes (
          quiz_id,
          quiz_name,
          quiz_code,
          due_date,
          teacher_login (username)
        )
      `)
            .eq('user_id', userIdInt);

        if (error) throw error;

        // Create unique array of quizzes
        const uniqueQuizzes = Array.from(new Set(data.map(row => row.quiz_id)))
            .map(quiz_id => {
                const row = data.find(r => r.quiz_id === quiz_id);
                return {
                    quiz_id: row.quizzes?.quiz_id,
                    quiz_name: row.quizzes?.quiz_name || 'Unknown Quiz',
                    quiz_code: row.quizzes?.quiz_code,
                    teacher_name: row.quizzes?.teacher_login?.username || 'Unknown Teacher',
                    due_date: row.quizzes?.due_date
                };
            });

        res.json({
            success: true,
            quizzes: uniqueQuizzes
        });

    } catch (error) {
        console.error('Attempted quizzes error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch attempted quizzes',
            details: error.message
        });
    }
});

module.exports = serverless(app);
