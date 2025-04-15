import express from 'express';
import { createClient } from '@supabase/supabase-js';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Middleware to verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) throw error;

    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Middleware to check user role
const checkRole = (requiredRole) => async (req, res, next) => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(req.headers.authorization?.split(' ')[1]);
    if (error) throw error;

    const { data: profile } = await supabase
      .from(requiredRole === 'teacher' ? 'teacher_login' : 'student_login')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!profile) {
      return res.status(403).json({ error: 'Unauthorized role' });
    }

    next();
  } catch (error) {
    console.error('Role check error:', error);
    res.status(403).json({ error: 'Role verification failed' });
  }
};

// Test the database connection
supabase.from('student_login').select('count')
  .then(() => {
    console.log('Connected to Supabase with service role key');
    startServer();
  })
  .catch(err => {
    console.error('Error connecting to Supabase', err);
    process.exit(1);
  });

function startServer() {
    // Signup endpoint
    app.post('/signup', async (req, res) => {
        const { username, email, password, userType } = req.body;
        const table = userType === 'student' ? 'student_login' : 'teacher_login';

        try {
            // Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        username,
                        userType
                    }
                }
            });

            if (authError) throw authError;

            // Create user profile
            const { data, error } = await supabase
                .from(table)
                .insert([{ 
                    id: authData.user.id,
                    username, 
                    email 
                }])
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

    // Login endpoint
    app.post('/login', async (req, res) => {
        const { email, password } = req.body;

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            // Get user profile
            const { data: profile, error: profileError } = await supabase
                .from(data.user.user_metadata.userType === 'student' ? 'student_login' : 'teacher_login')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (profileError) throw profileError;

            res.json({
                success: true,
                user: {
                    ...data.user,
                    ...profile
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(401).json({ error: 'Invalid credentials' });
        }
    });

    // Change password endpoint
    app.post('/change-password', verifyToken, async (req, res) => {
        const { currentPassword, newPassword } = req.body;

        try {
            // Verify current password
            const { error: verifyError } = await supabase.auth.signInWithPassword({
                email: req.user.email,
                password: currentPassword
            });

            if (verifyError) throw verifyError;

            // Update password
            const { error: updateError } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateError) throw updateError;

            res.json({ success: true, message: 'Password updated successfully' });
        } catch (error) {
            console.error('Password change error:', error);
            res.status(401).json({ error: 'Password update failed' });
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

    app.get('/api/subscriptions/:student_id', verifyToken, async (req, res) => {
        const { student_id } = req.params;

        try {
            // Check if user is authorized to view subscriptions
            const isTeacher = req.user.user_metadata.userType === 'teacher';
            const isStudent = req.user.id === student_id;

            if (!isTeacher && !isStudent) {
                return res.status(403).json({ error: 'Unauthorized to view subscriptions' });
            }

            // Get subscriptions
            const { data, error } = await supabase
                .from('subscriptions')
                .select(`
                    teacher_id,
                    subscribed_at,
                    teacher_login (
                        id,
                        username,
                        email
                    )
                `)
                .eq('student_id', student_id);

            if (error) throw error;

            res.json(data.map(sub => ({
                teacher_id: sub.teacher_id,
                subscribed_at: sub.subscribed_at,
                ...sub.teacher_login
            })));
        } catch (error) {
            console.error('Error fetching subscriptions:', error);
            res.status(500).json({ error: 'Failed to fetch subscriptions' });
        }
    });

    app.post('/api/quizzes', verifyToken, checkRole('teacher'), async (req, res) => {
        const { quiz_name, quiz_code, questions, due_date } = req.body;

        try {
            // Check if quiz code already exists
            const { data: existingQuiz } = await supabase
                .from('quizzes')
                .select('quiz_id')
                .eq('quiz_code', quiz_code)
                .single();

            if (existingQuiz) {
                return res.status(400).json({ error: 'Quiz code already exists' });
            }

            const { data, error } = await supabase
                .from('quizzes')
                .insert([{
                    quiz_name,
                    quiz_code,
                    created_by: req.user.id,
                    questions,
                    due_date,
                    created_at: new Date()
                }])
                .select()
                .single();

            if (error) throw error;

            res.status(201).json({
                message: 'Quiz created successfully',
                quiz_id: data.quiz_id
            });
        } catch (error) {
            console.error('Error creating quiz:', error);
            res.status(500).json({ error: 'Failed to create quiz' });
        }
    });

    app.put('/api/quizzes/:quiz_id', verifyToken, checkRole('teacher'), async (req, res) => {
        const { quiz_id } = req.params;
        const { quiz_name, due_date, questions } = req.body;

        try {
            // Verify quiz ownership
            const { data: existingQuiz, error: fetchError } = await supabase
                .from('quizzes')
                .select('created_by')
                .eq('quiz_id', quiz_id)
                .single();

            if (fetchError) throw fetchError;
            if (existingQuiz.created_by !== req.user.id) {
                return res.status(403).json({ error: 'Unauthorized to update this quiz' });
            }

            const { data, error } = await supabase
                .from('quizzes')
                .update({
                    quiz_name,
                    due_date,
                    questions
                })
                .eq('quiz_id', quiz_id)
                .select()
                .single();

            if (error) throw error;

            res.json({ message: 'Quiz updated successfully' });
        } catch (error) {
            console.error('Error updating quiz:', error);
            res.status(500).json({ error: 'Failed to update quiz' });
        }
    });

    app.get('/api/quizzes/:quiz_code', verifyToken, async (req, res) => {
        const { quiz_code } = req.params;

        try {
            const { data, error } = await supabase
                .from('quizzes')
                .select('*')
                .eq('quiz_code', quiz_code)
                .single();

            if (error) throw error;

            // Check permissions
            const isTeacher = req.user.user_metadata.userType === 'teacher';
            const isCreator = data.created_by === req.user.id;
            
            if (!isTeacher && !isCreator) {
                // Check if student is subscribed to the teacher
                const { data: subscription } = await supabase
                    .from('subscriptions')
                    .select('teacher_id')
                    .eq('student_id', req.user.id)
                    .eq('teacher_id', data.created_by)
                    .single();

                if (!subscription) {
                    return res.status(403).json({ error: 'Unauthorized to view this quiz' });
                }
            }

            res.json(data);
        } catch (error) {
            console.error('Error fetching quiz:', error);
            res.status(500).json({ error: 'Failed to fetch quiz' });
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

    // Rate limiting middleware
    const quizAttemptLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // limit each IP to 5 requests per windowMs
        message: 'Too many quiz attempts, please try again later'
    });

    // Quiz attempt endpoints
    app.post('/api/submit-quiz', verifyToken, checkRole('student'), quizAttemptLimiter, async (req, res) => {
        const { quiz_code, answers, time_taken } = req.body;

        try {
            // Get quiz details
            const { data: quiz, error: quizError } = await supabase
                .from('quizzes')
                .select('*')
                .eq('quiz_code', quiz_code)
                .single();

            if (quizError) throw quizError;

            // Check if student is subscribed to the teacher
            const { data: subscription } = await supabase
                .from('subscriptions')
                .select('teacher_id')
                .eq('student_id', req.user.id)
                .eq('teacher_id', quiz.created_by)
                .single();

            if (!subscription) {
                return res.status(403).json({ error: 'Unauthorized to attempt this quiz' });
            }

            // Check if quiz is still available
            if (new Date(quiz.due_date) < new Date()) {
                return res.status(400).json({ error: 'Quiz deadline has passed' });
            }

            // Check if student has already attempted
            const { data: existingAttempt } = await supabase
                .from('quiz_attempts')
                .select('attempt_id')
                .eq('quiz_id', quiz.quiz_id)
                .eq('user_id', req.user.id)
                .single();

            if (existingAttempt) {
                return res.status(400).json({ error: 'You have already attempted this quiz' });
            }

            // Calculate score
            let score = 0;
            const questions = quiz.questions;
            answers.forEach((answer, index) => {
                if (answer === questions[index].correct_answer) {
                    score++;
                }
            });

            // Create attempt record
            const { data: attempt, error: attemptError } = await supabase
                .from('quiz_attempts')
                .insert([{
                    quiz_id: quiz.quiz_id,
                    user_id: req.user.id,
                    answers,
                    score,
                    total_questions: questions.length,
                    time_taken,
                    is_completed: true
                }])
                .select()
                .single();

            if (attemptError) throw attemptError;

            res.json({
                success: true,
                attempt_id: attempt.attempt_id,
                score,
                total_questions: questions.length
            });
        } catch (error) {
            console.error('Error submitting quiz:', error);
            res.status(500).json({ error: 'Failed to submit quiz' });
        }
    });

    app.get('/api/quiz-result/:quiz_code', verifyToken, async (req, res) => {
        const { quiz_code } = req.params;

        try {
            // Get quiz details
            const { data: quiz, error: quizError } = await supabase
                .from('quizzes')
                .select('*')
                .eq('quiz_code', quiz_code)
                .single();

            if (quizError) throw quizError;

            // Get attempt details
            const { data: attempt, error: attemptError } = await supabase
                .from('quiz_attempts')
                .select('*')
                .eq('quiz_id', quiz.id)
                .eq('user_id', req.user.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

            if (attemptError) throw attemptError;

            // Check permissions
            const isTeacher = req.user.user_metadata.userType === 'teacher';
            const isCreator = quiz.created_by === req.user.id;
            const isStudent = req.user.id === attempt.user_id;

            if (!isTeacher && !isCreator && !isStudent) {
                return res.status(403).json({ error: 'Unauthorized to view this result' });
            }

            res.json({
                quiz_name: quiz.quiz_name,
                score: attempt.score,
                total_questions: attempt.total_questions,
                answers: attempt.answers,
                questions: quiz.questions
            });
        } catch (error) {
            console.error('Error fetching quiz result:', error);
            res.status(500).json({ error: 'Failed to fetch quiz result' });
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

    app.post('/api/subscribe', verifyToken, checkRole('student'), async (req, res) => {
        const { teacher_id } = req.body;

        try {
            // Verify teacher exists
            const { data: teacher, error: teacherError } = await supabase
                .from('teacher_login')
                .select('id')
                .eq('id', teacher_id)
                .single();

            if (teacherError) throw teacherError;

            // Check for existing subscription
            const { data: existingSubscription } = await supabase
                .from('subscriptions')
                .select('student_id, teacher_id')
                .eq('student_id', req.user.id)
                .eq('teacher_id', teacher_id)
                .single();

            if (existingSubscription) {
                return res.status(400).json({ error: 'Already subscribed to this teacher' });
            }

            // Create subscription
            const { data, error } = await supabase
                .from('subscriptions')
                .insert([{
                    student_id: req.user.id,
                    teacher_id,
                    subscribed_at: new Date()
                }])
                .select()
                .single();

            if (error) throw error;

            res.json({
                success: true,
                student_id: data.student_id,
                teacher_id: data.teacher_id
            });
        } catch (error) {
            console.error('Subscription error:', error);
            res.status(500).json({ error: 'Failed to create subscription' });
        }
    });

    app.post('/api/unsubscribe', verifyToken, checkRole('student'), async (req, res) => {
        const { teacher_id } = req.body;

        try {
            // Delete subscription
            const { error } = await supabase
                .from('subscriptions')
                .delete()
                .eq('student_id', req.user.id)
                .eq('teacher_id', teacher_id);

            if (error) throw error;

            res.json({ success: true });
        } catch (error) {
            console.error('Unsubscription error:', error);
            res.status(500).json({ error: 'Failed to remove subscription' });
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

    // Retest request endpoints
    app.post('/api/retest-requests', verifyToken, checkRole('student'), async (req, res) => {
        const { quiz_id, attempt_id } = req.body;

        try {
            // Verify quiz attempt exists and belongs to student
            const { data: attempt, error: attemptError } = await supabase
                .from('quiz_attempts')
                .select('quiz_id, user_id')
                .eq('attempt_id', attempt_id)
                .single();

            if (attemptError) throw attemptError;
            if (attempt.user_id !== req.user.id) {
                return res.status(403).json({ error: 'Unauthorized to request retest for this attempt' });
            }

            // Check if quiz exists
            const { data: quiz, error: quizError } = await supabase
                .from('quizzes')
                .select('created_by')
                .eq('quiz_id', quiz_id)
                .single();

            if (quizError) throw quizError;

            // Check if student is subscribed to the teacher
            const { data: subscription } = await supabase
                .from('subscriptions')
                .select('teacher_id')
                .eq('student_id', req.user.id)
                .eq('teacher_id', quiz.created_by)
                .single();

            if (!subscription) {
                return res.status(403).json({ error: 'Not subscribed to this teacher' });
            }

            // Check for existing retest request
            const { data: existingRequest } = await supabase
                .from('retest_requests')
                .select('request_id')
                .eq('attempt_id', attempt_id)
                .single();

            if (existingRequest) {
                return res.status(400).json({ error: 'Retest request already exists' });
            }

            // Create retest request
            const { data, error } = await supabase
                .from('retest_requests')
                .insert([{
                    student_id: req.user.id,
                    quiz_id,
                    attempt_id,
                    status: 'pending',
                    request_date: new Date()
                }])
                .select()
                .single();

            if (error) throw error;

            res.status(201).json(data);
        } catch (error) {
            console.error('Error creating retest request:', error);
            res.status(500).json({ error: 'Failed to create retest request' });
        }
    });

    app.get('/api/retest-requests/teacher/:teacher_id', verifyToken, checkRole('teacher'), async (req, res) => {
        const { teacher_id } = req.params;

        try {
            // Verify teacher
            if (req.user.id !== teacher_id) {
                return res.status(403).json({ error: 'Unauthorized to view these requests' });
            }

            // Get retest requests
            const { data, error } = await supabase
                .from('retest_requests')
                .select(`
                    request_id,
                    student_id,
                    quiz_id,
                    attempt_id,
                    status,
                    request_date,
                    updated_at,
                    student_login (
                        username,
                        email
                    ),
                    quizzes (
                        quiz_name,
                        quiz_code
                    )
                `)
                .eq('quizzes.created_by', teacher_id)
                .order('request_date', { ascending: false });

            if (error) throw error;

            res.json(data);
        } catch (error) {
            console.error('Error fetching retest requests:', error);
            res.status(500).json({ error: 'Failed to fetch retest requests' });
        }
    });

    app.put('/api/retest-requests/:request_id', verifyToken, checkRole('teacher'), async (req, res) => {
        const { request_id } = req.params;
        const { status } = req.body;

        try {
            // Verify retest request exists and belongs to teacher
            const { data: request, error: requestError } = await supabase
                .from('retest_requests')
                .select(`
                    request_id,
                    quiz_id,
                    quizzes (
                        created_by
                    )
                `)
                .eq('request_id', request_id)
                .single();

            if (requestError) throw requestError;
            if (request.quizzes.created_by !== req.user.id) {
                return res.status(403).json({ error: 'Unauthorized to update this request' });
            }

            // Update retest request
            const { data, error } = await supabase
                .from('retest_requests')
                .update({ 
                    status,
                    updated_at: new Date()
                })
                .eq('request_id', request_id)
                .select()
                .single();

            if (error) throw error;

            res.json(data);
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