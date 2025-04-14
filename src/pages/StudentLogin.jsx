import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/api';
import './Login.css';

function StudentLogin() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({ username: '', password: '' });
    const [isLoading, setIsLoading] = useState(false);
    const [showPopup, setShowPopup] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (showPopup) {
            const timer = setTimeout(() => {
                setShowPopup(false);
                navigate('/student-dashboard');
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [showPopup, navigate]);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage('');

        try {
            const data = await login(formData.username, formData.password, 'student');
            
            if (data.success) {
                localStorage.setItem('user', JSON.stringify(data.user));
                setShowPopup(true);
            } else {
                setErrorMessage('Invalid username or password');
            }
        } catch (error) {
            setErrorMessage('Login failed. Please try again.');
            console.error('Login error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h2>Student Login</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            value={formData.username}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={formData.password}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    {errorMessage && <div className="error-message">{errorMessage}</div>}
                    <button type="submit" disabled={isLoading}>
                        {isLoading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
            </div>
            {showPopup && (
                <div className="popup">
                    <p>Login successful! Redirecting...</p>
                </div>
            )}
        </div>
    );
}

export default StudentLogin;
