import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './SignupForm.css';

const API_URL = process.env.REACT_APP_API_URL;

function SignupForm() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        userType: 'student',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [showPopup, setShowPopup] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (showPopup) {
            const timer = setTimeout(() => {
                setShowPopup(false);
                navigate(formData.userType === 'student' ? '/student-login' : '/teacher-login');
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [showPopup, navigate, formData.userType]);

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        setFormData((prev) => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMessage('');

        try {
            const response = await axios.post(`${API_URL}/signup`, {
                ...formData,
                userType: formData.userType.toLowerCase()
            });

            if (response.data.success) {
                localStorage.setItem('user', JSON.stringify(response.data.user));
                setShowPopup(true);
            } else {
                setErrorMessage(response.data.message || 'Signup failed');
            }
        } catch (error) {
            const serverError = error.response?.data?.error || error.message;
            setErrorMessage(serverError || 'Signup failed. Please try again.');
            console.error('Signup error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="signup">
            <div className="signup-content">
                <h2>Join QuizSpark</h2>
                <form className="signup-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <input
                            type="text"
                            id="username"
                            value={formData.username}
                            onChange={handleInputChange}
                            required
                            placeholder="Username"
                            autoComplete="username"
                            disabled={isLoading}
                        />
                    </div>
                    <div className="form-group">
                        <input
                            type="email"
                            id="email"
                            value={formData.email}
                            onChange={handleInputChange}
                            required
                            placeholder="Email"
                            autoComplete="email"
                            disabled={isLoading}
                        />
                    </div>
                    <div className="form-group">
                        <input
                            type="password"
                            id="password"
                            value={formData.password}
                            onChange={handleInputChange}
                            required
                            placeholder="Password"
                            autoComplete="new-password"
                            disabled={isLoading}
                        />
                    </div>
                    <div className="form-group select-group">
                        <select
                            id="userType"
                            value={formData.userType}
                            onChange={handleInputChange}
                            disabled={isLoading}
                        >
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                        </select>
                        <span className="select-placeholder">I am a</span>
                    </div>
                    {errorMessage && <div className="error-message">{errorMessage}</div>}
                    <button
                        type="submit"
                        className="signup-button"
                        disabled={isLoading}
                    >
                        {isLoading ? 'Creating Account...' : 'Sign Up'}
                    </button>
                </form>
            </div>
            {showPopup && (
                <div className="popup success">
                    ✔️ Account created successfully! Redirecting to login...
                </div>
            )}
        </div>
    );
}

export default SignupForm;