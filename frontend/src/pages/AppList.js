import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { fetchUserDetails } from "../utils/fetchUserDetails";
import Navbar from "../components/Navbar";
import "./AppList.css";

function AppList() {
  const [userDetails, setUserDetails] = useState({ username: "", isAuthorized: false });
  const [applications, setApplications] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const initializeUserProfile = async () => {
      try {
        const data = await fetchUserDetails();
        setUserDetails({ username: data.user.username, isAuthorized: data.isAuthorized });
        fetchApplications();
      } catch (error) {
        toast.error("Failed to load user details.");
      }
    };

    const fetchApplications = async () => {
      try {
        const response = await axios.get("http://localhost:3007/api/apps", { withCredentials: true });
        setApplications(response.data.rows);
      } catch (error) {
        toast.error(error.message);
      }
    };

    initializeUserProfile();
  }, []);

  return (
    <div>
      <Navbar username={userDetails.username} isAuthorized={userDetails.isAuthorized} title="APP LIST" />
      <div className="content">
        <div className="app-container">
          {applications.length > 0 ? (
            applications.map((app, index) => (
              <div key={index} className="app-card">
                <h3 className="app-acronym">{app.app_acronym}</h3>
                <p className="app-description">{app.app_description}</p>
                <div className="rNumber-actions">
                  <p className="app-rNumber">&lt;Release number: {app.app_rNumber}&gt;</p>
                  <div className="action-buttons">
                    <p className="click-view" onClick={() => navigate("/tasklist", { state: { appAcronym: app.app_acronym } })}>
                      View
                    </p>
                    <p className="click-edit">Edit</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p>No applications available.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AppList;
