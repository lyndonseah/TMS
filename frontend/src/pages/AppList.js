import React, { useState, useEffect } from "react";
import "react-toastify/dist/ReactToastify.css";
import { fetchUserDetails } from "../utils/fetchUserDetails";
import Navbar from "../components/Navbar";
import "./AppList.css";

function AppList() {
  const [userDetails, setUserDetails] = useState({ username: "", isAuthorized: false });

  useEffect(() => {
    const initializeUserProfile = async () => {
      try {
        const data = await fetchUserDetails();
        setUserDetails({ username: data.user.username, isAuthorized: data.isAuthorized });
      } catch (error) {
        console.log(error);
      }
    };

    initializeUserProfile();
  }, []);

  return (
    <div>
      <Navbar username={userDetails.username} isAuthorized={userDetails.isAuthorized} title="APP LIST" />
      <div className="content">
        <p>This area will display apps in future sprints.</p>
      </div>
    </div>
  );
}

export default AppList;
