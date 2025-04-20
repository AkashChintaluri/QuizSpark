// src/App.jsx
import './App.css';
import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ChakraProvider } from '@chakra-ui/react';
import Home from './pages/Home';
import StudentLogin from './pages/StudentLogin';
import TeacherLogin from './pages/TeacherLogin';
import SignupForm from './pages/SignupForm';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import NotFound from './pages/NotFound';
import Header from './components/Header';

const Layout = ({ children }) => {
    const location = useLocation();
    const hideHeaderPaths = ['/student-dashboard', '/teacher-dashboard'];
    const shouldShowHeader = !hideHeaderPaths.some(path => location.pathname.startsWith(path));

    return (
        <div className="layout-container">
            {shouldShowHeader && <Header />}
            <main className="main-content">
                {children}
            </main>
        </div>
    );
};

function App() {
    return (
        <ChakraProvider>
            <Router>
                <div className="App">
                    <Routes>
                        <Route path="/" element={<Layout><Home /></Layout>} />
                        <Route path="/student-login" element={<Layout><StudentLogin /></Layout>} />
                        <Route path="/teacher-login" element={<Layout><TeacherLogin /></Layout>} />
                        <Route path="/signup" element={<Layout><SignupForm /></Layout>} />

                        {/* Student Dashboard Routes */}
                        <Route path="/student-dashboard/*" element={<StudentDashboard />}>
                            <Route index element={null} />
                            <Route path="take-quiz/:quizCode" element={null} />
                            <Route path="quiz/:quizCode" element={null} />
                            <Route path="leaderboard/:quizCode?" element={null} />
                        </Route>

                        <Route path="/teacher-dashboard" element={<Layout><TeacherDashboard /></Layout>} />
                        
                        {/* 404 Route - This should be the last route */}
                        <Route path="*" element={<Layout><NotFound /></Layout>} />
                    </Routes>
                </div>
            </Router>
        </ChakraProvider>
    );
}

export default App;