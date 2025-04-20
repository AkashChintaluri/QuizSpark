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
        // Validate student ID
        const studentIdInt = parseInt(student_id, 10);
        if (isNaN(studentIdInt)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid student ID: must be a number'
            });
        }

        // Get subscribed teachers
        const { data: subscriptions, error: subError } = await supabase
            .from('subscriptions')
            .select('teacher_id')
            .eq('student_id', studentIdInt);

        if (subError) throw subError;

        // Handle no subscriptions
        const teacherIds = subscriptions?.map(row => row.teacher_id) || [];
        if (!teacherIds.length) {
            return res.json({
                success: true,
                quizzes: []
            });
        }

        // Get upcoming quizzes from subscribed teachers
        const { data: quizzes, error: quizzesError } = await supabase
            .from('quizzes')
            .select(`
        quiz_id,
        quiz_name,
        quiz_code,
        due_date,
        created_by,
        teacher_login (username)
      `)
            .in('created_by', teacherIds)
            .gt('due_date', new Date().toISOString());

        if (quizzesError) throw quizzesError;

        // Get attempted quizzes
        const { data: attempts, error: attemptsError } = await supabase
            .from('quiz_attempts')
            .select('quiz_id')
            .eq('user_id', studentIdInt);

        if (attemptsError) throw attemptsError;

        // Filter out attempted quizzes
        const attemptedIds = new Set(attempts?.map(a => a.quiz_id) || []);
        const upcomingQuizzes = (quizzes || []).filter(
            quiz => !attemptedIds.has(quiz.quiz_id)
        );

        // Format response
        res.json({
            success: true,
            quizzes: upcomingQuizzes.map(quiz => ({
                quiz_id: quiz.quiz_id,
                quiz_name: quiz.quiz_name,
                quiz_code: quiz.quiz_code,
                due_date: quiz.due_date,
                teacher_name: quiz.teacher_login?.username || 'Unknown Teacher'
            }))
        });

    } catch (error) {
        console.error('Upcoming quizzes error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch upcoming quizzes'
        });
    }
});

module.exports = serverless(app);
