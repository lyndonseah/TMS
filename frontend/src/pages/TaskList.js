import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useLocation } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { fetchUserDetails } from "../utils/fetchUserDetails";
import Navbar from "../components/Navbar";
import Select from "react-select";
import "./TaskList.css";

function TaskList() {
  const location = useLocation();
  const { appAcronym } = location.state || {};
  const [userDetails, setUserDetails] = useState({ username: "", isAuthorized: false });
  const [tasks, setTasks] = useState({ Open: [], ToDo: [], Doing: [], Done: [], Close: [] });
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ task_name: "", task_description: "", task_plan: "", task_notes: "" });
  const [plans, setPlans] = useState([]);

  const fetchTasksByState = useCallback(
    async state => {
      try {
        const response = await axios.post("http://localhost:3007/api/tasks", { task_state: state, task_appAcronym: appAcronym }, { withCredentials: true });
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

  useEffect(() => {
    const initializeUserProfile = async () => {
      try {
        const data = await fetchUserDetails();
        setUserDetails({ username: data.user.username, isAuthorized: data.isAuthorized });
        loadTasks();
      } catch (error) {
        console.log(error);
        toast.error("Error fetching user details.");
      }
    };

    initializeUserProfile();
  }, [loadTasks]);

  const handleCreateTaskClick = async () => {
    setIsCreateModalOpen(true);
    try {
      const response = await axios.post("http://localhost:3007/api/plans", { plan_appAcronym: appAcronym }, { withCredentials: true });
      setPlans(response.data.rows.map(plan => ({ label: plan.plan_mvpName, value: plan.plan_mvpName })));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleCreateTask = async () => {
    if (!newTask.task_name.trim()) {
      toast.error("Please fill in Task Name.");
      return;
    }

    try {
      const response = await axios.post("http://localhost:3007/api/tasks/create", { ...newTask, task_appAcronym: appAcronym, task_creator: userDetails.username, task_owner: userDetails.username }, { withCredentials: true });
      if (response.data.success) {
        toast.success(response.data.message);
        setNewTask({ task_name: "", task_description: "", task_plan: "", task_notes: "" });
        setIsCreateModalOpen(false);
        loadTasks();
      } else {
        toast.error(response.data.message);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div>
      <Navbar username={userDetails.username} isAuthorized={userDetails.isAuthorized} title="TASK LIST" />
      <div className="button-container">
        <button className="create-task-btn" onClick={handleCreateTaskClick}>
          Create Task
        </button>
      </div>
      <div className="task-board">
        {Object.entries(tasks).map(([state, tasks]) => (
          <div key={state} className="task-column">
            <h2 className="column-title">{state}</h2>
            {tasks.length > 0 ? (
              tasks.map(task => (
                <div key={task.task_id} className="task-card" style={{ borderLeft: `5px solid #${task.plan_colour}` }}>
                  <strong>{task.task_name}</strong>
                  <p className="task-description">{task.task_description}</p>
                  <span>&lt;Task Owner: {task.task_owner}&gt;</span>
                  <span className="view-link" onClick={() => {}}>
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
          <div className="modal">
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
                <textarea className="modal-textarea" value={newTask.task_notes} onChange={e => setNewTask({ ...newTask, task_notes: e.target.value })} maxLength="65535" />
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
