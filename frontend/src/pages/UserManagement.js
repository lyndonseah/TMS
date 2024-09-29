import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { fetchUserDetails } from "../utils/fetchUserDetails";
import { forceLogout } from "../utils/forceLogout";
import Navbar from "../components/Navbar";
import Select from "react-select";
import makeAnimated from "react-select/animated";
import "./UserManagement.css";

function UserManagement() {
  const navigate = useNavigate();
  const [userDetails, setUserDetails] = useState({ username: "", isAuthorized: false });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [groups, setGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState([]);
  const [editUserId, setEditUserId] = useState(null);
  const [originalUserData, setOriginalUserData] = useState({});
  const [isCreateGroupModalOpen, setIsCreateGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");

  async function checkUserAdmin() {
    try {
      const data = await fetchUserDetails();
      if (!data.isAuthorized || data.user.active !== 1) {
        await forceLogout(navigate);
      }
    } catch (error) {
      await forceLogout(navigate);
    }
  }

  const fetchAllUsers = async () => {
    try {
      const userResponse = await axios.get("http://localhost:3007/api/users", { withCredentials: true });
      if (userResponse.data.success && userResponse.data.rows) {
        const usersWithData = await Promise.all(
          userResponse.data.rows.map(async user => {
            try {
              const groupResponse = await axios.post("http://localhost:3007/api/group", { username: user.username }, { withCredentials: true });
              const groupsFormatted = groupResponse.data.groups.map(groupName => ({
                label: groupName,
                value: groupName
              }));
              return {
                ...user,
                groups: groupsFormatted,
                password: "**********"
              };
            } catch (error) {
              console.error("Error fetching group details for user:", user.username, error);
              return {
                ...user,
                groups: [],
                password: "**********"
              };
            }
          })
        );
        setUsers(usersWithData);
      } else {
        toast.error("No users found or request failed.");
      }
    } catch (error) {
      toast.error("Failed to fetch user details.");
    }
  };

  const fetchGroups = async () => {
    try {
      const groupResponse = await axios.get("http://localhost:3007/api/groups", { withCredentials: true });
      setGroups(groupResponse.data.rows.map(group => ({ label: group.group_name, value: group.group_id })));
    } catch (error) {
      toast.error("Failed to fetch groups.");
    }
  };

  useEffect(() => {
    const initializeUserProfile = async () => {
      try {
        const data = await fetchUserDetails();

        if (!data.isAuthorized || data.user.active !== 1) {
          await forceLogout(navigate);
          return;
        }

        setUserDetails({ username: data.user.username, isAuthorized: data.isAuthorized });
        await fetchGroups();
        fetchAllUsers();
      } catch (error) {
        console.log(error);
        toast.error("Failed to initialize page.");
      }
    };

    initializeUserProfile();
  }, [navigate]);

  const handleCreateUser = async () => {
    checkUserAdmin();

    if (!username || !password) {
      toast.error("Username/Password must not be empty.");
      return;
    }

    const pwRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[~!@#$%^&*-=_+,.]).{8,10}$/;
    if (!pwRegex.test(password)) {
      toast.error("Password must be 8-10 characters and include at least one alphabet, one number, and one special character.");
      return;
    }

    setIsSubmitting(true);
    try {
      const createUserResponse = await axios.post("http://localhost:3007/api/users/create", { username, password, email }, { withCredentials: true });
      console.log(createUserResponse.data);
      if (selectedGroups.length > 0) {
        await axios.patch("http://localhost:3007/api/groups/assign", { username: createUserResponse.data.username, group_names: selectedGroups.map(group => group.label) }, { withCredentials: true });
      }

      toast.success("User created successfully.");
      fetchAllUsers();
      setUsername("");
      setPassword("");
      setEmail("");
      setSelectedGroups([]);
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to create user.");
      }
    }
    setIsSubmitting(false);
  };

  const handleCreateGroupClick = () => {
    checkUserAdmin();
    setIsCreateGroupModalOpen(true);
    setNewGroupName("");
  };

  const handleCreateGroup = async () => {
    checkUserAdmin();

    if (!newGroupName.trim()) {
      toast.error("Group name must not be empty.");
      return;
    }

    try {
      const response = await axios.post("http://localhost:3007/api/groups/create", { group_name: newGroupName }, { withCredentials: true });
      if (response.data.success) {
        toast.success("Group created successfully");
        setIsCreateGroupModalOpen(false);
        setNewGroupName("");
        fetchGroups();
      }
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to create group.");
      }
    }
  };

  const handleCancelCreateGroup = () => {
    setIsCreateGroupModalOpen(false);
    setNewGroupName("");
  };

  const handleEdit = userId => {
    if (editUserId === userId) {
      setEditUserId(null);
      setOriginalUserData({});
    } else {
      setEditUserId(userId);
      const user = users.find(u => u.username === userId);
      if (user) {
        setOriginalUserData({ ...user });
        const updatedUsers = users.map(u => (u.username === userId ? { ...u, password: "" } : u));
        setUsers(updatedUsers);
      }
    }
  };

  const handleSave = async user => {
    checkUserAdmin();

    setIsSubmitting(true);
    const changes = {};

    if (user.password && user.password !== originalUserData.password) {
      changes.password = user.password;
    }

    if (user.email !== originalUserData.email) {
      changes.email = user.email;
    }

    if (user.active !== originalUserData.active) {
      changes.active = user.active;
    }

    const originalGroupValues = originalUserData.groups.map(g => g.value).sort();
    const currentGroupValues = user.groups.map(g => g.value).sort();
    const groupsChanged = JSON.stringify(originalGroupValues) !== JSON.stringify(currentGroupValues);

    try {
      if (changes.password || changes.email) {
        const data = { username: user.username };
        if (changes.password) data.password = changes.password;
        if (changes.email) data.email = changes.email;

        await axios.patch("http://localhost:3007/api/users/reset", data, { withCredentials: true });
        toast.success("Password and/or Email updated successfully.");
      }
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to create user.");
      }
    }

    try {
      if (changes.active !== undefined) {
        await axios.patch(
          "http://localhost:3007/api/users/update-status",
          {
            username: user.username,
            active: user.active
          },
          { withCredentials: true }
        );
        toast.success("User's status have been updated successfully.");
      }
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to update user's status.");
      }
    }

    try {
      if (groupsChanged) {
        await axios.patch(
          "http://localhost:3007/api/groups/assign",
          {
            username: user.username,
            group_names: user.groups.map(group => group.label)
          },
          { withCredentials: true }
        );
        toast.success("Group(s) assigned successfully.");
      }
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to assign group.");
      }
    }

    fetchAllUsers();
    setEditUserId(null);
    setIsSubmitting(false);
    setOriginalUserData({});
  };

  const handleCancel = () => {
    setEditUserId(null);
    fetchAllUsers();
  };

  return (
    <div>
      <Navbar username={userDetails.username} isAuthorized={userDetails.isAuthorized} title="USER MANAGEMENT" />
      <div className="user-management">
        <div className="create-user-section">
          <h2>Create New User</h2>
          <table className="create-user-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Password</th>
                <th>Email</th>
                <th>Active</th>
                <th>Groups</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" disabled={isSubmitting} />
                </td>
                <td>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" disabled={isSubmitting} />
                </td>
                <td>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" disabled={isSubmitting} />
                </td>
                <td>
                  <select className="select-active">
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>{" "}
                </td>
                <td>
                  <Select closeMenuOnSelect={false} components={makeAnimated()} isMulti options={groups} value={selectedGroups} onChange={setSelectedGroups} isDisabled={isSubmitting} />
                </td>
                <td>
                  <button onClick={handleCreateUser} disabled={isSubmitting}>
                    Create User
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="display-users-section">
          <button onClick={handleCreateGroupClick} disabled={isSubmitting}>
            Create Group
          </button>
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Password</th>
                <th>Email</th>
                <th>Active</th>
                <th>Group</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.username}>
                  <td>{user.username}</td>
                  <td>
                    {editUserId === user.username ? (
                      <input
                        type="password"
                        value={user.password}
                        onChange={e => {
                          const updatedUsers = users.map(u => (u.username === user.username ? { ...u, password: e.target.value } : u));
                          setUsers(updatedUsers);
                        }}
                      />
                    ) : (
                      "**********"
                    )}
                  </td>
                  <td>
                    {editUserId === user.username ? (
                      <input
                        type="email"
                        value={user.email}
                        onChange={e => {
                          const updatedUsers = users.map(u => (u.username === user.username ? { ...u, email: e.target.value } : u));
                          setUsers(updatedUsers);
                        }}
                      />
                    ) : (
                      user.email
                    )}
                  </td>
                  <td>
                    {editUserId === user.username ? (
                      <select
                        value={user.active}
                        onChange={e => {
                          const updatedUser = { ...user, active: parseInt(e.target.value) };
                          setUsers(users.map(u => (u.username === user.username ? updatedUser : u)));
                        }}
                      >
                        <option value={1}>Yes</option>
                        <option value={0}>No</option>
                      </select>
                    ) : user.active === 1 ? (
                      "Yes"
                    ) : (
                      "No"
                    )}
                  </td>
                  <td>
                    {editUserId === user.username ? (
                      <Select
                        closeMenuOnSelect={false}
                        components={makeAnimated()}
                        isMulti
                        options={groups}
                        value={user.groups}
                        onChange={selected => {
                          const updatedUsers = users.map(u => (u.username === user.username ? { ...u, groups: selected } : u));
                          setUsers(updatedUsers);
                        }}
                      />
                    ) : (
                      user.groups.map(group => group.label).join(", ")
                    )}
                  </td>

                  <td>
                    {editUserId === user.username ? (
                      <>
                        <button onClick={() => handleSave(user)} disabled={isSubmitting}>
                          Save
                        </button>
                        <button onClick={handleCancel}>Cancel</button>
                      </>
                    ) : (
                      user.username !== "Admin" && <button onClick={() => handleEdit(user.username)}>Edit</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {isCreateGroupModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Create Group</h2>
            <input type="text" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Group Name" />
            <div className="modal-buttons">
              <button onClick={handleCreateGroup}>Create Group</button>
              <button onClick={handleCancelCreateGroup}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <ToastContainer position="bottom-right" autoClose={2000} hideProgressBar={true} newestOnTop={false} closeOnClick rtl={false} />
    </div>
  );
}

export default UserManagement;
