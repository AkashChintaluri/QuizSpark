const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Auth endpoints
export const login = async (username, password, userType) => {
    const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            username,
            password,
            userType
        }),
    });
    return response.json();
};

export const signup = async (userData) => {
    const response = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
    });
    return response.json();
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

// Teacher-student subscription endpoints
export const getTeachers = async () => {
    const response = await fetch(`${API_BASE_URL}/api/teachers`);
    return response.json();
};

export const getSubscriptions = async (studentId) => {
    const response = await fetch(`${API_BASE_URL}/api/subscriptions/${studentId}`);
    return response.json();
};

export const subscribe = async (studentId, teacherId) => {
    const response = await fetch(`${API_BASE_URL}/api/subscribe`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ student_id: studentId, teacher_id: teacherId }),
    });
    return response.json();
};

export const unsubscribe = async (studentId, teacherId) => {
    const response = await fetch(`${API_BASE_URL}/api/unsubscribe`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ student_id: studentId, teacher_id: teacherId }),
    });
    return response.json();
};

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

// User profile endpoints
export const updateUserProfile = async (userId, userData) => {
    const response = await fetch(`${API_BASE_URL}/api/user-profile/${userId}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
    });
    return response.json();
}; 