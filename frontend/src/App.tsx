import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Signin from './pages/Signin';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Interview from './pages/Interview';
import ResumeAnalysis from './pages/ResumeAnalysis';
import ScoreSummary from './pages/ScoreSummary';
import ScoreDetail from './pages/ScoreDetail';
import './styles/index.css';

const App: React.FC = () => {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Signin />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/interview" element={<Interview />} />
                <Route path="/resume" element={<ResumeAnalysis />} />
                <Route path="/scores" element={<ScoreSummary />} />
                <Route path="/score/detail" element={<ScoreDetail />} />
                <Route path="*" element={<Signin />} />
            </Routes>
        </Router>
    );
};

export default App;
