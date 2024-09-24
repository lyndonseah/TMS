import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import AppList from "./pages/AppList";
import UserProfile from "./pages/UserProfile";
import UserManagement from "./pages/UserManagement";
import TaskList from "./pages/TaskList";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/applist" element={<AppList />} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/management" element={<UserManagement />} />
        <Route path="/tasklist" element={<TaskList />} />
        <Route path="/" element={<Login />} />
      </Routes>
    </Router>
  );
}

export default App;
