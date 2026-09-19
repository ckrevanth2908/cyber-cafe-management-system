import React, { useState, useEffect } from 'react';
import { differenceInSeconds } from 'date-fns';

const SessionTimer = ({ endTime }) => {
  const [timeLeft, setTimeLeft] = useState('');
  const [isWarning, setIsWarning] = useState(false);

  useEffect(() => {
    if (!endTime) return;

    const end = new Date(endTime);

    const updateTimer = () => {
      const now = new Date();
      const diffInSeconds = differenceInSeconds(end, now);

      if (diffInSeconds <= 0) {
        setTimeLeft('00:00');
        setIsWarning(true);
        return;
      }

      const minutes = Math.floor(diffInSeconds / 60);
      const seconds = diffInSeconds % 60;
      
      setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      setIsWarning(diffInSeconds < 300); // Less than 5 minutes
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [endTime]);

  if (!endTime) return <span>--:--</span>;

  return (
    <span className={`font-mono font-medium ${isWarning ? 'text-red-600 font-bold' : ''}`}>
      {timeLeft}
    </span>
  );
};

export default SessionTimer;
