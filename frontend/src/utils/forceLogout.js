import axios from "axios";

export const forceLogout = async navigate => {
  try {
    await axios.post("http://localhost:3007/api/logout", {}, { withCredentials: true });
  } catch (error) {
    console.error("Logout failed:", error);
  } finally {
    navigate("/login");
  }
};
