import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Tesseract from 'tesseract.js';
import '../styles/checkresume.css';

const ResumeAnalysis: React.FC = () => {
    const [image, setImage] = useState<string | null>(null);
    const [profile, setProfile] = useState('frontend');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setImage(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleReview = async () => {
        if (!image) return alert('Upload image first');
        setIsLoading(true);
        try {
            const { data: { text } } = await Tesseract.recognize(image, 'eng');
            const token = localStorage.getItem('jwttoken');
            if (!token) return navigate('/');

            const res = await fetch('http://localhost:3000/api/checkresume', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'jwttoken': token
                },
                body: JSON.stringify({ resume: text, profile })
            });
            const data = await res.json();
            localStorage.setItem('resumeAnalysis', JSON.stringify(data));
            navigate('/result');
        } catch (err) {
            alert('Analysis failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="resume-container">
            <div className="upload-box">
                <input type="file" onChange={handleImageUpload} accept="image/*" />
                {image && <img src={image} alt="Preview" />}
                <select value={profile} onChange={(e) => setProfile(e.target.value)}>
                    <option value="frontend">Frontend</option>
                    <option value="backend">Backend</option>
                    <option value="devops">DevOps</option>
                    <option value="ML">ML</option>
                </select>
                <button onClick={handleReview} disabled={isLoading}>
                    {isLoading ? 'Analyzing...' : 'Review Resume'}
                </button>
            </div>
            <button onClick={() => navigate('/dashboard')}>Home</button>
        </div>
    );
};

export default ResumeAnalysis;
