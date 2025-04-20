import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './TeacherDashboard.css';
import './MakeQuizzes.css';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API_URL = '/api'; // Relative path for API requests

function TeacherDashboard() {
    const [activeTab, setActiveTab] = useState('home');
    const [currentUser, setCurrentUser] = useState(null);
    const navigate = useNavigate();
    const location = useLocation();

    const fetchDashboardData = useCallback(async () => {
        if (!currentUser?.id) return;
        
        try {
            const [quizzesResponse, studentsResponse] = await Promise.all([
                axios.get(`${API_URL}/api/teachers/${currentUser.id}/quizzes`),
                axios.get(`${API_URL}/api/teachers/${currentUser.id}/students`)
            ]);
            
            // Store the responses in state if needed
            // For example:
            // setQuizzes(quizzesResponse.data);
            // setStudents(studentsResponse.data);
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        }
    }, [currentUser?.id]);

    useEffect(() => {
        const source = axios.CancelToken.source();
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
            navigate('/');
        } else {
            setCurrentUser(JSON.parse(storedUser));
        }

        if (location.state?.quizCode) {
            setActiveTab('results');
        }

        return () => {
            source.cancel('Component unmounted');
        };
    }, [navigate, location]);

    useEffect(() => {
        if (currentUser?.id) {
            fetchDashboardData();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser?.id]); // Suppress exhaustive-deps warning since fetchDashboardData is stable

    return (
        <div className="teacher-dashboard">
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} currentUser={currentUser} />
            <Content activeTab={activeTab} currentUser={currentUser} setActiveTab={setActiveTab} location={location} />
        </div>
    );
}

