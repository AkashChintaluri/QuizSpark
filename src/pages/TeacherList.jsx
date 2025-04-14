import React, { useState, useEffect } from 'react';
import { getTeachers, getSubscriptions, subscribe, unsubscribe } from '../services/api';
import './TeacherList.css';

function TeacherList({ studentId }) {
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [subscriptions, setSubscriptions] = useState(new Set());

    useEffect(() => {
        fetchTeachers();
    }, [studentId]);

    const fetchTeachers = async () => {
        try {
            const [teachersData, subsData] = await Promise.all([
                getTeachers(),
                getSubscriptions(studentId)
            ]);
            
            if (Array.isArray(teachersData)) {
                setTeachers(teachersData);
            } else {
                console.warn('Teachers response is not an array:', teachersData);
                setTeachers([]);
                setError('Invalid teachers data received.');
            }

            if (Array.isArray(subsData)) {
                setSubscriptions(new Set(subsData.map(sub => sub.id)));
            } else {
                console.warn('Subscriptions response is not an array:', subsData);
                setSubscriptions(new Set());
                setError(subsData?.error || 'Invalid subscriptions data received.');
            }
        } catch (err) {
            console.error('Error fetching data:', err);
            setError(err.response?.data?.error || 'Failed to fetch teacher data.');
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = async (teacherId) => {
        try {
            await subscribe(studentId, teacherId);
            fetchTeachers();
        } catch (err) {
            setError('Failed to subscribe to teacher');
        }
    };

    const handleUnsubscribe = async (teacherId) => {
        try {
            await unsubscribe(studentId, teacherId);
            fetchTeachers();
        } catch (err) {
            setError('Failed to unsubscribe from teacher');
        }
    };

    const subscribedTeachers = teachers.filter(teacher => subscriptions.has(teacher.id));
    const unsubscribedTeachers = teachers.filter(teacher => !subscriptions.has(teacher.id));
    const filteredUnsubscribedTeachers = unsubscribedTeachers.filter(teacher =>
        teacher.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="teacher-list">
                <div className="loading-overlay">
                    <div className="spinner"></div>
                    <p>Loading teachers...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="teacher-list">
                <div className="error-message">
                    <span className="error-icon">⚠️</span>
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="teacher-list">
            <div className="section-header">
                <h3>Your Teachers</h3>
            </div>
            
            {subscribedTeachers.length === 0 ? (
                <div className="empty-state">
                    <p>You haven't subscribed to any teachers yet.</p>
                </div>
            ) : (
                <div className="teacher-grid">
                    {subscribedTeachers.map((teacher) => (
                        <div key={teacher.id} className="teacher-card">
                            <div className="teacher-info">
                                <h4>{teacher.username}</h4>
                                <p>{teacher.email}</p>
                            </div>
                            <div className="teacher-actions">
                                <span className="status-badge subscribed">Subscribed</span>
                                <button
                                    className="action-button unsubscribe"
                                    onClick={() => handleUnsubscribe(teacher.id)}
                                >
                                    Unsubscribe
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="teacher-search-section">
                <button
                    className="toggle-button"
                    onClick={() => setShowDropdown(!showDropdown)}
                >
                    {showDropdown ? 'Hide Available Teachers' : 'Show Available Teachers'}
                </button>

                {showDropdown && (
                    <div className="search-dropdown">
                        <div className="search-bar">
                            <span className="search-icon">🔍</span>
                            <input
                                type="text"
                                className="search-input"
                                placeholder="Search teachers..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        {filteredUnsubscribedTeachers.length === 0 ? (
                            <div className="empty-state">
                                <p>No teachers found</p>
                            </div>
                        ) : (
                            <ul className="teacher-list-dropdown">
                                {filteredUnsubscribedTeachers.map((teacher) => (
                                    <li key={teacher.id} className="teacher-item">
                                        <span className="teacher-name">{teacher.username}</span>
                                        <button
                                            className="action-button subscribe"
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