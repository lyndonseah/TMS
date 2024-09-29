import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./Login.css";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const handleLogin = async e => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("Empty field!");
      return;
    }

    try {
      const response = await axios.post(
        "http://localhost:3007/api/login",
        {
          username: username,
          password: password
        },
        {
          withCredentials: true
        }
      );

      if (response.data.success) {
        console.log(response.data);
        navigate("/applist");
      }
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Invalid credentials.");
      }
    }
  };

  return (
    <form onSubmit={handleLogin} className="login-form">
      <div className="input-group">
        <input type="text" placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
        <button type="submit">Login</button>
      </div>
      <ToastContainer position="bottom-right" autoClose={2000} hideProgressBar={true} newestOnTop={false} closeOnClick rtl={false} />
    </form>
  );
};

export default Login;
