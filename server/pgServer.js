import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Test the database connection
supabase.from('student_login').select('count')
  .then(() => {
    console.log('Connected to Supabase');
    startServer();
  })
  .catch(err => {
    console.error('Error connecting to Supabase', err);
    process.exit(1);
  });

function startServer() {
    app.post('/signup', async (req, res) => {
        const { username, email, password, userType } = req.body;
        const table = userType === 'student' ? 'student_login' : 'teacher_login';

        try {
            const { data, error } = await supabase
                .from(table)
                .insert([{ username, email, password }])
                .select()
                .single();

            if (error) throw error;

            res.status(201).json({
                message: 'User registered successfully',
                userId: data.id
            });
        } catch (error) {
            console.error('Signup error:', error);
            res.status(500).json({ error: 'Registration failed' });
        }
    });

    app.post('/login', async (req, res) => {
        const { username, password, userType } = req.body;
        const table = userType === 'student' ? 'student_login' : 'teacher_login';

        try {
            const { data, error } = await supabase
                .from(table)
                .select('id, username, email')
                .eq('username', username)
                .eq('password', password)
                .single();

            if (error) throw error;

            if (data) {
                res.json({
                    success: true,
                    user: {
                        ...data,
                        userType
                    }
                });
            } else {
                res.status(401).json({ success: false, message: 'Invalid credentials' });
            }
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Login failed' });
        }
    });

    app.post('/change-password', async (req, res) => {
        const { username, currentPassword, newPassword, userType } = req.body;
        const table = userType === 'student' ? 'student_login' : 'teacher_login';

        try {
            // Verify current password
            const { data: verifyData, error: verifyError } = await supabase
                .from(table)
                .select('id')
                .eq('username', username)
                .eq('password', currentPassword)
                .single();

            if (verifyError || !verifyData) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            // Update password
            const { error: updateError } = await supabase
                .from(table)
                .update({ password: newPassword })
                .eq('username', username);

            if (updateError) throw updateError;

            res.json({ success: true, message: 'Password updated' });
        } catch (error) {
            console.error('Password change error:', error);
            res.status(500).json({ success: false, error: 'Password update failed' });
        }
    });

    app.get('/api/current-user/:userId/:userType', async (req, res) => {
        const { userId, userType } = req.params;
        const table = userType === 'student' ? 'student_login' : 'teacher_login';

        try {
            const { data, error } = await supabase
                .from(table)
                .select('id, username, email')
                .eq('id', userId)
                .single();

            if (error) throw error;

            if (data) {
                res.json({ ...data, userType });
            } else {
                res.status(404).json({ message: 'User not found' });
            }
        } catch (error) {
            console.error('Current user error:', error);
            res.status(500).json({ error: 'Failed to fetch user' });
        }
    });

    app.get('/api/subscriptions/:student_id', async (req, res) => {
        const { student_id } = req.params;
        try {
            const studentIdInt = parseInt(student_id, 10);
            if (isNaN(studentIdInt)) {
                return res.status(400).json({ error: 'Invalid student_id: must be a number' });
            }

            const { data, error } = await supabase
                .from('subscriptions')
                .select(`
                    teacher_id,
                    teacher_login (
                        id,
                        username,
                        email
                    )
                `)
                .eq('student_id', studentIdInt);

            if (error) throw error;

            res.json(data.map(sub => sub.teacher_login));
        } catch (error) {
            console.error('Error fetching subscriptions:', error);
            res.status(500).json({ error: 'Failed to fetch subscriptions' });
        }
    });

    app.post('/api/quizzes', async (req, res) => {
        const { quiz_name, quiz_code, created_by, questions, due_date } = req.body;

        try {
            const { data, error } = await supabase
                .from('quizzes')
                .insert([{
                    quiz_name,
                    quiz_code,
                    created_by,
                    questions: { questions },
                    due_date
                }])
                .select()
                .single();

            if (error) throw error;

            res.status(201).json({
                message: 'Quiz created successfully',
                quizId: data.quiz_id
            });
        } catch (error) {
            console.error('Error creating quiz:', error);
            res.status(500).json({ message: 'Failed to create quiz', error: error.message });
        }
    });

    app.put('/api/quizzes/:quiz_id', async (req, res) => {
        const { quiz_id } = req.params;
        const { quiz_name, due_date, questions } = req.body;

        try {
            const { data, error } = await supabase
                .from('quizzes')
                .update({
                    quiz_name,
                    due_date,
                    questions: { questions }
                })
                .eq('quiz_id', quiz_id)
                .select()
                .single();

            if (error) throw error;

            if (!data) {
                return res.status(404).json({ message: 'Quiz not found' });
            }

            res.status(200).json({ message: 'Quiz updated successfully' });
        } catch (error) {
            console.error('Error updating quiz:', error);
            res.status(500).json({ message: 'Failed to update quiz', error: error.message });
        }
    });

    app.get('/api/quizzes/:quiz_code', async (req, res) => {
        const { quiz_code } = req.params;

        try {
            const { data, error } = await supabase
                .from('quizzes')
                .select('quiz_id, quiz_name, questions')
                .eq('quiz_code', quiz_code)
                .single();

            if (error) throw error;

            if (!data) {
                return res.status(404).json({ message: 'Quiz not found' });
            }

            res.status(200).json({
                quiz_id: data.quiz_id,
                quiz_name: data.quiz_name,
                questions: data.questions
            });
        } catch (error) {
            console.error('Error fetching quiz:', error);
            res.status(500).json({ message: 'Failed to fetch quiz', error: error.message });
        }
    });

    app.get('/api/quizzes/id/:quiz_id', async (req, res) => {
        const { quiz_id } = req.params;

        try {
            const { data, error } = await supabase
                .from('quizzes')
                .select('quiz_id, quiz_code, quiz_name')
                .eq('quiz_id', quiz_id)
                .single();

            if (error) throw error;

            if (!data) {
                return res.status(404).json({ message: 'Quiz not found' });
            }

            res.status(200).json({
                quiz_id: data.quiz_id,
                quiz_code: data.quiz_code,
                quiz_name: data.quiz_name
            });
        } catch (error) {
            console.error('Error fetching quiz:', error);
            res.status(500).json({ message: 'Failed to fetch quiz', error: error.message });
        }
    });

    app.post('/api/submit-quiz', async (req, res) => {
        const { quiz_code, user_id, answers } = req.body;
        try {
            const quizQuery = `
                SELECT quiz_id, questions
                FROM quizzes
                WHERE quiz_code = $1;
            `;
            const quizResult = await supabase
                .from('quizzes')
                .select('quiz_id, questions')
                .eq('quiz_code', quiz_code)
                .single();
            if (quizResult.error) throw quizResult.error;

            const quiz = quizResult.data;
            const questions = quiz.questions.questions;

            let score = 0;
            let totalQuestions = questions.length;

            questions.forEach((question, index) => {
                const correctAnswerIndex = question.options.findIndex(option => option.is_correct);
                const userAnswer = parseInt(answers[index]);
                if (correctAnswerIndex === userAnswer) {
                    score++;
                }
            });

            const insertQuery = `
                INSERT INTO quiz_attempts (quiz_id, user_id, score, total_questions, answers)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING attempt_id;
            `;
            const insertValues = [quiz.quiz_id, user_id, score, totalQuestions, JSON.stringify(answers)];
            const { data: insertResult, error: insertError } = await supabase
                .from('quiz_attempts')
                .insert(insertValues)
                .select()
                .single();

            if (insertError) throw insertError;

            const attemptId = insertResult.attempt_id;

            res.status(201).json({ attemptId, score, totalQuestions });
        } catch (error) {
            console.error('Error submitting quiz:', error);
            res.status(500).json({ message: 'Failed to submit quiz', error: error.message });
        }
    });

    app.get('/api/quiz-result/:quiz_code/:user_id', async (req, res) => {
        const { quiz_code, user_id } = req.params;

        try {
            const quizQuery = `
                SELECT q.quiz_id, q.quiz_name, q.questions, qa.attempt_id, qa.answers, qa.score, qa.total_questions
                FROM quizzes q
                LEFT JOIN quiz_attempts qa ON q.quiz_id = qa.quiz_id AND qa.user_id = $2
                WHERE q.quiz_code = $1
                ORDER BY qa.attempt_date DESC
                LIMIT 1;
            `;
            const quizResult = await supabase
                .from('quiz_attempts')
                .select('quiz_id, quiz_name, questions, attempt_id, answers, score, total_questions')
                .eq('quiz_code', quiz_code)
                .eq('user_id', user_id)
                .order('attempt_date', { ascending: false })
                .limit(1);

            if (quizResult.error) throw quizResult.error;

            if (quizResult.data.length === 0) {
                return res.status(404).json({ message: 'Quiz not found' });
            }

            const quizData = quizResult.data[0];
            const questions = quizData.questions.questions;

            let userAnswers = {};
            if (quizData.answers) {
                userAnswers = typeof quizData.answers === 'string' ? JSON.parse(quizData.answers) : quizData.answers;
            }

            const quizResults = {
                quiz_id: quizData.quiz_id,
                quizName: quizData.quiz_name,
                attemptId: quizData.attempt_id,
                score: quizData.score || 0,
                totalQuestions: quizData.total_questions || questions.length,
                questions: questions.map((question, index) => {
                    const correctAnswerIndex = question.options.findIndex(option => option.is_correct);
                    const userAnswer = userAnswers[index];

                    return {
                        question_text: question.question_text,
                        options: question.options.map((option, optionIndex) => ({
                            ...option,
                            isSelected: userAnswer == optionIndex,
                            isCorrectAnswer: optionIndex == correctAnswerIndex,
                        })),
                    };
                }),
                userAnswers: userAnswers
            };

            res.json(quizResults);
        } catch (error) {
            console.error('Error fetching quiz result:', error);
            res.status(500).json({ message: 'Failed to fetch quiz result', error: error.message });
        }
    });

    app.get('/api/check-quiz-attempt/:quizCode/:userId', async (req, res) => {
        const { quizCode, userId } = req.params;

        try {
            const quizQuery = 'SELECT quiz_id FROM quizzes WHERE quiz_code = $1';
            const quizResult = await supabase
                .from('quizzes')
                .select('quiz_id')
                .eq('quiz_code', quizCode);

            if (quizResult.error) throw quizResult.error;

            if (quizResult.data.length === 0) {
                return res.status(404).json({ message: 'Quiz not found' });
            }

            const quizId = quizResult.data[0].quiz_id;

            const attemptQuery = `
                SELECT qa.*, rr.status 
                FROM quiz_attempts qa
                LEFT JOIN retest_requests rr ON qa.attempt_id = rr.attempt_id
                WHERE qa.quiz_id = $1 AND qa.user_id = $2
                ORDER BY qa.attempt_date DESC
                LIMIT 1
            `;
            const attemptResult = await supabase
                .from('quiz_attempts')
                .select('*')
                .eq('quiz_id', quizId)
                .eq('user_id', userId)
                .order('attempt_date', { ascending: false })
                .limit(1);

            if (attemptResult.error) throw attemptResult.error;

            if (attemptResult.data.length > 0) {
                const latestAttempt = attemptResult.data[0];
                const canRetake = latestAttempt.status === 'approved';
                res.json({
                    hasAttempted: !canRetake,
                    message: canRetake ? 'Retest approved' : 'You have already attempted this quiz.',
                    attemptId: latestAttempt.attempt_id
                });
            } else {
                res.json({ hasAttempted: false });
            }
        } catch (error) {
            console.error('Error checking quiz attempt:', error);
            res.status(500).json({ message: 'Error checking quiz attempt', error: error.message });
        }
    });

    app.get('/api/recent-results/:user_id', async (req, res) => {
        const { user_id } = req.params;
        try {
            const query = `
                SELECT q.quiz_name, qa.attempt_id, qa.score, qa.total_questions, qa.attempt_date
                FROM quiz_attempts qa
                JOIN quizzes q ON q.quiz_id = qa.quiz_id
                WHERE qa.user_id = $1
                ORDER BY qa.attempt_date DESC
                LIMIT 5;
            `;
            const result = await supabase
                .from('quiz_attempts')
                .select('quiz_name, attempt_id, score, total_questions, attempt_date')
                .eq('user_id', user_id)
                .order('attempt_date', { ascending: false })
                .limit(5);
            res.json(result.data);
        } catch (error) {
            console.error('Error fetching recent results:', error);
            res.status(500).json({ message: 'Failed to fetch recent results' });
        }
    });

    app.get('/api/user-stats/:user_id', async (req, res) => {
        const { user_id } = req.params;
        try {
            const query = `
                SELECT 
                    COUNT(*) as total_attempts,
                    COALESCE(AVG(CAST(score AS FLOAT) / total_questions * 100), 0) as average_score,
                    COUNT(DISTINCT quiz_id) as completed_quizzes
                FROM quiz_attempts
                WHERE user_id = $1;
            `;
            const result = await supabase
                .from('quiz_attempts')
                .select('count(*) as total_attempts, AVG(CAST(score AS FLOAT) / total_questions * 100) as average_score, COUNT(DISTINCT quiz_id) as completed_quizzes')
                .eq('user_id', user_id);
            res.json(result.data[0]);
        } catch (error) {
            console.error('Error fetching user stats:', error);
            res.status(500).json({ message: 'Failed to fetch user stats' });
        }
    });

    app.get('/api/teachers', async (req, res) => {
        try {
            const result = await supabase
                .from('teacher_login')
                .select('id AS id, username, email');
            res.json(result.data);
        } catch (error) {
            console.error('Error fetching teachers:', error);
            res.status(500).json({ error: 'Failed to fetch teachers' });
        }
    });

    app.post('/api/subscribe', async (req, res) => {
        const { student_id, teacher_id } = req.body;
        try {
            await supabase
                .from('subscriptions')
                .insert([{ student_id, teacher_id }])
                .onConflict('student_id, teacher_id')
                .doNothing();
            res.json({ success: true });
        } catch (error) {
            console.error('Subscription error:', error);
            res.status(500).json({ error: 'Subscription failed' });
        }
    });

    app.post('/api/unsubscribe', async (req, res) => {
        const { student_id, teacher_id } = req.body;
        try {
            await supabase
                .from('subscriptions')
                .delete()
                .eq('student_id', student_id)
                .eq('teacher_id', teacher_id);
            res.json({ success: true });
        } catch (error) {
            console.error('Unsubscription error:', error);
            res.status(500).json({ error: 'Unsubscription failed' });
        }
    });

    app.get('/api/upcoming-quizzes/:student_id', async (req, res) => {
        const { student_id } = req.params;
        try {
            const query = `
                SELECT q.*, t.username AS teacher_name
                FROM quizzes q
                JOIN teacher_login t ON q.created_by = t.id
                WHERE q.created_by IN (
                    SELECT teacher_id 
                    FROM subscriptions 
                    WHERE student_id = $1
                )
                AND q.due_date > NOW()
                AND NOT EXISTS (
                    SELECT 1 
                    FROM quiz_attempts 
                    WHERE quiz_id = q.quiz_id 
                    AND user_id = $1
                )
                ORDER BY q.due_date ASC
            `;
            const result = await supabase
                .from('quizzes')
                .select('*')
                .join('teacher_login', 'quizzes.created_by', 'teacher_login.id')
                .join('subscriptions', 'quizzes.created_by', 'subscriptions.teacher_id')
                .eq('subscriptions.student_id', student_id)
                .eq('quizzes.due_date', null)
                .eq('quizzes.due_date', '>', supabase.from('CURRENT_TIMESTAMP').select('CURRENT_TIMESTAMP'))
                .eq('quizzes.due_date', '>', supabase.from('CURRENT_TIMESTAMP').select('CURRENT_TIMESTAMP'))
                .order('quizzes.due_date', { ascending: true });
            res.json(result.data);
        } catch (error) {
            console.error('Error fetching quizzes:', error);
            res.status(500).json({ error: 'Failed to fetch quizzes' });
        }
    });

    app.get('/api/attempted-quizzes/:user_id', async (req, res) => {
        const { user_id } = req.params;
        try {
            const query = `
                SELECT DISTINCT q.quiz_id, q.quiz_name, q.quiz_code, t.username AS teacher_name, q.due_date
                FROM quiz_attempts qa
                JOIN quizzes q ON qa.quiz_id = q.quiz_id
                JOIN teacher_login t ON q.created_by = t.id
                WHERE qa.user_id = $1;
            `;
            const result = await supabase
                .from('quiz_attempts')
                .select('DISTINCT quiz_id, quiz_name, quiz_code, teacher_login.username AS teacher_name, quizzes.due_date')
                .eq('user_id', user_id);
            res.json(result.data);
        } catch (error) {
            console.error('Error fetching attempted quizzes:', error);
            res.status(500).json({ message: 'Failed to fetch attempted quizzes' });
        }
    });

    app.get('/api/quizzes/created/:user_id', async (req, res) => {
        const { user_id } = req.params;
        try {
            const query = `
                SELECT quiz_id, quiz_name, quiz_code, questions, due_date, created_at
                FROM quizzes
                WHERE created_by = $1
                ORDER BY created_at DESC
            `;
            const result = await supabase
                .from('quizzes')
                .select('quiz_id, quiz_name, quiz_code, questions, due_date, created_at')
                .eq('created_by', user_id)
                .order('created_at', { ascending: false });
            res.json(result.data);
        } catch (error) {
            console.error('Error fetching created quizzes:', error);
            res.status(500).json({ error: 'Failed to fetch created quizzes' });
        }
    });

    app.get('/api/quiz-attempts/:quiz_code', async (req, res) => {
        const { quiz_code } = req.params;

        try {
            const query = `
                SELECT 
                    qa.attempt_id,
                    qa.user_id,
                    s.username AS student_username,
                    qa.score,
                    qa.total_questions,
                    qa.attempt_date,
                    q.quiz_name,
                    rr.request_id,
                    rr.status AS retest_status
                FROM quiz_attempts qa
                JOIN quizzes q ON qa.quiz_id = q.quiz_id
                JOIN student_login s ON qa.user_id = s.id
                LEFT JOIN retest_requests rr ON qa.attempt_id = rr.attempt_id
                WHERE q.quiz_code = $1
                ORDER BY qa.attempt_date DESC;
            `;
            const result = await supabase
                .from('quiz_attempts')
                .select('attempt_id, user_id, student_login.username AS student_username, score, total_questions, attempt_date, quizzes.quiz_name, retest_requests.request_id, retest_requests.status AS retest_status')
                .eq('quiz_code', quiz_code)
                .order('attempt_date', { ascending: false });

            if (result.error) throw result.error;

            if (result.data.length === 0) {
                return res.status(404).json({ message: 'No attempts found for this quiz' });
            }

            res.json(result.data);
        } catch (error) {
            console.error('Error fetching quiz attempts:', error);
            res.status(500).json({ error: 'Failed to fetch quiz attempts' });
        }
    });

    // Retest Requests Endpoints
    app.post('/api/retest-requests', async (req, res) => {
        try {
            console.log('Received retest request:', req.body);
            const { student_id, quiz_id, attempt_id } = req.body;
            
            if (!quiz_id) {
                console.error('Missing quiz_id in request');
                return res.status(400).json({ error: 'quiz_id is required' });
            }

            const result = await supabase
                .from('retest_requests')
                .insert([{ student_id, quiz_id, attempt_id }])
                .select()
                .single();
            res.status(201).json(result.data);
        } catch (error) {
            console.error('Error creating retest request:', error);
            res.status(500).json({ error: 'Failed to create retest request' });
        }
    });

    app.get('/api/retest-requests/teacher/:teacher_id', async (req, res) => {
        try {
            const { teacher_id } = req.params;
            const query = `
                SELECT 
                    rr.request_id,
                    rr.student_id,
                    sl.username AS student_name,
                    q.quiz_id,
                    q.quiz_name,
                    q.quiz_code,
                    rr.attempt_id,
                    rr.request_date,
                    rr.status
                FROM retest_requests rr
                JOIN student_login sl ON rr.student_id = sl.id
                JOIN quizzes q ON rr.quiz_id = q.quiz_id
                WHERE q.created_by = $1
                ORDER BY rr.request_date DESC
            `;
            const result = await supabase
                .from('retest_requests')
                .select('request_id, student_id, student_login.username AS student_name, quiz_id, quizzes.quiz_name, quizzes.quiz_code, attempt_id, request_date, status')
                .eq('teacher_id', teacher_id)
                .order('request_date', { ascending: false });
            res.json(result.data);
        } catch (error) {
            console.error('Error fetching retest requests:', error);
            res.status(500).json({ error: 'Failed to fetch retest requests' });
        }
    });

    app.put('/api/retest-requests/:request_id', async (req, res) => {
        try {
            const { request_id } = req.params;
            const { status, teacher_password } = req.body;

            // Verify teacher password
            const teacherQuery = `
            SELECT t.password 
            FROM quizzes q
            JOIN teacher_login t ON q.created_by = t.id
            JOIN retest_requests rr ON q.quiz_id = rr.quiz_id
            WHERE rr.request_id = $1
        `;
            const teacherResult = await supabase
                .from('teacher_login')
                .select('password')
                .eq('id', teacher_id);

            if (teacherResult.error || teacherResult.data.length === 0 || teacherResult.data[0].password !== teacher_password) {
                return res.status(401).json({ error: 'Invalid teacher password' });
            }

            // Update retest request status
            const updateQuery = `
            UPDATE retest_requests 
            SET status = $1,
                updated_at = NOW()
            WHERE request_id = $2
            RETURNING *
        `;
            const result = await supabase
                .from('retest_requests')
                .update({ status, updated_at: supabase.from('CURRENT_TIMESTAMP').select('CURRENT_TIMESTAMP') })
                .eq('request_id', request_id)
                .select()
                .single();

            if (result.error) throw result.error;

            if (result.data.status === 'approved') {
                // First, delete the retest request
                await supabase
                    .from('retest_requests')
                    .delete()
                    .eq('request_id', request_id);

                // Then, delete the quiz attempt
                await supabase
                    .from('quiz_attempts')
                    .delete()
                    .eq('attempt_id', result.data.attempt_id);
            }

            res.json(result.data);
        } catch (error) {
            console.error('Error updating retest request:', error);
            res.status(500).json({ error: 'Failed to update retest request' });
        }
    });

    app.put('/api/teachers/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { email, name } = req.body;

            const result = await supabase
                .from('teacher_login')
                .update({ email, username: name })
                .eq('id', id)
                .select()
                .single();

            if (result.error) throw result.error;

            if (!result.data) {
                return res.status(404).json({ message: 'Teacher not found' });
            }

            res.json(result.data);
        } catch (error) {
            console.error('Error updating teacher profile:', error);
            res.status(500).json({ message: 'Failed to update profile' });
        }
    });

    app.put('/api/students/:id', async (req, res) => {
        try {
            const { id } = req.params;
            const { email, name } = req.body;

            const result = await supabase
                .from('student_login')
                .update({ email, username: name })
                .eq('id', id)
                .select()
                .single();

            if (result.error) throw result.error;

            if (!result.data) {
                return res.status(404).json({ message: 'Student not found' });
            }

            res.json(result.data);
        } catch (error) {
            console.error('Error updating student profile:', error);
            res.status(500).json({ message: 'Failed to update profile' });
        }
    });

    app.get('/api/quiz-results/:quiz_code/leaderboard', async (req, res) => {
        const { quiz_code } = req.params;

        try {
            // First get the quiz details
            const quizQuery = `
                SELECT quiz_id, quiz_name
                FROM quizzes
                WHERE quiz_code = $1;
            `;
            const quizResult = await supabase
                .from('quizzes')
                .select('quiz_id, quiz_name')
                .eq('quiz_code', quiz_code)
                .single();

            if (quizResult.error) throw quizResult.error;

            if (!quizResult.data) {
                return res.status(404).json({ message: 'Quiz not found' });
            }

            const quizId = quizResult.data.quiz_id;
            const quizName = quizResult.data.quiz_name;

            // Then get the leaderboard data with NULL handling
            const leaderboardQuery = `
                WITH RankedResults AS (
                    SELECT 
                        qa.user_id,
                        s.username AS student_name,
                        COALESCE(qa.score, 0) as score,
                        COALESCE(qa.total_questions, 1) as total_questions,
                        qa.attempt_date,
                        DENSE_RANK() OVER (
                            ORDER BY 
                                (CAST(COALESCE(qa.score, 0) AS FLOAT) / NULLIF(COALESCE(qa.total_questions, 1), 0)) DESC,
                                qa.attempt_date ASC
                        ) as rank
                    FROM quiz_attempts qa
                    JOIN student_login s ON qa.user_id = s.id
                    WHERE qa.quiz_id = $1
                )
                SELECT * FROM RankedResults
                ORDER BY rank;
            `;
            const leaderboardResult = await supabase
                .from('quiz_attempts')
                .select('user_id, student_login.username AS student_name, score, total_questions, attempt_date')
                .eq('quiz_id', quizId)
                .order('score', { ascending: false })
                .order('attempt_date', { ascending: true });

            if (leaderboardResult.error) throw leaderboardResult.error;

            if (leaderboardResult.data.length === 0) {
                return res.status(404).json({ message: 'No attempts found for this quiz' });
            }

            // Format the data for the frontend
            const leaderboardData = {
                quiz_name: quizName,
                rankings: leaderboardResult.data.map(row => ({
                    student_id: row.user_id,
                    student_name: row.student_name,
                    score: Math.round((row.score / row.total_questions) * 100) || 0,
                    rank: row.rank
                }))
            };

            res.json(leaderboardData);
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            res.status(500).json({ 
                error: 'Failed to fetch leaderboard data',
                details: error.message 
            });
        }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}