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

app.get('/:quiz_code/:user_id', async (req, res) => {
    const { quiz_code, user_id } = req.params;

    try {
        const { data, error } = await supabase
            .from('quizzes')
            .select(`
        quiz_id,
        quiz_name,
        questions,
        quiz_attempts (
          attempt_id,
          answers,
          score,
          total_questions,
          attempt_date
        )
      `)
            .eq('quiz_code', quiz_code)
            .eq('quiz_attempts.user_id', user_id)
            .order('attempt_date', { referencedTable: 'quiz_attempts', ascending: false })
            .limit(1, { referencedTable: 'quiz_attempts' })
            .single();

        if (error || !data) {
            return res.status(404).json({
                success: false,
                message: 'Quiz not found'
            });
        }

        const quizData = data;
        const questions = quizData.questions?.questions || [];
        const attempt = quizData.quiz_attempts?.[0] || {};

        const userAnswers = attempt.answers || {};

        const quizResults = {
            quiz_id: quizData.quiz_id,
            quizName: quizData.quiz_name,
            attemptId: attempt.attempt_id,
            score: attempt.score || 0,
            totalQuestions: attempt.total_questions || questions.length,
            questions: questions.map((question, index) => {
                const correctAnswerIndex = question.options.findIndex(option => option.is_correct);
                const userAnswer = userAnswers[index];

                return {
                    question_text: question.question_text,
                    options: question.options.map((option, optionIndex) => ({
                        ...option,
                        isSelected: userAnswer === optionIndex,
                        isCorrectAnswer: optionIndex === correctAnswerIndex,
                    })),
                };
            }),
            userAnswers,
        };

        res.json({
            success: true,
            data: quizResults
        });

    } catch (error) {
        console.error('Quiz result error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch quiz results'
        });
    }
});

module.exports.handler = serverless(app)