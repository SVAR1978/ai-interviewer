import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Signin from './pages/Signin';
import Signup from './pages/Signup';
import DashboardLayout from './components/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Interview from './pages/Interview';
import ResumeAnalysis from './pages/ResumeAnalysis';
import ScoreSummary from './pages/ScoreSummary';
import ScoreDetail from './pages/ScoreDetail';
import JobDescriptions from './pages/JobDescriptions';
import './styles/index.css';

const App: React.FC = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/signin" element={<Signin />} />
                <Route path="/signup" element={<Signup />} />
                
                {/* Authenticated routes wrapped in DashboardLayout */}
                <Route element={<DashboardLayout />}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/interview" element={<Interview />} />
                    <Route path="/resume" element={<ResumeAnalysis />} />
                    <Route path="/scores" element={<ScoreSummary />} />
                    <Route path="/score/detail" element={<ScoreDetail />} />
                    <Route path="/job-descriptions" element={<JobDescriptions />} />
                </Route>

                <Route path="*" element={<LandingPage />} />
            </Routes>
        </Router>
    );
};

export default App;

