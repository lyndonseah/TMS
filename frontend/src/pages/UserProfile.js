import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { fetchUserDetails } from "../utils/fetchUserDetails";
import { forceLogout } from "../utils/forceLogout";
import "./UserProfile.css";
import Navbar from "../components/Navbar";

const UserProfile = () => {
  const navigate = useNavigate();
  const [userDetails, setUserDetails] = useState({ username: "", email: "", isAuthorized: false });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const initializeUserProfile = async () => {
      try {
        const data = await fetchUserDetails();
        setUserDetails({ username: data.user.username, email: data.user.email, isAuthorized: data.isAuthorized });
        if (!data.user.active) {
          await forceLogout(navigate);
          return;
        }
      } catch (error) {
        toast.error("Failed to fetch user details");
      }
    };

    initializeUserProfile();
  }, [navigate]);

  const validatePassword = password => {
    const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[~!@#$%^&*-=_+,.]).{8,10}$/;
    return pwRegex.test(password);
  };

  const handleUpdateEmail = async () => {
    if (!email) {
      toast.error("Empty field!!");
      return;
    }
    try {
      const response = await axios.patch("http://localhost:3000/api/users/update-email", { newEmail: email }, { withCredentials: true });
      if (response.data.success) {
        setUserDetails(prevState => ({ ...prevState, email }));
        setEmail("");
        toast.success("Email has been updated");
      }
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to assign group.");
      }
    }
  };

  const handleUpdatePassword = async () => {
    if (!password) {
      toast.error("Empty field!");
      return;
    }
    if (!validatePassword(password)) {
      toast.error("Password must be 8-10 characters and include at least one alphabet, one number, and one special character.");
      return;
    }
    try {
      const response = await axios.patch("http://localhost:3000/api/users/update-password", { password }, { withCredentials: true });
      if (response.data.success) {
        setPassword("");
        toast.success("Password has been updated");
      }
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to assign group.");
      }
    }
  };

  return (
    <div>
      <Navbar username={userDetails.username} isAuthorized={userDetails.isAuthorized} title="USER PROFILE" />
      <div className="user-profile">
        <div className="user-details">
          <h2>User Details</h2>
          <p>Username: {userDetails.username}</p>
          <p>Email: {userDetails.email}</p>
        </div>
        <div className="update-email">
          <h2>Update Email</h2>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="New email" />
          <button onClick={handleUpdateEmail}>Update email</button>
        </div>
        <div className="update-password">
          <h2>Change Password</h2>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="New Password" />
          <button onClick={handleUpdatePassword}>Change password</button>
        </div>
      </div>
      <ToastContainer position="bottom-right" autoClose={2000} hideProgressBar={true} newestOnTop={false} closeOnClick rtl={false} />
    </div>
  );
};

export default UserProfile;
