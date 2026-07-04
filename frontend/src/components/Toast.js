import React from 'react';
import './Toast.css';

const Toast = ({ message }) => {
  if (!message) return null;
  return <div className={`inline-message ${message.type}`}>{message.text}</div>;
};

export default Toast;
