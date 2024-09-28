import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Select from "react-select";
import { parse, format } from "date-fns";
import { fetchUserDetails } from "../utils/fetchUserDetails";
import Navbar from "../components/Navbar";
import "./AppList.css";

function AppList() {
  const navigate = useNavigate();
  const [userDetails, setUserDetails] = useState({ username: "", isAuthorized: false });
  const [applications, setApplications] = useState([]);
  const [userGroups, setUserGroups] = useState([]);
  const [groups, setGroups] = useState([]);
  const [newApp, setNewApp] = useState({
    app_acronym: "",
    app_description: "",
    app_rNumber: "",
    app_startDate: null,
    app_endDate: null,
    app_permitCreate: null,
    app_permitOpen: null,
    app_permitToDoList: null,
    app_permitDoing: null,
    app_permitDone: null
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchGroups = async () => {
    try {
      const groupResponse = await axios.get("http://localhost:3007/api/groups", { withCredentials: true });
      setGroups(groupResponse.data.rows.map(group => ({ label: group.group_name, value: group.group_name })));
    } catch (error) {
      toast.error("Failed to fetch groups.");
    }
  };

  const fetchApplications = async () => {
    try {
      const response = await axios.get("http://localhost:3007/api/apps", { withCredentials: true });
      setApplications(response.data.rows);
    } catch (error) {
      toast.info("No applications found.");
    }
  };

  const fetchSelfGroup = async () => {
    try {
      const groupResponse = await axios.get("http://localhost:3007/api/group/self", { withCredentials: true });
      if (groupResponse.data.success) {
        setUserGroups(groupResponse.data.groups);
      } else {
        toast.error("Failed to fetch user groups.");
      }
    } catch (error) {
      toast.error("Failed to fetch user groups.");
    }
  };

  useEffect(() => {
    const initializeUserProfile = async () => {
      try {
        const data = await fetchUserDetails();
        setUserDetails({ username: data.user.username, isAuthorized: data.isAuthorized });
        fetchApplications();
        await fetchSelfGroup();
      } catch (error) {
        toast.error("Failed to load user details.");
      }
    };

    initializeUserProfile();
  }, []);

  const isPermit = () => {
    return userGroups.includes("PROJECT_LEAD");
  };

  const handleCreateAppClick = async () => {
    setIsCreateModalOpen(true);
    fetchGroups();
  };

  const handleCreateApp = async () => {
    try {
      const response = await axios.post(
        "http://localhost:3007/api/apps/create",
        {
          app_acronym: newApp.app_acronym,
          app_description: newApp.app_description || null,
          app_rNumber: newApp.app_rNumber,
          app_startDate: newApp.app_startDate ? format(newApp.app_startDate, "dd-MM-yyyy") : null,
          app_endDate: newApp.app_endDate ? format(newApp.app_endDate, "dd-MM-yyyy") : null,
          app_permitCreate: newApp.app_permitCreate ? newApp.app_permitCreate.value : null,
          app_permitOpen: newApp.app_permitOpen ? newApp.app_permitOpen.value : null,
          app_permitToDoList: newApp.app_permitToDoList ? newApp.app_permitToDoList.value : null,
          app_permitDoing: newApp.app_permitDoing ? newApp.app_permitDoing.value : null,
          app_permitDone: newApp.app_permitDone ? newApp.app_permitDone.value : null
        },
        { withCredentials: true }
      );
      if (response.data.success) {
        toast.success(response.data.message);
        setIsCreateModalOpen(false);
        setNewApp({
          app_acronym: "",
          app_description: "",
          app_rNumber: "",
          app_startDate: null,
          app_endDate: null,
          app_permitCreate: null,
          app_permitOpen: null,
          app_permitToDoList: null,
          app_permitDoing: null,
          app_permitDone: null
        });
        fetchApplications();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to create application.");
      }
    }
  };

  const handleEditAppClick = app => {
    setSelectedApp({
      ...app,
      app_startDate: app.app_startDate ? parse(app.app_startDate, "dd-MM-yyyy", new Date()) : null,
      app_endDate: app.app_endDate ? parse(app.app_endDate, "dd-MM-yyyy", new Date()) : null,
      app_permitCreate: app.app_permitCreate ? { label: app.app_permitCreate, value: app.app_permitCreate } : null,
      app_permitOpen: app.app_permitOpen ? { label: app.app_permitOpen, value: app.app_permitOpen } : null,
      app_permitToDoList: app.app_permitToDoList ? { label: app.app_permitToDoList, value: app.app_permitToDoList } : null,
      app_permitDoing: app.app_permitDoing ? { label: app.app_permitDoing, value: app.app_permitDoing } : null,
      app_permitDone: app.app_permitDone ? { label: app.app_permitDone, value: app.app_permitDone } : null
    });
    setIsEditModalOpen(true);
    fetchGroups();
  };

  const handleEditApp = async () => {
    try {
      const response = await axios.patch(
        "http://localhost:3007/api/apps/edit",
        {
          app_acronym: selectedApp.app_acronym,
          app_description: selectedApp.app_description || null,
          app_permitCreate: selectedApp.app_permitCreate ? selectedApp.app_permitCreate.value : null,
          app_permitOpen: selectedApp.app_permitOpen ? selectedApp.app_permitOpen.value : null,
          app_permitToDoList: selectedApp.app_permitToDoList ? selectedApp.app_permitToDoList.value : null,
          app_permitDoing: selectedApp.app_permitDoing ? selectedApp.app_permitDoing.value : null,
          app_permitDone: selectedApp.app_permitDone ? selectedApp.app_permitDone.value : null
        },
        { withCredentials: true }
      );
      if (response.data.success) {
        toast.success(response.data.message);
        setIsEditModalOpen(false);
        setSelectedApp(null);
        fetchApplications();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to edit application.");
      }
    }
  };

  return (
    <div>
      <Navbar username={userDetails.username} isAuthorized={userDetails.isAuthorized} title="APP LIST" />
      <div className="content">
        {isPermit() && (
          <div className="create-app-button-container">
            <button className="create-app-btn" onClick={handleCreateAppClick}>
              Create App
            </button>
          </div>
        )}
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
                    {isPermit() && (
                      <p className="click-edit" onClick={() => handleEditAppClick(app)}>
                        Edit
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p>No applications available.</p>
          )}
        </div>
      </div>
      {isCreateModalOpen && (
        <div className="modal-overlay">
          <div className="create-app-modal">
            <h2 className="create-app-modal-title">Create App</h2>
            <div className="create-app-modal-content">
              <div className="create-app-modal-row">
                <label className="create-app-modal-label">Acronym:</label>
                <input type="text" className="create-app-modal-input" value={newApp.app_acronym} onChange={e => setNewApp({ ...newApp, app_acronym: e.target.value })} />
              </div>
              <div className="create-app-modal-row">
                <label className="create-app-modal-label">Description:</label>
                <textarea className="create-app-modal-textarea" value={newApp.app_description} onChange={e => setNewApp({ ...newApp, app_description: e.target.value })} maxLength="255" />
              </div>
              <div className="create-app-modal-row">
                <label className="create-app-modal-label">R Number:</label>
                <input type="number" className="create-app-modal-input" value={newApp.app_rNumber} onChange={e => setNewApp({ ...newApp, app_rNumber: e.target.value })} />
              </div>
              <div className="create-app-modal-row date-row">
                <div className="date-picker-container">
                  <label className="create-app-modal-label">Start Date:</label>
                  <DatePicker selected={newApp.app_startDate} onChange={date => setNewApp({ ...newApp, app_startDate: date })} dateFormat="dd-MM-yyyy" className="create-app-modal-input short-input" />
                </div>
                <div className="date-picker-container">
                  <label className="create-app-modal-label">End Date:</label>
                  <DatePicker selected={newApp.app_endDate} onChange={date => setNewApp({ ...newApp, app_endDate: date })} dateFormat="dd-MM-yyyy" className="create-app-modal-input short-input" />
                </div>
              </div>
              <h3 className="create-app-modal-permit-title">Permit Group</h3>
              <div className="create-app-modal-row permit-row">
                <div className="permit-field-container">
                  <label className="create-app-modal-label">Create:</label>
                  <Select options={groups} value={newApp.app_permitCreate} onChange={option => setNewApp({ ...newApp, app_permitCreate: option })} className="create-app-modal-select" isClearable={true} />
                </div>
                <div className="permit-field-container">
                  <label className="create-app-modal-label">Open:</label>
                  <Select options={groups} value={newApp.app_permitOpen} onChange={option => setNewApp({ ...newApp, app_permitOpen: option })} className="create-app-modal-select" isClearable={true} />
                </div>
              </div>
              <div className="create-app-modal-row permit-row">
                <div className="permit-field-container">
                  <label className="create-app-modal-label">ToDo:</label>
                  <Select options={groups} value={newApp.app_permitToDoList} onChange={option => setNewApp({ ...newApp, app_permitToDoList: option })} className="create-app-modal-select" isClearable={true} />
                </div>
                <div className="permit-field-container">
                  <label className="create-app-modal-label">Doing:</label>
                  <Select options={groups} value={newApp.app_permitDoing} onChange={option => setNewApp({ ...newApp, app_permitDoing: option })} className="create-app-modal-select" isClearable={true} />
                </div>
              </div>
              <div className="create-app-modal-row permit-row">
                <div className="permit-field-container">
                  <label className="create-app-modal-label">Done:</label>
                  <Select options={groups} value={newApp.app_permitDone} onChange={option => setNewApp({ ...newApp, app_permitDone: option })} className="create-app-modal-select" isClearable={true} />
                </div>
                <div className="permit-field-container empty-permit-field">{}</div>
              </div>
            </div>
            <div className="create-app-modal-buttons">
              <button className="modal-button create-button" onClick={handleCreateApp}>
                Create
              </button>
              <button
                className="modal-button cancel-button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setNewApp({
                    app_acronym: "",
                    app_description: "",
                    app_rNumber: "",
                    app_startDate: null,
                    app_endDate: null,
                    app_permitCreate: null,
                    app_permitOpen: null,
                    app_permitToDoList: null,
                    app_permitDoing: null,
                    app_permitDone: null
                  });
                  fetchSelfGroup();
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {isEditModalOpen && selectedApp && (
        <div className="modal-overlay">
          <div className="edit-app-modal">
            <h2 className="edit-app-modal-title">Edit App</h2>
            <div className="edit-app-modal-content">
              <div className="edit-app-modal-row">
                <label className="edit-app-modal-label">Acronym:</label>
                <input type="text" className="edit-app-modal-input" value={selectedApp.app_acronym} readOnly />
              </div>
              <div className="edit-app-modal-row">
                <label className="edit-app-modal-label">Description:</label>
                <textarea className="edit-app-modal-textarea" value={selectedApp.app_description} onChange={e => setSelectedApp({ ...selectedApp, app_description: e.target.value })} maxLength="255" />
              </div>
              <div className="edit-app-modal-row">
                <label className="edit-app-modal-label">R Number:</label>
                <input type="number" className="edit-app-modal-input" value={selectedApp.app_rNumber} readOnly />
              </div>
              <div className="edit-app-modal-row date-row">
                <div className="date-picker-container">
                  <label className="edit-app-modal-label">Start Date:</label>
                  <DatePicker selected={selectedApp.app_startDate} dateFormat="dd-MM-yyyy" className="edit-app-modal-input short-input" readOnly />
                </div>
                <div className="date-picker-container">
                  <label className="edit-app-modal-label">End Date:</label>
                  <DatePicker selected={selectedApp.app_endDate} dateFormat="dd-MM-yyyy" className="edit-app-modal-input short-input" readOnly />
                </div>
              </div>
              <h3 className="edit-app-modal-permit-title">Permit Group</h3>
              <div className="edit-app-modal-row permit-row">
                <div className="permit-field-container">
                  <label className="edit-app-modal-label">Create:</label>
                  <Select options={groups} value={selectedApp.app_permitCreate} onChange={option => setSelectedApp({ ...selectedApp, app_permitCreate: option })} className="edit-app-modal-select" isClearable={true} />
                </div>
                <div className="permit-field-container">
                  <label className="edit-app-modal-label">Open:</label>
                  <Select options={groups} value={selectedApp.app_permitOpen} onChange={option => setSelectedApp({ ...selectedApp, app_permitOpen: option })} className="edit-app-modal-select" isClearable={true} />
                </div>
              </div>
              <div className="edit-app-modal-row permit-row">
                <div className="permit-field-container">
                  <label className="edit-app-modal-label">ToDo:</label>
                  <Select options={groups} value={selectedApp.app_permitToDoList} onChange={option => setSelectedApp({ ...selectedApp, app_permitToDoList: option })} className="edit-app-modal-select" isClearable={true} />
                </div>
                <div className="permit-field-container">
                  <label className="edit-app-modal-label">Doing:</label>
                  <Select options={groups} value={selectedApp.app_permitDoing} onChange={option => setSelectedApp({ ...selectedApp, app_permitDoing: option })} className="edit-app-modal-select" isClearable={true} />
                </div>
              </div>
              <div className="edit-app-modal-row permit-row">
                <div className="permit-field-container">
                  <label className="edit-app-modal-label">Done:</label>
                  <Select options={groups} value={selectedApp.app_permitDone} onChange={option => setSelectedApp({ ...selectedApp, app_permitDone: option })} className="edit-app-modal-select" isClearable={true} />
                </div>
                <div className="permit-field-container empty-permit-field">{}</div>
              </div>
            </div>
            <div className="edit-app-modal-buttons">
              <button className="modal-button edit-button" onClick={handleEditApp}>
                Save changes
              </button>
              <button
                className="modal-button cancel-button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedApp(null);
                  fetchSelfGroup();
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      <ToastContainer position="bottom-right" autoClose={2000} hideProgressBar={true} newestOnTop={false} closeOnClick rtl={false} />
    </div>
  );
}

export default AppList;
