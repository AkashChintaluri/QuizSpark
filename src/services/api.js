import { supabase, signIn, signUp } from './supabase';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Auth endpoints
export const login = async (username, password, userType) => {
    try {
        // Get the user from the appropriate table based on userType
        const tableName = userType === 'student' ? 'student_login' : 'teacher_login';
        const { data: user, error: userError } = await supabase
            .from(tableName)
            .select('*')
            .eq('username', username)
            .single();

        if (userError) throw userError;
        if (!user) throw new Error('User not found');

        // Then sign in with email and password
        const { data, error } = await signIn(user.email, password);
        if (error) throw error;

        return {
            success: true,
            user: {
                ...data.user,
                ...user,
                userType
            }
        };
    } catch (error) {
        console.error('Login error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

export const signup = async (userData) => {
    try {
        const tableName = userData.userType === 'student' ? 'student_login' : 'teacher_login';
        
        // Check if username already exists
        const { data: existingUser, error: checkError } = await supabase
            .from(tableName)
            .select('username')
            .eq('username', userData.username)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
        }

        if (existingUser) {
            throw new Error('Username already exists');
        }

        // Create auth user
        const { data, error } = await signUp(userData.email, userData.password, {
            username: userData.username,
            userType: userData.userType
        });
        if (error) throw error;

        // Create user in appropriate table
        const { error: insertError } = await supabase
            .from(tableName)
            .insert([{
                id: data.user.id,
                username: userData.username,
                email: userData.email,
                password: userData.password // Note: This should be hashed in production
            }]);

        if (insertError) throw insertError;

        return {
            success: true,
            user: {
                ...data.user,
                username: userData.username,
                userType: userData.userType
            }
        };
    } catch (error) {
        console.error('Signup error:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

export const changePassword = async (username, currentPassword, newPassword, userType) => {
    const response = await fetch(`${API_BASE_URL}/change-password`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username,
            currentPassword,
            newPassword,
            userType
        }),
    });
    return response.json();
};

// Quiz endpoints
export const getQuizzesByTeacher = async (teacherId) => {
    const response = await fetch(`${API_BASE_URL}/api/quizzes/created/${teacherId}`);
    return response.json();
};

export const getQuizByCode = async (code) => {
    const response = await fetch(`${API_BASE_URL}/api/quizzes/${code}`);
    return response.json();
};

export const createQuiz = async (quizData) => {
    const response = await fetch(`${API_BASE_URL}/api/quizzes`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(quizData),
    });
    return response.json();
};

export const updateQuiz = async (quizId, quizData) => {
    const response = await fetch(`${API_BASE_URL}/api/quizzes/${quizId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(quizData),
    });
    return response.json();
};

// Quiz attempts endpoints
export const checkQuizAttempt = async (quizCode, userId) => {
    const response = await fetch(`${API_BASE_URL}/api/check-quiz-attempt/${quizCode}/${userId}`);
    return response.json();
};

export const submitQuizAttempt = async (attemptData) => {
    const response = await fetch(`${API_BASE_URL}/api/submit-quiz`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(attemptData),
    });
    return response.json();
};

export const getQuizResult = async (quizCode, userId) => {
    const response = await fetch(`${API_BASE_URL}/api/quiz-result/${quizCode}/${userId}`);
    return response.json();
};

export const getQuizAttempts = async (quizCode) => {
    const response = await fetch(`${API_BASE_URL}/api/quiz-attempts/${quizCode}`);
    return response.json();
};

// Student dashboard endpoints
export const getUpcomingQuizzes = async (userId) => {
    const response = await fetch(`${API_BASE_URL}/api/upcoming-quizzes/${userId}`);
    return response.json();
};

export const getUserStats = async (userId) => {
    const response = await fetch(`${API_BASE_URL}/api/user-stats/${userId}`);
    return response.json();
};

export const getAttemptedQuizzes = async (userId) => {
    const response = await fetch(`${API_BASE_URL}/api/attempted-quizzes/${userId}`);
    return response.json();
};

// Teacher-student subscription functions
export const getTeachers = async () => {
    const { data, error } = await supabase
        .from('teacher_login')
        .select('*')
    if (error) throw error
    return data
}

export const getSubscriptions = async (studentId) => {
    const { data, error } = await supabase
        .from('subscriptions')
        .select(`
            *,
            teacher:teacher_login(*)
        `)
        .eq('student_id', studentId)
    if (error) throw error
    return data
}

export const subscribe = async (studentId, teacherId) => {
    const { data, error } = await supabase
        .from('subscriptions')
        .insert([{ student_id: studentId, teacher_id: teacherId }])
        .select()
    if (error) throw error
    return data[0]
}

export const unsubscribe = async (studentId, teacherId) => {
    const { error } = await supabase
        .from('subscriptions')
        .delete()
        .match({ student_id: studentId, teacher_id: teacherId })
    if (error) throw error
}

// User profile functions
export const updateUserProfile = async (userId, updates, userType) => {
    const tableName = userType === 'student' ? 'student_login' : 'teacher_login';
    const { data, error } = await supabase
        .from(tableName)
        .update(updates)
        .eq('id', userId)
        .select()
    if (error) throw error
    return data[0]
}

export const getUserProfile = async (userId, userType) => {
    const tableName = userType === 'student' ? 'student_login' : 'teacher_login';
    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq('id', userId)
        .single()
    if (error) throw error
    return data
}

// Retest request endpoints
export const getRetestRequests = async (teacherId) => {
    const response = await fetch(`${API_BASE_URL}/api/retest-requests/teacher/${teacherId}`);
    return response.json();
};

export const updateRetestRequest = async (requestId, status, teacherPassword) => {
    const response = await fetch(`${API_BASE_URL}/api/retest-requests/${requestId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status, teacher_password: teacherPassword }),
    });
    return response.json();
};

export const createRetestRequest = async (studentId, quizId, attemptId) => {
    const response = await fetch(`${API_BASE_URL}/api/retest-requests`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ student_id: studentId, quiz_id: quizId, attempt_id: attemptId }),
    });
    return response.json();
};

// Leaderboard endpoint
export const getQuizLeaderboard = async (quizCode) => {
    const response = await fetch(`${API_BASE_URL}/api/quiz-leaderboard/${quizCode}`);
    return response.json();
}; 