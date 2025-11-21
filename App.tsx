import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Dashboard';
import SubjectDashboard from './pages/SubjectDashboard';
import NewExam from './pages/NewExam';
import Workspace from './pages/Workspace';
import Export from './pages/Export';
import Import from './pages/Import';
import Settings from './pages/Settings';
import StudyMode from './pages/StudyMode';

const App: React.FC = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/subject/:subjectId" element={<SubjectDashboard />} />
        <Route path="/new" element={<NewExam />} />
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/export" element={<Export />} />
        <Route path="/import" element={<Import />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/study/:folderId" element={<StudyMode />} />
        {/* Catch all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
};

export default App;