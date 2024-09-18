import axios from 'axios';

export const fetchUserDetails = async () => {
  try {
    const response = await axios.get("http://localhost:3007/api/user", { withCredentials: true });
    if (response.data.success) {
      return response.data;
    } else {
      throw new Error('Failed to fetch user details.');
    }
  } catch (error) {
    console.error("Error fetching user details :", error);
    throw error;
  }
};
