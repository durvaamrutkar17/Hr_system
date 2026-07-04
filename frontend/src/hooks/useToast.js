import { useState, useEffect } from 'react';

const useToast = (duration = 3000) => {
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), duration);
    return () => clearTimeout(timer);
  }, [message, duration]);

  const showToast = (type, text) => setMessage({ type, text });

  return { message, showToast };
};

export default useToast;
