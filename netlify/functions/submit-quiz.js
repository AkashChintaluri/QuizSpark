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

app.post('/', async (req, res) => {
    const { quiz_code, user_id, answers } = req.body;

    try {
        // Validate inputs
        if (!quiz_code || !user_id || !answers) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: quiz_code, user_id, or answers'
            });
        }

        // Get quiz details
        const { data: quiz, error: quizError } = await supabase
            .from('quizzes')
            .select('quiz_id, questions')
            .eq('quiz_code', quiz_code)
            .single();

        if (quizError || !quiz) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        // Calculate score
        const questions = quiz.questions.questions;
        let score = 0;
        const totalQuestions = questions.length;

        questions.forEach((question, index) => {
            const correctIndex = question.options.findIndex(opt => opt.is_correct);
            const userAnswer = parseInt(answers[index]);
            if (correctIndex === userAnswer) score++;
        });

        // Record attempt
        const { data, error } = await supabase
            .from('quiz_attempts')
            .insert({
                quiz_id: quiz.quiz_id,
                user_id,
                score,
                total_questions: totalQuestions,
                answers
            })
            .select('attempt_id')
            .single();

        if (error) throw error;

        res.status(201).json({
            success: true,
            attemptId: data.attempt_id,
            score,
            totalQuestions
        });

    } catch (error) {
        console.error('Quiz submission error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to submit quiz'
        });
    }
});

module.exports.handler = serverless(app)