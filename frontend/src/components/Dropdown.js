import React from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import "./Dropdown.css";

function Dropdown({ isAuthorized }) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await axios.get("http://localhost:3000/api/logout-user", { withCredentials: true });
      navigate("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="dropdown">
      <ul>
        <li>
          <Link to="/applist">App List</Link>
        </li>
        <li>
          <Link to="/profile">View/Edit Profile</Link>
        </li>
        {isAuthorized && (
          <li>
            <Link to="/management">User Management</Link>
          </li>
        )}
        <li>
          <Link to="/login" onClick={handleLogout}>
            Logout
          </Link>
        </li>
      </ul>
    </div>
  );
}

export default Dropdown;
