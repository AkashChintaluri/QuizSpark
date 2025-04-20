import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint for verification
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Initialize Supabase client with hardcoded credentials
const SUPABASE_URL="https://hntrpejpiboxnlbzrbbc.supabase.co"
const SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhudHJwZWpwaWJveG5sYnpyYmJjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MzI0MDg1MywiZXhwIjoyMDU4ODE2ODUzfQ.1ZCETVyCJaxcC-fqabKqrjWUESRagY9x0TcOgNTp0tI"
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Test the Supabase connection
async function testConnection() {
    try {
        const { data, error } = await supabase.from('quizzes').select('quiz_id').limit(1);
        if (error) throw error;
        console.log('Connected to Supabase');
        startServer();
    } catch (err) {
        console.error('Error connecting to Supabase:', err);
        process.exit(1);
    }
}

testConnection();

function startServer() {
    app.post('/signup', async (req, res) => {
        const { username, email, password, userType } = req.body;
        const table = userType === 'student' ? 'student_login' : 'teacher_login';

        try {
            const { data, error } = await supabase
                .from(table)
                .insert({ username, email, password })
                .select('id')
                .single();

            if (error) throw error;

            res.status(201).json({
                message: 'User registered successfully',
                userId: data.id,
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

            if (error || !data) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

            res.json({
                success: true,
                user: {
                    ...data,
                    userType,
                },
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Login failed' });
        }
    });

    app.post('/change-password', async (req, res) => {
        const { username, currentPassword, newPassword, userType } = req.body;
        const table = userType === 'student' ? 'student_login' : 'teacher_login';

        try {
            const { data: user, error: verifyError } = await supabase
                .from(table)
                .select('id')
                .eq('username', username)
                .eq('password', currentPassword)
                .single();

            if (verifyError || !user) {
                return res.status(401).json({ success: false, message: 'Invalid credentials' });
            }

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

            if (error || !data) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.json({ ...data, userType });
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
                .select('teacher_id')
                .eq('student_id', studentIdInt);

            if (error) throw error;

            const teacherIds = data.map(row => row.teacher_id);
            const { data: teachers, error: teacherError } = await supabase
                .from('teacher_login')
                .select('id, username, email')
                .in('id', teacherIds.length ? teacherIds : [0]); // Avoid empty IN clause

            if (teacherError) throw teacherError;

            res.json(teachers || []);
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
                .insert({
                    quiz_name,
                    quiz_code,
                    created_by,
                    questions: { questions },
                    due_date,
                })
                .select('quiz_id')
                .single();

            if (error) throw error;

            res.status(201).json({
                message: 'Quiz created successfully',
                quizId: data.quiz_id,
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
                    questions,
                })
                .eq('quiz_id', quiz_id)
                .select('quiz_id')
                .single();

            if (error || !data) {
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

            if (error || !data) {
                return res.status(404).json({ message: 'Quiz not found' });
            }

            res.status(200).json({
                quiz_id: data.quiz_id,
                quiz_name: data.quiz_name,
                questions: data.questions,
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

            if (error || !data) {
                return res.status(404).json({ message: 'Quiz not found' });
            }

            res.status(200).json({
                quiz_id: data.quiz_id,
                quiz_code: data.quiz_code,
                quiz_name: data.quiz_name,
            });
        } catch (error) {
            console.error('Error fetching quiz:', error);
            res.status(500).json({ message: 'Failed to fetch quiz', error: error.message });
        }
    });

    app.post('/api/submit-quiz', async (req, res) => {
        const { quiz_code, user_id, answers } = req.body;

        try {
            const { data: quiz, error: quizError } = await supabase
                .from('quizzes')
                .select('quiz_id, questions')
                .eq('quiz_code', quiz_code)
                .single();

            if (quizError || !quiz) {
                return res.status(404).json({ message: 'Quiz not found' });
            }

            const questions = quiz.questions.questions;
            let score = 0;
            const totalQuestions = questions.length;

            questions.forEach((question, index) => {
                const correctAnswerIndex = question.options.findIndex((option) => option.is_correct);
                const userAnswer = parseInt(answers[index]);
                if (correctAnswerIndex === userAnswer) {
                    score++;
                }
            });

            const { data, error } = await supabase
                .from('quiz_attempts')
                .insert({
                    quiz_id: quiz.quiz_id,
                    user_id,
                    score,
                    total_questions: totalQuestions,
                    answers,
                })
                .select('attempt_id')
                .single();

            if (error) throw error;

            res.status(201).json({ attemptId: data.attempt_id, score, totalQuestions });
        } catch (error) {
            console.error('Error submitting quiz:', error);
            res.status(500).json({ message: 'Failed to submit quiz', error: error.message });
        }
    });

    app.get('/api/quiz-result/:quiz_code/:user_id', async (req, res) => {
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
                return res.status(404).json({ message: 'Quiz not found' });
            }

            const quizData = data;
            const questions = quizData.questions.questions;
            const attempt = quizData.quiz_attempts[0] || {};

            const userAnswers = attempt.answers || {};

            const quizResults = {
                quiz_id: quizData.quiz_id,
                quizName: quizData.quiz_name,
                attemptId: attempt.attempt_id,
                score: attempt.score || 0,
                totalQuestions: attempt.total_questions || questions.length,
                questions: questions.map((question, index) => {
                    const correctAnswerIndex = question.options.findIndex((option) => option.is_correct);
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
                userAnswers,
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
            const { data: quiz, error: quizError } = await supabase
                .from('quizzes')
                .select('quiz_id')
                .eq('quiz_code', quizCode)
                .single();

            if (quizError || !quiz) {
                return res.status(404).json({ message: 'Quiz not found' });
            }

            const { data: attempt, error: attemptError } = await supabase
                .from('quiz_attempts')
                .select(`
                    *,
                    retest_requests (
                        status
                    )
                `)
                .eq('quiz_id', quiz.quiz_id)
                .eq('user_id', userId)
                .order('attempt_date', { ascending: false })
                .limit(1)
                .single();

            if (attemptError || !attempt) {
                return res.json({ hasAttempted: false });
            }

            const canRetake = attempt.retest_requests?.status === 'approved';
            res.json({
                hasAttempted: !canRetake,
                message: canRetake ? 'Retest approved' : 'You have already attempted this quiz.',
                attemptId: attempt.attempt_id,
            });
        } catch (error) {
            console.error('Error checking quiz attempt:', error);
            res.status(500).json({ message: 'Error checking quiz attempt', error: error.message });
        }
    });

    app.get('/api/recent-results/:user_id', async (req, res) => {
        const { user_id } = req.params;

        try {
            const userIdInt = parseInt(user_id, 10);
            if (isNaN(userIdInt)) {
                return res.status(400).json({ error: 'Invalid user_id: must be a number' });
            }

            const { data, error } = await supabase
                .from('quiz_attempts')
                .select(`
                    attempt_id,
                    score,
                    total_questions,
                    attempt_date,
                    quizzes (
                        quiz_name
                    )
                `)
                .eq('user_id', userIdInt)
                .order('attempt_date', { ascending: false })
                .limit(5);

            if (error) throw error;

            res.json(
                data.map((row) => ({
                    quiz_name: row.quizzes?.quiz_name || 'Unknown Quiz',
                    attempt_id: row.attempt_id,
                    score: row.score,
                    total_questions: row.total_questions,
                    attempt_date: row.attempt_date,
                }))
            );
        } catch (error) {
            console.error('Error fetching recent results:', error);
            res.status(500).json({ message: 'Failed to fetch recent results', error: error.message });
        }
    });

    app.get('/api/user-stats/:user_id', async (req, res) => {
        const { user_id } = req.params;

        try {
            const userIdInt = parseInt(user_id, 10);
            if (isNaN(userIdInt)) {
                return res.status(400).json({ error: 'Invalid user_id: must be a number' });
            }

            const { data, error } = await supabase
                .from('quiz_attempts')
                .select(`
                score,
                total_questions,
                quiz_id,
                quizzes (
                    quiz_name
                )
            `)
                .eq('user_id', userIdInt);

            if (error) throw error;

            const stats = {
                total_attempts: data.length,
                average_score:
                    data.length > 0
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

            res.json(stats);
        } catch (error) {
            console.error('Error fetching user stats:', error);
            res.status(500).json({ message: 'Failed to fetch user stats', details: error.message });
        }
    });

    app.get('/api/teachers', async (req, res) => {
        try {
            const { data, error } = await supabase.from('teacher_login').select('id, username, email');

            if (error) throw error;

            res.json(data || []);
        } catch (error) {
            console.error('Error fetching teachers:', error);
            res.status(500).json({ error: 'Failed to fetch teachers' });
        }
    });

    app.post('/api/subscribe', async (req, res) => {
        const { student_id, teacher_id } = req.body;

        try {
            const { data, error } = await supabase
                .from('subscriptions')
                .insert({ student_id, teacher_id })
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    return res.status(200).json({ success: true, message: 'Already subscribed' });
                }
                throw error;
            }

            res.json({ success: true, subscription: data });
        } catch (error) {
            console.error('Subscription error:', error);
            res.status(500).json({ error: 'Subscription failed', details: error.message });
        }
    });

    app.post('/api/unsubscribe', async (req, res) => {
        const { student_id, teacher_id } = req.body;

        try {
            const { error } = await supabase
                .from('subscriptions')
                .delete()
                .eq('student_id', student_id)
                .eq('teacher_id', teacher_id);

            if (error) throw error;

            res.json({ success: true });
        } catch (error) {
            console.error('Unsubscription error:', error);
            res.status(500).json({ error: 'Unsubscription failed' });
        }
    });

    app.get('/api/upcoming-quizzes/:student_id', async (req, res) => {
        const { student_id } = req.params;

        try {
            const studentIdInt = parseInt(student_id, 10);
            if (isNaN(studentIdInt)) {
                return res.status(400).json({ error: 'Invalid student_id: must be a number' });
            }

            // Fetch teacher_ids from subscriptions
            const { data: subscriptionData, error: subError } = await supabase
                .from('subscriptions')
                .select('teacher_id')
                .eq('student_id', studentIdInt);

            if (subError) throw subError;

            const teacherIds = subscriptionData.map(row => row.teacher_id);

            // If no subscriptions, return empty array
            if (!teacherIds.length) {
                return res.json([]);
            }

            // First get all quizzes from subscribed teachers that haven't passed due date
            const { data: quizzes, error: quizzesError } = await supabase
                .from('quizzes')
                .select(`
                    quiz_id,
                    quiz_name,
                    quiz_code,
                    due_date,
                    created_by,
                    teacher_login (
                        username
                    )
                `)
                .in('created_by', teacherIds)
                .gt('due_date', new Date().toISOString());

            if (quizzesError) throw quizzesError;

            // Then get all attempted quizzes for this student
            const { data: attempts, error: attemptsError } = await supabase
                .from('quiz_attempts')
                .select('quiz_id')
                .eq('user_id', studentIdInt);

            if (attemptsError) throw attemptsError;

            // Create a set of attempted quiz_ids for quick lookup
            const attemptedQuizIds = new Set(attempts.map(attempt => attempt.quiz_id));

            // Filter out attempted quizzes
            const upcomingQuizzes = quizzes.filter(quiz => !attemptedQuizIds.has(quiz.quiz_id));

            res.json(
                upcomingQuizzes.map((quiz) => ({
                    quiz_id: quiz.quiz_id,
                    quiz_name: quiz.quiz_name,
                    quiz_code: quiz.quiz_code,
                    due_date: quiz.due_date,
                    teacher_name: quiz.teacher_login?.username || 'Unknown Teacher',
                }))
            );
        } catch (error) {
            console.error('Error fetching upcoming quizzes:', error);
            res.status(500).json({ error: 'Failed to fetch upcoming quizzes', details: error.message });
        }
    });

    app.get('/api/quizzes/created/:teacher_id', async (req, res) => {
        const { teacher_id } = req.params;
        try {
          const teacherIdInt = parseInt(teacher_id, 10);
          if (isNaN(teacherIdInt)) {
            return res.status(400).json({ error: 'Invalid teacher_id: must be a number' });
          }
          const { data, error } = await supabase
            .from('quizzes')
            .select('quiz_id, quiz_name, quiz_code, due_date, created_at, questions')
            .eq('created_by', teacherIdInt);
          if (error) throw error;
          res.json(data || []);
        } catch (error) {
          console.error('Error fetching created quizzes:', error);
          res.status(500).json({ error: 'Failed to fetch quizzes' });
        }
    });

    app.get('/api/attempted-quizzes/:user_id', async (req, res) => {
        const { user_id } = req.params;

        try {
            const userIdInt = parseInt(user_id, 10);
            if (isNaN(userIdInt)) {
                return res.status(400).json({ error: 'Invalid user_id: must be a number' });
            }

            const { data, error } = await supabase
                .from('quiz_attempts')
                .select(`
                    quiz_id,
                    quizzes (
                        quiz_id,
                        quiz_name,
                        quiz_code,
                        due_date,
                        teacher_login (
                            username
                        )
                    )
                `)
                .eq('user_id', userIdInt);

            if (error) throw error;

            // Ensure unique quiz_ids using Set
            const uniqueQuizzes = Array.from(
                new Set(data.map(row => row.quiz_id))
            ).map(quiz_id => {
                const row = data.find(r => r.quiz_id === quiz_id);
                return {
                    quiz_id: row.quizzes?.quiz_id,
                    quiz_name: row.quizzes?.quiz_name || 'Unknown Quiz',
                    quiz_code: row.quizzes?.quiz_code,
                    teacher_name: row.quizzes?.teacher_login?.username || 'Unknown Teacher',
                    due_date: row.quizzes?.due_date,
                };
            });

            res.json(uniqueQuizzes);
        } catch (error) {
            console.error('Error fetching attempted quizzes:', error);
            res.status(500).json({ message: 'Failed to fetch attempted quizzes', details: error.message });
        }
    });

    app.get('/api/quiz-attempts/:quiz_code', async (req, res) => {
        const { quiz_code } = req.params;

        try {
            // Verify quiz exists
            const { data: quiz, error: quizError } = await supabase
                .from('quizzes')
                .select('quiz_id, quiz_name')
                .eq('quiz_code', quiz_code)
                .single();

            if (quizError || !quiz) {
                return res.status(404).json({ message: 'Quiz not found' });
            }

            const { data, error } = await supabase
                .from('quiz_attempts')
                .select(`
                attempt_id,
                user_id,
                score,
                total_questions,
                attempt_date,
                student_login (
                    username
                ),
                quizzes (
                    quiz_name
                ),
                retest_requests (
                    request_id,
                    status
                )
            `)
                .eq('quiz_id', quiz.quiz_id)
                .order('attempt_date', { ascending: false });

            if (error) throw error;

            if (!data.length) {
                return res.status(200).json([]);
            }

            res.json(
                data.map((row) => ({
                    attempt_id: row.attempt_id,
                    user_id: row.user_id,
                    student_username: row.student_login?.username || 'Unknown Student',
                    score: row.score,
                    total_questions: row.total_questions,
                    attempt_date: row.attempt_date,
                    quiz_name: row.quizzes?.quiz_name || quiz.quiz_name,
                    request_id: row.retest_requests?.request_id,
                    retest_status: row.retest_requests?.status,
                }))
            );
        } catch (error) {
            console.error('Error fetching quiz attempts:', error);
            res.status(500).json({ error: 'Failed to fetch quiz attempts', details: error.message });
        }
    });

    app.post('/api/retest-requests', async (req, res) => {
        const { student_id, quiz_id, attempt_id } = req.body;

        try {
            if (!quiz_id) {
                return res.status(400).json({ error: 'quiz_id is required' });
            }

            const { data, error } = await supabase
                .from('retest_requests')
                .insert({ student_id, quiz_id, attempt_id })
                .select()
                .single();

            if (error) throw error;

            res.status(201).json(data);
        } catch (error) {
            console.error('Error creating retest request:', error);
            res.status(500).json({ error: 'Failed to create retest request', details: error.message });
        }
    });

    app.get('/api/retest-requests/teacher/:teacher_id', async (req, res) => {
        const { teacher_id } = req.params;

        try {
            const teacherIdInt = parseInt(teacher_id, 10);
            if (isNaN(teacherIdInt)) {
                return res.status(400).json({ error: 'Invalid teacher_id: must be a number' });
            }

            const { data, error } = await supabase
                .from('retest_requests')
                .select(`
                    request_id,
                    student_id,
                    quiz_id,
                    attempt_id,
                    request_date,
                    status,
                    student_login (
                        username
                    ),
                    quizzes (
                        quiz_name,
                        quiz_code
                    )
                `)
                .eq('quizzes.created_by', teacherIdInt)
                .order('request_date', { ascending: false });

            if (error) throw error;

            res.json(
                data.map((row) => ({
                    request_id: row.request_id,
                    student_id: row.student_id,
                    student_name: row.student_login?.username || 'Unknown Student',
                    quiz_id: row.quiz_id,
                    quiz_name: row.quizzes?.quiz_name || 'Unknown Quiz',
                    quiz_code: row.quizzes?.quiz_code,
                    attempt_id: row.attempt_id,
                    request_date: row.request_date,
                    status: row.status,
                }))
            );
        } catch (error) {
            console.error('Error fetching retest requests:', error);
            res.status(500).json({ error: 'Failed to fetch retest requests', details: error.message });
        }
    });

    app.put('/api/retest-requests/:request_id', async (req, res) => {
        const { request_id } = req.params;
        const { status, teacher_password } = req.body;

        try {
            const { data: quiz, error: quizError } = await supabase
                .from('retest_requests')
                .select(`
                    quiz_id,
                    quizzes (
                        created_by,
                        teacher_login (
                            password
                        )
                    )
                `)
                .eq('request_id', request_id)
                .single();

            if (quizError || !quiz || quiz.quizzes.teacher_login.password !== teacher_password) {
                return res.status(401).json({ error: 'Invalid teacher password' });
            }

            const { data: updatedRequest, error: updateError } = await supabase
                .from('retest_requests')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('request_id', request_id)
                .select()
                .single();

            if (updateError || !updatedRequest) {
                return res.status(404).json({ error: 'Retest request not found' });
            }

            if (status === 'approved') {
                const { error: deleteError } = await supabase
                    .from('quiz_attempts')
                    .delete()
                    .eq('attempt_id', updatedRequest.attempt_id);

                if (deleteError) throw deleteError;
            }

            res.json(updatedRequest);
        } catch (error) {
            console.error('Error updating retest request:', error);
            res.status(500).json({ error: 'Failed to update retest request', details: error.message });
        }
    });

    app.put('/api/teachers/:id', async (req, res) => {
        const { id } = req.params;
        const { email, name } = req.body;

        try {
            const { data, error } = await supabase
                .from('teacher_login')
                .update({ email, username: name })
                .eq('id', id)
                .select('id, username, email')
                .single();

            if (error || !data) {
                return res.status(404).json({ message: 'Teacher not found' });
            }

            res.json(data);
        } catch (error) {
            console.error('Error updating teacher profile:', error);
            res.status(500).json({ message: 'Failed to update profile', details: error.message });
        }
    });

    app.put('/api/students/:id', async (req, res) => {
        const { id } = req.params;
        const { email, name } = req.body;

        try {
            const { data, error } = await supabase
                .from('student_login')
                .update({ email, username: name })
                .eq('id', id)
                .select('id, username, email')
                .single();

            if (error || !data) {
                return res.status(404).json({ message: 'Student not found' });
            }

            res.json(data);
        } catch (error) {
            console.error('Error updating student profile:', error);
            res.status(500).json({ message: 'Failed to update profile', details: error.message });
        }
    });

    app.get('/api/quiz-results/:quiz_code/leaderboard', async (req, res) => {
        const { quiz_code } = req.params;

        try {
            const { data: quiz, error: quizError } = await supabase
                .from('quizzes')
                .select('quiz_id, quiz_name')
                .eq('quiz_code', quiz_code)
                .single();

            if (quizError || !quiz) {
                return res.status(404).json({ message: 'Quiz not found' });
            }

            const { data, error } = await supabase
                .from('quiz_attempts')
                .select(`
                    user_id,
                    score,
                    total_questions,
                    attempt_date,
                    student_login (
                        username
                    )
                `)
                .eq('quiz_id', quiz.quiz_id)
                .order('score', { ascending: false })
                .order('attempt_date', { ascending: true });

            if (error || !data.length) {
                return res.status(404).json({ message: 'No attempts found for this quiz' });
            }

            const rankings = data.map((row, index) => ({
                student_id: row.user_id,
                student_name: row.student_login?.username || 'Unknown Student',
                score: Math.round((row.score / row.total_questions) * 100) || 0,
                rank: index + 1,
            }));

            res.json({
                quiz_name: quiz.quiz_name,
                rankings,
            });
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            res.status(500).json({
                error: 'Failed to fetch leaderboard data',
                details: error.message,
            });
        }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}