import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './TeacherList.css';

const API_URL = 'https://quizspark-pi.vercel.app/api'; // Relative path for API requests

function TeacherList() {
    const [teachers, setTeachers] = useState([]);
    const [subscriptions, setSubscriptions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchTeachers = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) {
                throw new Error('Student not authenticated');
            }

            const studentId = JSON.parse(storedUser)?.id;
            if (!studentId) {
                throw new Error('Invalid user data');
            }

            const [teachersResponse, subscriptionsResponse] = await Promise.all([
                axios.get(`${API_URL}/profiles/teachers`),
                axios.get(`${API_URL}/subscriptions/${studentId}`),
            ]);

            setTeachers(teachersResponse.data);
            setSubscriptions(subscriptionsResponse.data);
        } catch (err) {
            console.error('Error fetching teachers:', err);
            setError(err.message || 'Failed to fetch teachers');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTeachers();
    }, [fetchTeachers]);

    const handleSubscribe = async (teacherId) => {
        try {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) {
                throw new Error('Student not authenticated');
            }

            const studentId = JSON.parse(storedUser)?.id;
            if (!studentId) {
                throw new Error('Invalid user data');
            }

            if (!teacherId) {
                throw new Error('Invalid teacher ID');
            }

            const response = await axios.post(
                `${API_URL}/subscriptions/subscribe`,
                {
                    student_id: studentId,
                    teacher_id: teacherId,
                },
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                }
            );

            if (response.data.success) {
                setError('');
                await fetchTeachers();
            } else {
                throw new Error(response.data.error || 'Subscription failed');
            }
        } catch (err) {
            console.error('Error subscribing to teacher:', err);
            setError(err.response?.data?.error || err.message || 'Failed to subscribe to teacher');
        }
    };

    const handleUnsubscribe = async (teacherId) => {
        try {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) {
                throw new Error('Student not authenticated');
            }

            const studentId = JSON.parse(storedUser)?.id;
            if (!studentId) {
                throw new Error('Invalid user data');
            }

            await axios.post(`${API_URL}/subscriptions/unsubscribe`, {
                student_id: studentId,
                teacher_id: teacherId,
            });
            fetchTeachers();
        } catch (err) {
            console.error('Error unsubscribing from teacher:', err);
            setError(err.message || 'Failed to unsubscribe from teacher');
        }
    };

    const subscribedTeachers = teachers.filter((teacher) =>
        subscriptions.some((sub) => sub.id === teacher.id)
    );
    const unsubscribedTeachers = teachers.filter(
        (teacher) => !subscriptions.some((sub) => sub.id === teacher.id)
    );
    const filteredUnsubscribedTeachers = unsubscribedTeachers.filter((teacher) =>
        teacher.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="teacher-list">
                <div className="loading">Loading teachers...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="teacher-list">
                <div className="error-message">{error}</div>
            </div>
        );
    }

    return (
        <div className="teacher-list">
            <h3>Your Teachers</h3>
            {subscribedTeachers.length === 0 ? (
                <div className="no-teachers">You haven't subscribed to any teachers yet.</div>
            ) : (
                <div className="teacher-grid">
                    {subscribedTeachers.map((teacher) => (
                        <div key={teacher.id} className="teacher-card">
                            <div className="teacher-info">
                                <h4>{teacher.username}</h4>
                                <p>{teacher.email}</p>
                            </div>
                            <div className="teacher-actions">
                                <span className="status subscribed">Subscribed</span>
                                <button
                                    className="subscribed-btn"
                                    onClick={() => handleUnsubscribe(teacher.id)}
                                >
                                    Unsubscribe
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="unsubscribed-section">
                <button
                    className="dropdown-toggle"
                    onClick={() => setShowDropdown(!showDropdown)}
                >
                    {showDropdown ? 'Hide Available Teachers' : 'Show Available Teachers'}
                </button>

                {showDropdown && (
                    <div className="dropdown-menu">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="Search teachers..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        {filteredUnsubscribedTeachers.length === 0 ? (
                            <div className="no-teachers">No teachers found</div>
                        ) : (
                            <ul className="teacher-dropdown-list">
                                {filteredUnsubscribedTeachers.map((teacher) => (
                                    <li key={teacher.id} className="dropdown-item">
                                        <span>{teacher.username}</span>
                                        <button
                                            className="subscribe-btn"
                                            onClick={() => handleSubscribe(teacher.id)}
                                        >
                                            Subscribe
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default TeacherList;