function Sidebar({ activeTab, setActiveTab, currentUser }) {
    const [notificationsCount, setNotificationsCount] = useState(0);

    useEffect(() => {
        if (!currentUser?.id) return;

        const source = axios.CancelToken.source();
        const fetchNotificationsCount = async () => {
            try {
                const _response = await axios.get(
                    `${API_URL}/api/retest-requests/teacher/${currentUser.id}`,
                    { cancelToken: source.token }
                );
                const unreadCount = _response.data.filter(r => r.status === 'pending').length;
                setNotificationsCount(unreadCount);
            } catch (error) {
                if (!axios.isCancel(error)) {
                    console.error('Error fetching notifications count:', error);
                }
            }
        };

        fetchNotificationsCount();
        return () => {
            source.cancel('Sidebar cleanup');
        };
    }, [currentUser]);

    return (
        <div className="sidebar">
            <h2>Teacher Dashboard</h2>
            {currentUser && (
                <div className="welcome-box">
                    <p>Welcome, {currentUser.username}!</p>
                </div>
            )}

            <nav>
                <ul>
                    {['Home', 'Make Quizzes', 'Results', 'Notifications', 'Settings'].map((tab) => (
                        <li key={tab}>
                            <button
                                className={activeTab === tab.toLowerCase() ? 'active' : ''}
                                onClick={() => setActiveTab(tab.toLowerCase())}
                            >
                                {tab}
                                {tab === 'Notifications' && notificationsCount > 0 && (
                                    <span className="notification-badge">{notificationsCount}</span>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>
        </div>
    );
}

function Content({ activeTab, currentUser, setActiveTab, location }) {
    const _navigate = useNavigate(); // Renamed to suppress unused var warning

    useEffect(() => {
        if (activeTab !== 'results') {
            _navigate('.', { state: { quizCode: null } });
        }
    }, [activeTab, _navigate]);

    switch (activeTab) {
        case 'home':
            return <HomeContent currentUser={currentUser} setActiveTab={setActiveTab} />;
        case 'make quizzes':
            return <MakeQuizzesContent currentUser={currentUser} />;
        case 'results':
            return <ResultsContent currentUser={currentUser} initialQuizCode={location.state?.quizCode} />;
        case 'notifications':
            return <NotificationsContent currentUser={currentUser} />;
        case 'settings':
            return <SettingsContent currentUser={currentUser} />;
        default:
            return <HomeContent currentUser={currentUser} setActiveTab={setActiveTab} />;
    }
}

function HomeContent({ currentUser, setActiveTab }) {
    const [quizzes, setQuizzes] = useState([]);
    const [filteredQuizzes, setFilteredQuizzes] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedQuiz, setSelectedQuiz] = useState(null);
    const [editQuizData, setEditQuizData] = useState({
        quiz_name: '',
        due_date: '',
        questions: [],
    });
    const [message, setMessage] = useState('');
    const [notificationsCount, setNotificationsCount] = useState(0);
    const navigate = useNavigate();

    useEffect(() => {
        if (!currentUser?.id) return;

        const source = axios.CancelToken.source();
        const fetchCreatedQuizzes = async () => {
            setLoading(true);
            setError('');
            try {
                const [_quizzesResponse, _notificationsResponse] = await Promise.all([
                    axios.get(`${API_URL}/api/quizzes/created/${currentUser.id}`, {
                        cancelToken: source.token
                    }),
                    axios.get(`${API_URL}/api/retest-requests/teacher/${currentUser.id}`, {
                        cancelToken: source.token
                    })
                ]);

                setQuizzes(_quizzesResponse.data);
                setFilteredQuizzes(_quizzesResponse.data);
                const unreadCount = _notificationsResponse.data.filter(r => r.status === 'pending').length;
                setNotificationsCount(unreadCount);
            } catch (err) {
                if (!axios.isCancel(err)) {
                    console.error('Error fetching data:', err);
                    setError('Failed to load your quizzes or notifications. Please try again later.');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchCreatedQuizzes();
        return () => {
            source.cancel('HomeContent cleanup');
        };
    }, [currentUser]);

    useEffect(() => {
        const filtered = quizzes.filter(quiz =>
            quiz.quiz_name.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredQuizzes(filtered);
    }, [searchTerm, quizzes]);

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    const handleCreateQuiz = () => {
        setActiveTab('make quizzes');
    };

    const handleViewDetails = (quiz) => {
        setSelectedQuiz(quiz);
        setEditQuizData({
            quiz_name: quiz.quiz_name,
            due_date: new Date(quiz.due_date).toISOString().slice(0, 16),
            questions: quiz.questions.questions,
        });
    };

    const handleEditInputChange = (e) => {
        const { name, value } = e.target;
        setEditQuizData((prev) => ({ ...prev, [name]: value }));
    };

    const handleQuestionChange = (index, field, value) => {
        const updatedQuestions = [...editQuizData.questions];
        updatedQuestions[index][field] = value;
        setEditQuizData((prev) => ({ ...prev, questions: updatedQuestions }));
    };

    const handleOptionChange = (qIndex, oIndex, value) => {
        const updatedQuestions = [...editQuizData.questions];
        updatedQuestions[qIndex].options[oIndex].text = value;
        setEditQuizData((prev) => ({ ...prev, questions: updatedQuestions }));
    };

    const handleCorrectOptionToggle = (qIndex, oIndex) => {
        const updatedQuestions = [...editQuizData.questions];
        updatedQuestions[qIndex].options = updatedQuestions[qIndex].options.map((opt, idx) => ({
            ...opt,
            is_correct: idx === oIndex ? !opt.is_correct : opt.is_correct,
        }));
        setEditQuizData((prev) => ({ ...prev, questions: updatedQuestions }));
    };

    const handleSaveChanges = async () => {
        const source = axios.CancelToken.source();
        try {
            const _response = await axios.put(
                `${API_URL}/api/quizzes/${selectedQuiz.quiz_id}`,
                {
                    quiz_name: editQuizData.quiz_name,
                    due_date: editQuizData.due_date,
                    questions: { questions: editQuizData.questions },
                },
                { cancelToken: source.token }
            );

            setMessage('Quiz updated successfully!');
            setQuizzes(quizzes.map((q) =>
                q.quiz_id === selectedQuiz.quiz_id
                    ? { ...q, quiz_name: editQuizData.quiz_name, due_date: editQuizData.due_date, questions: { questions: editQuizData.questions } }
                    : q
            ));
            setFilteredQuizzes(filteredQuizzes.map((q) =>
                q.quiz_id === selectedQuiz.quiz_id
                    ? { ...q, quiz_name: editQuizData.quiz_name, due_date: editQuizData.due_date, questions: { questions: editQuizData.questions } }
                    : q
            ));
            setTimeout(() => setMessage(''), 3000);
            setSelectedQuiz(null);
        } catch (error) {
            if (!axios.isCancel(error)) {
                console.error('Error updating quiz:', error);
                setMessage('An error occurred while updating the quiz.');
            }
        }
    };

    const handleCancel = () => {
        setSelectedQuiz(null);
        setMessage('');
    };

    const handleQuizClick = (quizCode) => {
        setActiveTab('results');
        navigate('.', { state: { quizCode } });
    };

    const totalQuizzes = quizzes.length;
    const upcomingQuizzes = quizzes.filter(quiz => new Date(quiz.due_date) > new Date()).length;

    return (
        <div className="content">
            <div className="dashboard-header">
                <h1 className="dashboard-title">Your Quiz Dashboard</h1>
                <button className="create-quiz-btn" onClick={handleCreateQuiz}>
                    Create New Quiz
                </button>
            </div>

            <div className="stats-section">
                <div className="stat-card">
                    <span className="stat-value">{totalQuizzes}</span>
                    <span className="stat-label">Total Quizzes</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{upcomingQuizzes}</span>
                    <span className="stat-label">Upcoming Due</span>
                </div>
                <div className="stat-card">
                    <span className="stat-value">{notificationsCount}</span>
                    <span className="stat-label">Notifications</span>
                </div>
            </div>

            {loading && (
                <div className="loading-overlay">
                    <div className="spinner"></div>
                    <p>Loading your quizzes...</p>
                </div>
            )}
            {error && (
                <div className="error-message">
                    <span className="error-icon">⚠️</span>
                    {error}
                </div>
            )}

            {!loading && !error && filteredQuizzes.length === 0 && (
                <div className="empty-state">
                    {searchTerm ? (
                        <p>No quizzes match "<strong>{searchTerm}</strong>". Try a different term!</p>
                    ) : (
                        <p>You haven't created any quizzes yet. Start by clicking "Create New Quiz" above!</p>
                    )}
                </div>
            )}

            {!loading && filteredQuizzes.length > 0 && (
                <>
                    {quizzes.length > 0 && (
                        <div className="latest-section">
                            <h2 className="section-title">Latest Quiz</h2>
                            <div
                                className="latest-card"
                                onClick={() => handleQuizClick(quizzes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].quiz_code)}
                            >
                                <div className="quiz-card-content">
                                    <div className="quiz-status">
                                        <span className="quiz-code">{quizzes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].quiz_code}</span>
                                        <span className="quiz-questions">{quizzes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].questions.questions.length} Questions</span>
                                    </div>
                                    <h3 className="quiz-name">{quizzes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].quiz_name}</h3>
                                    <div className="quiz-meta">
                                        <div className="meta-item">
                                            <span className="meta-label">Due Date</span>
                                            <span className="meta-value">{new Date(quizzes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].due_date).toLocaleDateString()}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Created</span>
                                            <span className="meta-value">{new Date(quizzes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Total Questions</span>
                                            <span className="meta-value">{quizzes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0].questions.questions.length}</span>
                                        </div>
                                    </div>
                                    <button className="view-details-btn" onClick={(e) => { e.stopPropagation(); handleViewDetails(quizzes.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]); }}>
                                        View Details
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="search-section">
                        <div className="search-wrapper">
                            <span className="search-icon">🔍</span>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={handleSearchChange}
                                placeholder="Search your quizzes..."
                                className="search-input"
                            />
                        </div>
                    </div>

                    <div className="quizzes-grid">
                        {filteredQuizzes.map((quiz) => (
                            <div key={quiz.quiz_id} className="quiz-card" onClick={() => handleQuizClick(quiz.quiz_code)}>
                                <div className="quiz-card-content">
                                    <div className="quiz-status">
                                        <span className="quiz-code">{quiz.quiz_code}</span>
                                        <span className="quiz-questions">{quiz.questions.questions.length} Questions</span>
                                    </div>
                                    <h3 className="quiz-name">{quiz.quiz_name}</h3>
                                    <div className="quiz-meta">
                                        <div className="meta-item">
                                            <span className="meta-label">Due Date</span>
                                            <span className="meta-value">{new Date(quiz.due_date).toLocaleDateString()}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Created</span>
                                            <span className="meta-value">{new Date(quiz.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="meta-item">
                                            <span className="meta-label">Total Questions</span>
                                            <span className="meta-value">{quiz.questions.questions.length}</span>
                                        </div>
                                    </div>
                                    <button className="view-details-btn" onClick={(e) => { e.stopPropagation(); handleViewDetails(quiz); }}>
                                        View Details
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {message && <div className="message">{message}</div>}

            {selectedQuiz && (
                <div className="modal-overlay" onClick={handleCancel}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h4>Edit Quiz Details</h4>
                            <button className="close-btn" onClick={handleCancel}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Quiz Name:</label>
                                <input
                                    type="text"
                                    name="quiz_name"
                                    value={editQuizData.quiz_name}
                                    onChange={handleEditInputChange}
                                    className="quiz-name-input"
                                    placeholder="Enter quiz name"
                                />
                            </div>
                            <div className="form-group">
                                <label>Due Date:</label>
                                <input
                                    type="datetime-local"
                                    name="due_date"
                                    value={editQuizData.due_date}
                                    onChange={handleEditInputChange}
                                    className="due-date-input"
                                    min={new Date().toISOString().slice(0, 16)}
                                />
                            </div>
                            <div className="form-group">
                                <label>Questions:</label>
                                <div className="questions-container">
                                    {editQuizData.questions.map((question, qIndex) => (
                                        <div key={qIndex} className="edit-question-section">
                                            <input
                                                type="text"
                                                value={question.question_text}
                                                onChange={(e) => handleQuestionChange(qIndex, 'question_text', e.target.value)}
                                                placeholder={`Question ${qIndex + 1}`}
                                                className="question-input"
                                            />
                                            <div className="options-section">
                                                {question.options.map((option, oIndex) => (
                                                    <div key={oIndex} className="option-input">
                                                        <input
                                                            type="text"
                                                            value={option.text}
                                                            onChange={(e) => handleOptionChange(qIndex, oIndex, e.target.value)}
                                                            placeholder={`Option ${oIndex + 1}`}
                                                            className="option-text-input"
                                                        />
                                                        <label className="correct-label">
                                                            <input
                                                                type="checkbox"
                                                                checked={option.is_correct}
                                                                onChange={() => handleCorrectOptionToggle(qIndex, oIndex)}
                                                            />
                                                            Correct
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button onClick={handleSaveChanges} className="save-btn">Save Changes</button>
                            <button onClick={handleCancel} className="cancel-btn">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MakeQuizzesContent({ currentUser }) {
    const [quizName, setQuizName] = useState('');
    const [quizCode, setQuizCode] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [questions, setQuestions] = useState([]);
    const [currentQuestion, setCurrentQuestion] = useState('');
    const [options, setOptions] = useState(['', '', '', '']);
    const [correctOptions, setCorrectOptions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const generateQuizCode = () => {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    };

    const handleOptionChange = (index, value) => {
        const newOptions = [...options];
        newOptions[index] = value;
        setOptions(newOptions);
    };

    const handleCorrectOptionToggle = (index) => {
        if (correctOptions.includes(index)) {
            setCorrectOptions(correctOptions.filter((opt) => opt !== index));
        } else {
            setCorrectOptions([...correctOptions, index]);
        }
    };

    const handleAddQuestion = () => {
        if (currentQuestion && options.every((option) => option.trim() !== '') && correctOptions.length > 0) {
            const newQuestion = {
                question_text: currentQuestion,
                options: options.map((option, index) => ({
                    text: option,
                    is_correct: correctOptions.includes(index),
                })),
            };
            setQuestions([...questions, newQuestion]);
            resetForm();
        } else {
            alert('Please fill in all fields and select at least one correct option before adding the question.');
        }
    };

    const resetForm = () => {
        setCurrentQuestion('');
        setOptions(['', '', '', '']);
        setCorrectOptions([]);
    };

    const handleSubmitQuiz = async () => {
        if (!quizName.trim()) {
            alert('Please enter a name for the quiz.');
            return;
        }
        if (!dueDate) {
            alert('Please set a due date for the quiz.');
            return;
        }
        if (questions.length === 0) {
            alert('Please add at least one question to the quiz.');
            return;
        }
        if (!currentUser) {
            alert('You must be logged in to create a quiz.');
            return;
        }

        setIsLoading(true);
        const generatedCode = generateQuizCode();
        setQuizCode(generatedCode);
        const source = axios.CancelToken.source();

        const quizData = {
            quiz_name: quizName,
            quiz_code: generatedCode,
            created_by: currentUser.id,
            questions: { questions },
            due_date: dueDate,
        };

        try {
            const _response = await axios.post(`${API_URL}/api/quizzes`, quizData, {
                headers: {
                    'Content-Type': 'application/json',
                },
                cancelToken: source.token
            });

            alert(`Quiz created successfully! Quiz Code: ${generatedCode}`);
            setQuizName('');
            setDueDate('');
            setQuestions([]);
            resetForm();
        } catch (error) {
            if (!axios.isCancel(error)) {
                console.error('Error submitting quiz:', error);
                alert(error.response?.data?.message || 'An error occurred while creating the quiz.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="content make-quizzes">
            <h2>Make Quizzes</h2>

            <div className="quiz-details-section">
                <input
                    type="text"
                    value={quizName}
                    onChange={(e) => setQuizName(e.target.value)}
                    placeholder="Enter Quiz Name"
                    className="quiz-name-input"
                    disabled={isLoading}
                />
                <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="due-date-input"
                    min={new Date().toISOString().slice(0, 16)}
                    disabled={isLoading}
                />
            </div>

            <div className="question-form">
                <input
                    type="text"
                    value={currentQuestion}
                    onChange={(e) => setCurrentQuestion(e.target.value)}
                    placeholder="Enter your question"
                    className="question-input"
                    disabled={isLoading}
                />
                <div className="options-section">
                    {options.map((option, index) => (
                        <div key={index} className="option-input">
                            <input
                                type="text"
                                value={option}
                                onChange={(e) => handleOptionChange(index, e.target.value)}
                                placeholder={`Option ${index + 1}`}
                                disabled={isLoading}
                            />
                            <label>
                                <input
                                    type="checkbox"
                                    checked={correctOptions.includes(index)}
                                    onChange={() => handleCorrectOptionToggle(index)}
                                    disabled={isLoading}
                                />
                                Correct
                            </label>
                        </div>
                    ))}
                </div>
                <button onClick={handleAddQuestion} className="add-question-btn" disabled={isLoading}>
                    {isLoading ? 'Adding...' : 'Add Question'}
                </button>
            </div>

            <div className="questions-list">
                <h3>Added Questions:</h3>
                <ul>
                    {questions.map((q, index) => (
                        <li key={index}>{q.question_text}</li>
                    ))}
                </ul>
            </div>

            {questions.length > 0 && (
                <button onClick={handleSubmitQuiz} className="submit-quiz-btn" disabled={isLoading}>
                    {isLoading ? 'Submitting...' : 'Done - Submit Quiz'}
                </button>
            )}

            {quizCode && (
                <div className="quiz-code-section">
                    <p><strong>Quiz Code:</strong> {quizCode}</p>
                </div>
            )}
        </div>
    );
}

function ResultsContent({ currentUser, initialQuizCode }) {
    const [attempts, setAttempts] = useState([]);
    const [filteredAttempts, setFilteredAttempts] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [quizName, setQuizName] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'score', direction: 'desc' });
    const [quizCode, setQuizCode] = useState(initialQuizCode || '');

    useEffect(() => {
        if (initialQuizCode) {
            setQuizCode(initialQuizCode);
            fetchResults(initialQuizCode);
        }
    }, [initialQuizCode]);

    const fetchResults = async (code) => {
        setLoading(true);
        setError('');
        setAttempts([]);
        setFilteredAttempts([]);
        setQuizName('');

        try {
            const response = await axios.get(`${API_URL}/api/quiz-attempts/${code}`);

            if (Array.isArray(response.data)) {
                setAttempts(response.data);
                setFilteredAttempts(response.data);
                setQuizName(response.data[0]?.quiz_name || 'Quiz Results');
            } else {
                setError('No attempts found for this quiz');
            }
        } catch (err) {
            console.error('Error fetching quiz attempts:', err);
            setError(err.response?.data?.message || 'An error occurred while fetching results');
        } finally {
            setLoading(false);
        }
    };

    const handleQuizCodeSubmit = async (e) => {
        e.preventDefault();
        if (!quizCode.trim()) {
            setError('Please enter a quiz code');
            return;
        }
        fetchResults(quizCode);
    };

    const handleSort = (key) => {
        const direction = sortConfig.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc';
        setSortConfig({ key, direction });

        const sortedAttempts = [...filteredAttempts].sort((a, b) => {
            if (key === 'student_username') {
                return direction === 'asc'
                    ? a[key].localeCompare(b[key])
                    : b[key].localeCompare(a[key]);
            } else if (key === 'attempt_date') {
                const dateA = new Date(a[key]);
                const dateB = new Date(b[key]);
                return direction === 'asc'
                    ? dateA - dateB
                    : dateB - dateA;
            }
            return direction === 'asc' ? a[key] - b[key] : b[key] - a[key];
        });
        setFilteredAttempts(sortedAttempts);
    };

    const exportToCSV = () => {
        const headers = ['Student,Quiz Name,Score,Total Questions,Attempt Date,Quiz Code,Student ID,Attempt ID'];
        const rows = filteredAttempts.map(a =>
            `${a.student_username},${quizName},${a.score},${a.total_questions},${new Date(a.attempt_date).toLocaleString()},${quizCode},${a.user_id},${a.attempt_id}`
        );
        const csvContent = [headers, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${quizName}_results.csv`;
        link.click();
    };

    const chartData = {
        labels: filteredAttempts.map((attempt) => attempt.student_username.slice(0, 3).toUpperCase()),
        datasets: [
            {
                label: 'Score',
                data: filteredAttempts.map((attempt) => attempt.score),
                backgroundColor: 'rgba(79, 70, 229, 0.85)',
                borderColor: 'rgba(79, 70, 229, 1)',
                borderWidth: 1,
                borderRadius: 4,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: { beginAtZero: true, grid: { display: false } },
            x: { grid: { display: false } },
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: { label: (context) => `${context.raw}/${filteredAttempts[0]?.total_questions}` },
            },
        },
    };

    const totalAttempts = filteredAttempts.length;
    const avgScore = filteredAttempts.length > 0
        ? (filteredAttempts.reduce((sum, a) => sum + a.score, 0) / (filteredAttempts.length * filteredAttempts[0].total_questions) * 100).toFixed(0)
        : 0;
    const topScore = filteredAttempts.length > 0 ? Math.max(...filteredAttempts.map(a => a.score)) : 0;

    return (
        <div className="content results-content-alt">
            <div className="results-container-alt">
                <div className="results-header-card-alt">
                    <h2 className="results-title-alt">{quizName || 'Quiz Results'}</h2>
                    <div className="results-form-alt">
                        <div className="quiz-code-wrapper-alt">
                            <input
                                type="text"
                                placeholder="Enter Quiz Code"
                                value={quizCode}
                                onChange={(e) => setQuizCode(e.target.value)}
                                className="quiz-code-input-alt"
                                disabled={loading}
                            />
                            {quizCode && <span className="quiz-code-display-alt">{quizCode}</span>}
                        </div>
                        <button onClick={handleQuizCodeSubmit} className="fetch-btn-alt" disabled={loading}>
                            <i>🔍</i> {loading ? 'Fetching...' : 'Fetch'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="alert-card">
                        <span className="alert-icon error">⚠️</span>
                        <div className="alert-content">
                            <h3 className="alert-title">Error</h3>
                            <p className="alert-message">{error}</p>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="alert-card">
                        <span className="alert-icon loading">⟳</span>
                        <div className="alert-content">
                            <h3 className="alert-title">Loading</h3>
                            <p className="alert-message">Fetching quiz results...</p>
                        </div>
                    </div>
                )}

                {!loading && !error && filteredAttempts.length === 0 && quizCode && (
                    <div className="empty-state">
                        <span className="empty-icon">📊</span>
                        <h3 className="empty-title">No Results Found</h3>
                        <p className="empty-message">No attempts found for quiz code "{quizCode}". Verify the code or try another.</p>
                    </div>
                )}

                {!loading && !error && filteredAttempts.length > 0 && (
                    <div className="results-body-alt">
                        <div className="stats-card-alt">
                            <h3 className="stats-title-alt">Performance Overview</h3>
                            <div className="stats-grid-alt">
                                <div className="stat-item-alt">
                                    <span className="stat-icon-alt"><i>👥</i></span>
                                    <div className="stat-details-alt">
                                        <span className="stat-value-alt">{totalAttempts}</span>
                                        <span className="stat-label-alt">Attempts</span>
                                    </div>
                                </div>
                                <div className="stat-item-alt">
                                    <span className="stat-icon-alt"><i>📈</i></span>
                                    <div className="stat-details-alt">
                                        <span className="stat-value-alt">{avgScore}%</span>
                                        <span className="stat-label-alt">Average</span>
                                    </div>
                                </div>
                                <div className="stat-item-alt">
                                    <span className="stat-icon-alt"><i>🏆</i></span>
                                    <div className="stat-details-alt">
                                        <span className="stat-value-alt">{topScore}</span>
                                        <span className="stat-label-alt">Top Score</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="chart-card-alt">
                            <div className="chart-header-alt">
                                <h3 className="chart-title-alt">Score Distribution</h3>
                            </div>
                            <div className="chart-body-alt">
                                <Bar data={chartData} options={chartOptions} />
                            </div>
                        </div>

                        <div className="attempts-card-alt">
                            <div className="attempts-header-alt">
                                <h3 className="attempts-title-alt">Student Results</h3>
                                <button className="export-btn-alt" onClick={exportToCSV}>
                                    <i>📥</i> Export
                                </button>
                            </div>
                            <div className="attempts-table-alt">
                                <div className="table-header-alt">
                                    <div
                                        className={`table-cell-alt ${sortConfig.key === 'student_username' ? `active ${sortConfig.direction}-sort` : ''}`}
                                        onClick={() => handleSort('student_username')}
                                    >
                                        Student
                                    </div>
                                    <div
                                        className={`table-cell-alt ${sortConfig.key === 'score' ? `active ${sortConfig.direction}-sort` : ''}`}
                                        onClick={() => handleSort('score')}
                                    >
                                        Score
                                    </div>
                                    <div
                                        className={`table-cell-alt ${sortConfig.key === 'attempt_date' ? `active ${sortConfig.direction}-sort` : ''}`}
                                        onClick={() => handleSort('attempt_date')}
                                    >
                                        Attempt Date
                                    </div>
                                </div>
                                <div className="table-body-alt">
                                    {filteredAttempts.map((attempt) => (
                                        <div key={attempt.attempt_id} className="table-row-alt">
                                            <div className="table-cell-alt">
                                                <div className="student-info-alt">
                                                    <span className="student-avatar-alt">
                                                        {attempt.student_username.slice(0, 2).toUpperCase()}
                                                    </span>
                                                    <span className="student-name-alt">{attempt.student_username}</span>
                                                </div>
                                            </div>
                                            <div className="table-cell-alt">
                                                <span className={`score-badge-alt ${attempt.score >= attempt.total_questions * 0.9 ? 'excellent' : attempt.score >= attempt.total_questions * 0.7 ? 'good' : attempt.score >= attempt.total_questions * 0.5 ? 'average' : 'poor'}`}>
                                                    {attempt.score}/{attempt.total_questions}
                                                </span>
                                            </div>
                                            <div className="table-cell-alt">{new Date(attempt.attempt_date).toLocaleString()}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function NotificationsContent({ currentUser }) {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [teacherPassword, setTeacherPassword] = useState('');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!currentUser?.id) return;

        const source = axios.CancelToken.source();
        const fetchNotifications = async () => {
            setLoading(true);
            setError('');
            try {
                const _response = await axios.get(
                    `${API_URL}/api/retest-requests/teacher/${currentUser.id}`,
                    { cancelToken: source.token }
                );
                setNotifications(_response.data);
            } catch (error) {
                if (!axios.isCancel(error)) {
                    console.error('Error fetching notifications:', error);
                    setError(error.response?.data?.message || 'Failed to load notifications. Please try again later.');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchNotifications();
        return () => {
            source.cancel('Notifications cleanup');
        };
    }, [currentUser]);

    const handleRetestAction = async (requestId, status) => {
        if (!teacherPassword) {
            setError('Please enter your password to approve or decline a request.');
            return;
        }

        const source = axios.CancelToken.source();
        try {
            const _response = await axios.put(
                `${API_URL}/api/retest-requests/${requestId}`,
                {
                    status,
                    teacher_password: teacherPassword,
                },
                { cancelToken: source.token }
            );

            setNotifications(prevNotifications =>
                prevNotifications.map(notif => 
                    notif.request_id === requestId ? { ...notif, status } : notif
                ).filter(n => n.status === 'pending')
            );
            setMessage(`Retest request ${status} successfully!`);
            setTeacherPassword('');
            setError('');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            if (!axios.isCancel(error)) {
                console.error('Error updating retest request:', error);
                setError(error.response?.data?.error || 'Failed to update request. Check your password.');
            }
        }
    };

    return (
        <div className="content">
            {loading && (
                <div className="alert-card loading">
                    <span className="alert-icon loading">⟳</span>
                    <div className="alert-content">
                        <h3 className="alert-title">Loading</h3>
                        <p className="alert-message">Fetching your notifications...</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="alert-card error">
                    <span className="alert-icon error">⚠️</span>
                    <div className="alert-content">
                        <h3 className="alert-title">Error</h3>
                        <p className="alert-message">{error}</p>
                    </div>
                </div>
            )}

            {message && (
                <div className="message success">{message}</div>
            )}

            {!loading && !error && notifications.length === 0 && (
                <div className="empty-state">
                    <span className="empty-icon">📭</span>
                    <h3 className="empty-title">No Notifications</h3>
                    <p className="empty-message">There are no pending retest requests at the moment.</p>
                </div>
            )}

            {!loading && !error && notifications.length > 0 && (
                <div className="notifications-list">
                    {notifications.filter(n => n.status === 'pending').map((notification) => (
                        <div key={notification.request_id} className="notification-item">
                            <div className="notification-content">
                                <div className="notification-header">
                                    <h3 className="notification-title">{notification.quiz_name}</h3>
                                    <span className="notification-time">
                                        {new Date(notification.request_date).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="notification-details">
                                    <div className="student-info">
                                        <span className="student-avatar">
                                            {notification.student_name.slice(0, 2).toUpperCase()}
                                        </span>
                                        <span className="student-name">{notification.student_name}</span>
                                    </div>
                                    <div className="quiz-code-badge">
                                        Quiz Code: {notification.quiz_code}
                                    </div>
                                </div>
                                <div className="notification-actions">
                                    <input
                                        type="password"
                                        placeholder="Enter your password"
                                        value={teacherPassword}
                                        onChange={(e) => setTeacherPassword(e.target.value)}
                                        className="password-input"
                                    />
                                    <div className="action-buttons">
                                        <button
                                            onClick={() => handleRetestAction(notification.request_id, 'approved')}
                                            className="approve-btn"
                                        >
                                            Approve
                                        </button>
                                        <button
                                            onClick={() => handleRetestAction(notification.request_id, 'declined')}
                                            className="decline-btn"
                                        >
                                            Decline
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function SettingsContent({ currentUser }) {
    const navigate = useNavigate();
    const [showPasswordFields, setShowPasswordFields] = useState(false);
    const [showProfileFields, setShowProfileFields] = useState(false);
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
    });
    const [profileData, setProfileData] = useState({
        email: currentUser?.email || '',
        name: currentUser?.name || ''
    });
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [activeCard, setActiveCard] = useState(null);

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/');
    };

    const handlePasswordChange = async () => {
        setIsLoading(true);
        setMessage('');
        const source = axios.CancelToken.source();

        try {
            const _response = await axios.post(`${API_URL}/change-password`, {
                ...formData,
                username: currentUser.username,
                userType: 'teacher',
            }, { cancelToken: source.token });

            setMessage('Password changed successfully');
            setFormData({
                currentPassword: '',
                newPassword: '',
            });
            setShowPasswordFields(false);
            setActiveCard(null);
        } catch (error) {
            if (!axios.isCancel(error)) {
                console.error('Error changing password:', error);
                setMessage(error.response?.data?.message || 'An error occurred while changing the password');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleProfileUpdate = async () => {
        setIsLoading(true);
        setMessage('');
        const source = axios.CancelToken.source();

        try {
            const _response = await axios.put(`${API_URL}/api/teachers/${currentUser.id}`, {
                email: profileData.email,
                name: profileData.name
            }, { cancelToken: source.token });

            setMessage('Profile updated successfully');
            const updatedUser = { ...currentUser, ...profileData, username: profileData.name };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setShowProfileFields(false);
            setActiveCard(null);
        } catch (error) {
            if (!axios.isCancel(error)) {
                console.error('Error updating profile:', error);
                setMessage(error.response?.data?.message || 'An error occurred while updating the profile');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData((prevState) => ({
            ...prevState,
            [name]: value,
        }));
    };

    const handleProfileInputChange = (e) => {
        const { name, value } = e.target;
        setProfileData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const settingsCards = [
        {
            id: 'profile',
            title: 'Profile Settings',
            icon: '👤',
            description: 'View and update your profile information',
            color: '#4f46e5'
        },
        {
            id: 'password',
            title: 'Security',
            icon: '🔒',
            description: 'Change your password and security settings',
            color: '#7c3aed'
        },
        {
            id: 'logout',
            title: 'Logout',
            icon: '🚪',
            description: 'Sign out of your account',
            color: '#dc2626'
        }
    ];

    return (
        <div className="content">
            <div className="settings-container">
                <div className="settings-header">
                    <h2>Settings & Preferences</h2>
                </div>
                
                <div className="settings-grid">
                    {settingsCards.map((card) => (
                        <div 
                            key={card.id}
                            className={`settings-card ${activeCard === card.id ? 'active' : ''}`}
                            style={{'--card-color': card.color}}
                            onClick={() => {
                                if (card.id === 'logout') {
                                    handleLogout();
                                } else {
                                    setActiveCard(activeCard === card.id ? null : card.id);
                                    if (card.id === 'password') {
                                        setShowPasswordFields(!showPasswordFields);
                                        setShowProfileFields(false);
                                    } else if (card.id === 'profile') {
                                        setShowProfileFields(!showProfileFields);
                                        setShowPasswordFields(false);
                                    }
                                }
                            }}
                        >
                            <div className="card-icon">{card.icon}</div>
                            <div className="card-content">
                                <h3>{card.title}</h3>
                                <p>{card.description}</p>
                            </div>
                            {card.id !== 'logout' && (
                                <div className="card-arrow">→</div>
                            )}
                        </div>
                    ))}
                </div>

                {showProfileFields && (
                    <div className="settings-panel">
                        <div className="panel-header">
                            <h3>Profile Settings</h3>
                            <button className="close-panel" onClick={() => {
                                setShowProfileFields(false);
                                setActiveCard(null);
                            }}>×</button>
                        </div>
                        <div className="panel-content">
                            <div className="input-group">
                                <label>Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    placeholder="Enter your name"
                                    value={profileData.name}
                                    onChange={handleProfileInputChange}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="input-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    placeholder="Enter your email"
                                    value={profileData.email}
                                    onChange={handleProfileInputChange}
                                    disabled={isLoading}
                                />
                            </div>
                            <button
                                className="update-profile-btn"
                                onClick={handleProfileUpdate}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Updating...' : 'Update Profile'}
                            </button>
                            {message && <div className="settings-message">{message}</div>}
                        </div>
                    </div>
                )}

                {showPasswordFields && (
                    <div className="settings-panel">
                        <div className="panel-header">
                            <h3>Change Password</h3>
                            <button className="close-panel" onClick={() => {
                                setShowPasswordFields(false);
                                setActiveCard(null);
                            }}>×</button>
                        </div>
                        <div className="panel-content">
                            <div className="input-group">
                                <label>Current Password</label>
                                <input
                                    type="password"
                                    name="currentPassword"
                                    placeholder="Enter your current password"
                                    value={formData.currentPassword}
                                    onChange={handleInputChange}
                                    disabled={isLoading}
                                />
                            </div>
                            <div className="input-group">
                                <label>New Password</label>
                                <input
                                    type="password"
                                    name="newPassword"
                                    placeholder="Enter your new password"
                                    value={formData.newPassword}
                                    onChange={handleInputChange}
                                    disabled={isLoading}
                                />
                            </div>
                            <button
                                className="update-password-btn"
                                onClick={handlePasswordChange}
                                disabled={isLoading}
                            >
                                {isLoading ? 'Updating...' : 'Update Password'}
                            </button>
                            {message && <div className="settings-message">{message}</div>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default TeacherDashboard;