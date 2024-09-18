import React, { useState } from 'react';
import Dropdown from './Dropdown';
import './Navbar.css';
import profileIcon from '../assets/profile_icon.png';

function Navbar({ username, isAdmin, title }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="navbar">
            <h1>{title}</h1>
            <div className="profile-section" onMouseOver={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)}>
                {username} <img src={profileIcon} alt="Profile Icon" />
                {isOpen && <Dropdown isAdmin={isAdmin} />}
            </div>
        </div>
    );
}

export default Navbar;
