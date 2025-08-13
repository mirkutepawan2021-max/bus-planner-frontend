// src/App.js

import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout'; // This path is now correct
import HomePage from './pages/HomePage';
import RouteManagementPage from './pages/RouteManagementPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="manage-routes" element={<RouteManagementPage />} />
      </Route>
    </Routes>
  );
}

export default App;
