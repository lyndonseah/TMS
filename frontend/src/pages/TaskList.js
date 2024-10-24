import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate, useLocation } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ChromePicker } from "react-color";
import { parse, format } from "date-fns";
import { fetchUserDetails } from "../utils/fetchUserDetails";
import { forceLogout } from "../utils/forceLogout";
import Navbar from "../components/Navbar";
import Select from "react-select";
import "./TaskList.css";

function TaskList() {
  const navigate = useNavigate();
  const location = useLocation();
  const { appAcronym } = location.state || {};
  const [userDetails, setUserDetails] = useState({ username: "", isAuthorized: false });
  const [userGroups, setUserGroups] = useState([]);
  const [tasks, setTasks] = useState({ Open: [], ToDo: [], Doing: [], Done: [], Close: [] });
  const [newTask, setNewTask] = useState({ task_name: "", task_description: "", task_plan: "", task_notes: "" });
  const [selectedTask, setSelectedTask] = useState(null);
  const [originalTaskPlan, setOriginalTaskPlan] = useState(null);
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [newPlan, setNewPlan] = useState({ plan_mvpName: "", plan_startDate: null, plan_endDate: null, plan_colour: "#000000" });
  const [newNotes, setNewNotes] = useState("");
  const [displayColorPicker, setDisplayColorPicker] = useState(false);
  const [displayEditColorPicker, setDisplayEditColorPicker] = useState(false);
  const [appPermits, setAppPermits] = useState({
    app_permitCreate: null,
    app_permitOpen: null,
    app_permitToDoList: null,
    app_permitDoing: null,
    app_permitDone: null
  });

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditPlanModalOpen, setIsEditPlanModalOpen] = useState(false);
  const [isCreatePlanModalOpen, setIsCreatePlanModalOpen] = useState(false);
  const [isPlanDropdownOpen, setIsPlanDropdownOpen] = useState(false);

  const fetchTasksByState = useCallback(
    async state => {
      try {
        const response = await axios.post("http://localhost:3000/api/tasks", { task_state: state, task_appAcronym: appAcronym }, { withCredentials: true });
        return response.data.rows;
      } catch (error) {
        toast.error(error.message);
        return [];
      }
    },
    [appAcronym]
  );

  const loadTasks = useCallback(async () => {
    const states = ["Open", "ToDo", "Doing", "Done", "Close"];
    const taskPromises = states.map(state => fetchTasksByState(state));
    Promise.all(taskPromises).then(taskArrays => {
      const newTasks = taskArrays.reduce((acc, tasks, index) => {
        acc[states[index]] = tasks;
        return acc;
      }, {});
      setTasks(newTasks);
    });
  }, [fetchTasksByState]);

  const loadPlans = useCallback(async () => {
    try {
      const response = await axios.post("http://localhost:3000/api/plans", { plan_appAcronym: appAcronym }, { withCredentials: true });
      setPlans(
        response.data.rows.map(plan => ({
          label: plan.plan_mvpName,
          value: plan.plan_mvpName,
          plan_startDate: plan.plan_startDate,
          plan_endDate: plan.plan_endDate,
          plan_colour: plan.plan_colour ? `#${plan.plan_colour}` : "#000000"
        }))
      );
    } catch (error) {}
  }, [appAcronym]);

  const fetchOwnGroup = async () => {
    try {
      const groupResponse = await axios.get("http://localhost:3000/api/group/own", { withCredentials: true });
      if (groupResponse.data.success) {
        setUserGroups(groupResponse.data.groups || []);
      } else {
        toast.error("Failed to fetch user groups.");
      }
    } catch (error) {
      toast.error("Failed to fetch user groups.");
    }
  };

  const fetchAppPermits = useCallback(async () => {
    try {
      const response = await axios.post("http://localhost:3000/api/apps/permit", { app_acronym: appAcronym }, { withCredentials: true });

      if (response.data.success) {
        setAppPermits(response.data.permits);
        console.log("Fetched app permits:", response.data.permits);
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error("Failed to fetch group permits.");
    }
  }, [appAcronym]);

  useEffect(() => {
    const initializeUserProfile = async () => {
      try {
        const data = await fetchUserDetails();
        setUserDetails({ username: data.user.username, isAuthorized: data.isAuthorized });
        if (!data.user.active) {
          await forceLogout(navigate);
          return;
        }
        fetchOwnGroup();
        await fetchAppPermits();
        loadTasks();
        loadPlans();
      } catch (error) {
        console.log(error);
        toast.error("Error fetching details.");
      }
    };

    initializeUserProfile();
  }, [navigate, loadTasks, loadPlans, fetchAppPermits]);

  const isPermitPM = () => {
    return userGroups.includes("PROJECT_MANAGER");
  };

  const canViewPlan = () => {
    const permitGroup = ["PROJECT_LEAD", appPermits.app_permitCreate, appPermits.app_permitOpen, appPermits.app_permitDone];
    return permitGroup.some(permit => userGroups.includes(permit));
  };

  const canCreateTask = () => {
    const permitGroup = appPermits.app_permitCreate;
    return permitGroup && userGroups.includes(permitGroup);
  };

  const canInteractWithTask = taskState => {
    if (taskState === "Close") {
      return false;
    }

    let permitGroup = null;
    switch (taskState) {
      case "Open":
        permitGroup = appPermits.app_permitOpen;
        break;
      case "ToDo":
        permitGroup = appPermits.app_permitToDoList;
        break;
      case "Doing":
        permitGroup = appPermits.app_permitDoing;
        break;
      case "Done":
        permitGroup = appPermits.app_permitDone;
        break;
      default:
        permitGroup = null;
    }
    return permitGroup && userGroups.includes(permitGroup);
  };

  const handlePlanButtonMouseEnter = () => {
    setIsPlanDropdownOpen(true);
  };

  const handlePlanButtonMouseLeave = () => {
    setIsPlanDropdownOpen(false);
  };

  const handlePlanSelect = plan => {
    if (plan === "createNew") {
      setIsCreatePlanModalOpen(true);
      setSelectedPlan(null);
    } else {
      const startDate = plan.plan_startDate ? parse(plan.plan_startDate, "dd-MM-yyyy", new Date()) : null;
      const endDate = plan.plan_endDate ? parse(plan.plan_endDate, "dd-MM-yyyy", new Date()) : null;
      const colour = plan.plan_colour ? `#${plan.plan_colour.replace("#", "").toLowerCase()}` : "#000000";
      setSelectedPlan({
        ...plan,
        plan_startDate: startDate,
        plan_endDate: endDate,
        plan_colour: colour
      });
      setIsEditPlanModalOpen(true);
    }
    setIsPlanDropdownOpen(false);
  };

  const handleCreatePlan = async () => {
    try {
      const response = await axios.post(
        "http://localhost:3000/api/plans/create",
        {
          ...newPlan,
          plan_appAcronym: appAcronym,
          plan_colour: newPlan.plan_colour.replace("#", ""),
          plan_startDate: newPlan.plan_startDate ? format(newPlan.plan_startDate, "dd-MM-yyyy") : "",
          plan_endDate: newPlan.plan_endDate ? format(newPlan.plan_endDate, "dd-MM-yyyy") : ""
        },
        { withCredentials: true }
      );
      if (response.data.success) {
        toast.success(response.data.message);
        setNewPlan({ plan_mvpName: "", plan_startDate: "", plan_endDate: "", plan_colour: "#000000" });
        setIsCreatePlanModalOpen(false);
        loadPlans();
        loadTasks();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to create plan.");
      }
    }
  };

  const handleEditPlan = async () => {
    try {
      const response = await axios.patch(
        "http://localhost:3000/api/plans/edit",
        {
          plan_mvpName: selectedPlan.value,
          plan_appAcronym: appAcronym,
          plan_colour: selectedPlan.plan_colour.replace("#", ""),
          plan_startDate: selectedPlan.plan_startDate ? format(selectedPlan.plan_startDate, "dd-MM-yyyy") : "",
          plan_endDate: selectedPlan.plan_endDate ? format(selectedPlan.plan_endDate, "dd-MM-yyyy") : ""
        },
        { withCredentials: true }
      );
      if (response.data.success) {
        toast.success(response.data.message);
        setSelectedPlan(null);
        setIsEditPlanModalOpen(false);
        loadPlans();
        loadTasks();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to edit plan.");
      }
    }
  };

  const handleCreateTaskClick = async () => {
    setIsCreateModalOpen(true);
    loadPlans();
  };

  const handleCreateTask = async () => {
    if (!newTask.task_name.trim()) {
      toast.error("Please fill in Task Name.");
      return;
    }

    try {
      const response = await axios.post("http://localhost:3000/api/tasks/create", { ...newTask, task_appAcronym: appAcronym, task_creator: userDetails.username, task_owner: userDetails.username }, { withCredentials: true });
      if (response.data.success) {
        toast.success(response.data.message);
        setNewTask({ task_name: "", task_description: "", task_plan: "", task_notes: "" });
        setIsCreateModalOpen(false);
        loadTasks();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to create task.");
      }
    }
  };

  const handleViewTaskClick = async task => {
    setSelectedTask(task);
    setOriginalTaskPlan(task.task_plan);
    setNewNotes("");
    fetchOwnGroup();
    setIsViewModalOpen(true);
    loadPlans();
  };

  const handlePromoteTask = async () => {
    if (!selectedTask) return;

    let apiEndpoint = "";
    switch (selectedTask.task_state) {
      case "Open":
        apiEndpoint = "http://localhost:3000/api/tasks/promote-open-todo";
        break;
      case "ToDo":
        apiEndpoint = "http://localhost:3000/api/tasks/promote-todo-doing";
        break;
      case "Doing":
        apiEndpoint = "http://localhost:3000/api/tasks/promote-doing-done";
        break;
      case "Done":
        apiEndpoint = "http://localhost:3000/api/tasks/promote-done-close";
        break;
      default:
        toast.error("Cannot promote task in this state.");
        return;
    }

    try {
      if ((selectedTask.task_state === "Open" || selectedTask.task_state === "Done") && selectedTask.task_plan !== originalTaskPlan) {
        await axios.patch("http://localhost:3000/api/tasks/update-plan", { task_id: selectedTask.task_id, task_plan: selectedTask.task_plan, task_appAcronym: appAcronym, task_owner: userDetails.username }, { withCredentials: true });
      }
      if (newNotes.trim() !== "") {
        await axios.patch("http://localhost:3000/api/tasks/update-notes", { task_id: selectedTask.task_id, task_notes: newNotes, task_appAcronym: appAcronym, task_owner: userDetails.username }, { withCredentials: true });
      }
      const response = await axios.patch(apiEndpoint, { task_id: selectedTask.task_id, task_appAcronym: appAcronym, task_owner: userDetails.username }, { withCredentials: true });

      if (response.data.success) {
        toast.success(response.data.message);
        setIsViewModalOpen(false);
        loadTasks();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to promote task.");
      }
    }
  };

  const handleDemoteTask = async () => {
    if (!selectedTask) return;

    let apiEndpoint = "";
    switch (selectedTask.task_state) {
      case "Doing":
        apiEndpoint = "http://localhost:3000/api/tasks/demote-doing-todo";
        break;
      case "Done":
        apiEndpoint = "http://localhost:3000/api/tasks/demote-done-doing";
        break;
      default:
        toast.error("Cannot demote task in this state.");
        return;
    }

    try {
      if (selectedTask.task_state === "Done" && selectedTask.task_plan !== originalTaskPlan) {
        await axios.patch("http://localhost:3000/api/tasks/update-plan", { task_id: selectedTask.task_id, task_plan: selectedTask.task_plan, task_appAcronym: appAcronym, task_owner: userDetails.username }, { withCredentials: true });
      }
      if (newNotes.trim() !== "") {
        await axios.patch("http://localhost:3000/api/tasks/update-notes", { task_id: selectedTask.task_id, task_notes: newNotes, task_appAcronym: appAcronym, task_owner: userDetails.username }, { withCredentials: true });
      }
      const response = await axios.patch(apiEndpoint, { task_id: selectedTask.task_id, task_appAcronym: appAcronym, task_owner: userDetails.username }, { withCredentials: true });

      if (response.data.success) {
        toast.success(response.data.message);
        setIsViewModalOpen(false);
        loadTasks();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to demote task.");
      }
    }
  };

  const handleSaveChanges = async () => {
    if (!selectedTask) return;

    try {
      if ((selectedTask.task_state === "Open" || selectedTask.task_state === "Done") && selectedTask.task_plan !== originalTaskPlan) {
        await axios.patch("http://localhost:3000/api/tasks/update-plan", { task_id: selectedTask.task_id, task_plan: selectedTask.task_plan, task_appAcronym: appAcronym, task_owner: userDetails.username }, { withCredentials: true });
      }
      if (newNotes.trim() !== "") {
        await axios.patch("http://localhost:3000/api/tasks/update-notes", { task_id: selectedTask.task_id, task_notes: newNotes, task_appAcronym: appAcronym, task_owner: userDetails.username }, { withCredentials: true });
      }

      toast.success("Task changes saved successfully.");
      setIsViewModalOpen(false);
      loadTasks();
    } catch (error) {
      if (error.response && error.response.data) {
        toast.error(error.response.data.message);
      } else {
        toast.error("Failed to save changes.");
      }
    }
  };

  function formatTaskNotes(taskNotes) {
    if (!taskNotes) return "";
    return taskNotes.split("ͻ").join("\n").trim();
  }

  const getPromoteButtonLabel = () => {
    if (!selectedTask) return "Promote";
    switch (selectedTask.task_state) {
      case "Open":
        return "Release Task";
      case "ToDo":
        return "Take On";
      case "Doing":
        return "Send Review";
      case "Done":
        return "Approve Task";
      default:
        return "Promote";
    }
  };

  const getDemoteButtonLabel = () => {
    if (!selectedTask) return "Demote";
    switch (selectedTask.task_state) {
      case "Doing":
        return "Give Up";
      case "Done":
        return "Reject Task";
      default:
        return "Demote";
    }
  };

  const hasPlanChanged = (selectedTask && selectedTask.task_plan) !== originalTaskPlan;
  const isPromoteDisabled = selectedTask ? selectedTask.task_state === "Close" || (selectedTask.task_state === "Done" && hasPlanChanged) : true;
  const isDemoteDisabled = selectedTask && (selectedTask.task_state === "Open" || selectedTask.task_state === "ToDo" || selectedTask.task_state === "Close");
  const isSaveDisabled = selectedTask ? selectedTask.task_state === "Close" || (selectedTask.task_state === "Done" && hasPlanChanged) : true;
  const canInteract = selectedTask ? canInteractWithTask(selectedTask.task_state) : false;

  return (
    <div>
      <Navbar username={userDetails.username} isAuthorized={userDetails.isAuthorized} title={`TASK LIST (${appAcronym})`} />
      <div className="button-container">
        {canCreateTask() && (
          <button className="create-task-btn" onClick={handleCreateTaskClick}>
            Create Task
          </button>
        )}
        <div className="plan-button-container" onMouseEnter={handlePlanButtonMouseEnter} onMouseLeave={handlePlanButtonMouseLeave}>
          <button className="plan-button">Plan</button>
          {isPlanDropdownOpen && (
            <div className="plan-dropdown">
              {plans.map(plan => (
                <div key={plan.value} className="plan-dropdown-item" onClick={() => handlePlanSelect(plan)}>
                  {plan.label}
                </div>
              ))}
              {isPermitPM() && (
                <div className="plan-dropdown-item" onClick={() => handlePlanSelect("createNew")}>
                  Create new plan...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="task-board">
        {Object.entries(tasks).map(([state, tasks]) => (
          <div key={state} className="task-column">
            <h2 className="column-title">{state}</h2>
            {tasks.length > 0 ? (
              tasks.map(task => (
                <div key={task.task_id} className="task-card" style={{ borderLeft: `5px solid #${task.plan_colour}` }}>
                  <strong>{task.task_name}</strong>
                  <p className="task-description">{task.task_description ? task.task_description : "-No description-"}</p>
                  <span>&lt;Task Owner: {task.task_owner}&gt;</span>
                  <span className="view-link" onClick={() => handleViewTaskClick(task)}>
                    View
                  </span>
                </div>
              ))
            ) : (
              <p>No tasks in this state.</p>
            )}
          </div>
        ))}
      </div>
      {isCreateModalOpen && (
        <div className="modal-overlay">
          <div className="modal-create-task">
            <h2 className="modal-title">Create Task</h2>
            <div className="modal-form">
              <div className="modal-row">
                <label className="modal-label">Task Name:</label>
                <input type="text" className="modal-input" value={newTask.task_name} onChange={e => setNewTask({ ...newTask, task_name: e.target.value })} />
              </div>
              <div className="modal-row">
                <label className="modal-label">Task Description:</label>
                <textarea className="modal-textarea" value={newTask.task_description} onChange={e => setNewTask({ ...newTask, task_description: e.target.value })} maxLength="255" />
              </div>
              <div className="modal-row">
                <label className="modal-label">Plan:</label>
                <div className="modal-select">
                  <Select options={[{ value: "", label: "None" }, ...plans]} onChange={option => setNewTask({ ...newTask, task_plan: option.value })} />
                </div>
              </div>
              <div className="modal-row">
                <label className="modal-label">Task Notes:</label>
                <textarea className="modal-textarea" value={newTask.task_notes} onChange={e => setNewTask({ ...newTask, task_notes: e.target.value })} maxLength="65280" />
              </div>
            </div>
            <div className="modal-buttons">
              <button className="modal-button create-button" onClick={handleCreateTask}>
                Create
              </button>
              <button
                className="modal-button cancel-button"
                onClick={() => {
                  setNewTask({
                    task_name: "",
                    task_description: "",
                    task_plan: "",
                    task_notes: ""
                  });
                  setIsCreateModalOpen(false);
                  fetchOwnGroup();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {isViewModalOpen && selectedTask && (
        <div className="modal-overlay">
          <div className="view-task-modal">
            <h2 className="view-task-modal-title">Task Details</h2>
            <div className="view-task-modal-content">
              <div className="view-task-left-content">
                <div className="view-task-modal-row">
                  <label className="view-task-modal-label">ID:</label>
                  <span>{selectedTask.task_id}</span>
                </div>
                <div className="view-task-modal-row">
                  <label className="view-task-modal-label">Name:</label>
                  <span>{selectedTask.task_name}</span>
                </div>
                <div className="view-task-modal-row">
                  <label className="view-task-modal-label">Description:</label>
                  <div className="view-task-description-content">{selectedTask.task_description}</div>
                </div>
                <div className="view-task-modal-row">
                  <label className="view-task-modal-label">State:</label>
                  <span>{selectedTask.task_state}</span>
                </div>
                <div className="view-task-modal-row">
                  <label className="view-task-modal-label">Plan:</label>
                  <div className="view-task-modal-select">
                    <Select options={[{ value: "", label: "None" }, ...plans]} value={selectedTask.task_plan ? { value: selectedTask.task_plan, label: selectedTask.task_plan } : { value: "", label: "None" }} onChange={option => setSelectedTask({ ...selectedTask, task_plan: option.value })} isDisabled={["ToDo", "Doing", "Close"].includes(selectedTask.task_state) || !canInteract} />
                  </div>
                </div>
                <div className="view-task-modal-row">
                  <label className="view-task-modal-label">Creator:</label>
                  <span>{selectedTask.task_creator}</span>
                </div>
                <div className="view-task-modal-row">
                  <label className="view-task-modal-label">Owner:</label>
                  <span>{selectedTask.task_owner}</span>
                </div>
                <div className="view-task-modal-row">
                  <label className="view-task-modal-label">Created Date:</label>
                  <span>{selectedTask.task_createDate}</span>
                </div>
              </div>
              <div className="view-task-right-content">
                <h3 className="view-task-notes-title">Notes:</h3>
                <div className="view-task-notes-display">{formatTaskNotes(selectedTask.task_notes)}</div>
                <textarea className="view-task-notes-textarea" value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Enter notes here..." readOnly={!canInteract} />
              </div>
            </div>
            <div className="view-task-modal-buttons">
              <button className="view-task-modal-button promote-button" onClick={handlePromoteTask} disabled={!canInteract || isPromoteDisabled}>
                {getPromoteButtonLabel()}
              </button>
              <button className="view-task-modal-button demote-button" onClick={handleDemoteTask} disabled={!canInteract || isDemoteDisabled}>
                {getDemoteButtonLabel()}
              </button>
              <button className="view-task-modal-button-save-button" onClick={handleSaveChanges} disabled={!canInteract || isSaveDisabled}>
                Save changes
              </button>
              <button
                className="view-task-modal-button close-button"
                onClick={() => {
                  setIsViewModalOpen(false);
                  fetchOwnGroup();
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {isCreatePlanModalOpen && (
        <div className="modal-overlay">
          <div className="create-plan-modal">
            <h2 className="create-plan-modal-title">Create Plan</h2>
            <div className="create-plan-modal-content">
              <div className="create-plan-modal-row">
                <label className="create-plan-modal-label">Name:</label>
                <input type="text" className="create-plan-modal-input" value={newPlan.plan_mvpName} onChange={e => setNewPlan({ ...newPlan, plan_mvpName: e.target.value })} />
              </div>
              <div className="create-plan-modal-row">
                <label className="create-plan-modal-label">Start Date:</label>
                <DatePicker selected={newPlan.plan_startDate} onChange={date => setNewPlan({ ...newPlan, plan_startDate: date })} dateFormat="dd-MM-yyyy" className="create-plan-modal-input" />
              </div>
              <div className="create-plan-modal-row">
                <label className="create-plan-modal-label">End Date:</label>
                <DatePicker selected={newPlan.plan_endDate} onChange={date => setNewPlan({ ...newPlan, plan_endDate: date })} dateFormat="dd-MM-yyyy" className="create-plan-modal-input" />
              </div>
              <div className="create-plan-modal-row">
                <label className="create-plan-modal-label">Colour:</label>
                <div>
                  <div className="color-swatch" onClick={() => setDisplayColorPicker(!displayColorPicker)}>
                    <div className="color-preview" style={{ backgroundColor: newPlan.plan_colour }} />
                  </div>
                  {displayColorPicker && (
                    <div className="popover">
                      <div className="cover" onClick={() => setDisplayColorPicker(false)} />
                      <ChromePicker color={newPlan.plan_colour} onChange={color => setNewPlan({ ...newPlan, plan_colour: color.hex })} disableAlpha />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="create-plan-modal-buttons">
              <button className="modal-button save-button" onClick={handleCreatePlan}>
                Create
              </button>
              <button
                className="modal-button cancel-button"
                onClick={() => {
                  setNewPlan({
                    plan_mvpName: "",
                    plan_startDate: "",
                    plan_endDate: "",
                    plan_colour: "#000000"
                  });
                  setIsCreatePlanModalOpen(false);
                  fetchOwnGroup();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {isEditPlanModalOpen && selectedPlan && (
        <div className="modal-overlay">
          <div className="edit-plan-modal">
            <h2 className="edit-plan-modal-title">Edit Plan</h2>
            <div className="edit-plan-modal-content">
              <div className="edit-plan-modal-row">
                <label className="edit-plan-modal-label">Name:</label>
                <input type="text" className="edit-plan-modal-input" value={selectedPlan.label} disabled />
              </div>
              <div className="edit-plan-modal-row">
                <label className="edit-plan-modal-label">Start Date:</label>
                <DatePicker selected={selectedPlan.plan_startDate} onChange={date => isPermitPM() && setSelectedPlan({ ...selectedPlan, plan_startDate: date })} dateFormat="dd-MM-yyyy" className="edit-plan-modal-input" disabled={!isPermitPM()} />
              </div>
              <div className="edit-plan-modal-row">
                <label className="edit-plan-modal-label">End Date:</label>
                <DatePicker selected={selectedPlan.plan_endDate} onChange={date => isPermitPM() && setSelectedPlan({ ...selectedPlan, plan_endDate: date })} dateFormat="dd-MM-yyyy" className="edit-plan-modal-input" disabled={!isPermitPM()} />
              </div>
              <div className="edit-plan-modal-row">
                <label className="edit-plan-modal-label">Colour:</label>
                <div>
                  <div className="color-swatch" onClick={() => isPermitPM() && setDisplayEditColorPicker(!displayEditColorPicker)}>
                    <div className="color-preview" style={{ backgroundColor: selectedPlan.plan_colour }} />
                  </div>
                  {displayEditColorPicker && (
                    <div className="popover">
                      <div className="cover" onClick={() => setDisplayEditColorPicker(false)} />
                      <ChromePicker color={selectedPlan.plan_colour} onChange={color => isPermitPM() && setSelectedPlan({ ...selectedPlan, plan_colour: color.hex })} disableAlpha />
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="edit-plan-modal-buttons">
              {isPermitPM() && (
                <button className="modal-button save-button" onClick={handleEditPlan}>
                  Save
                </button>
              )}
              <button
                className="modal-button cancel-button"
                onClick={() => {
                  setSelectedPlan(null);
                  setIsEditPlanModalOpen(false);
                  fetchOwnGroup();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <ToastContainer position="bottom-right" autoClose={2000} hideProgressBar={true} newestOnTop={false} closeOnClick rtl={false} />
    </div>
  );
}

export default TaskList;
