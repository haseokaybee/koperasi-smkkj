import { useState, useEffect } from 'react';

// Added 'decimals' as a prop, defaulting to 2 if not provided
const CounterMoney = ({ value, prefix = "RM ", decimals = 2 }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp = null;
    const duration = 1200; 
    const startValue = displayValue; 
    const endValue = parseFloat(value) || 0;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const easeOutValue = 1 - Math.pow(1 - progress, 3);
      const currentNumber = startValue + (endValue - startValue) * easeOutValue;
      
      setDisplayValue(currentNumber);

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value]);

  return (
    <span className="animated-money">
      {prefix}
      {displayValue.toLocaleString('en-MY', { 
        // These now use the 'decimals' prop instead of being stuck at 2
        minimumFractionDigits: decimals, 
        maximumFractionDigits: decimals 
      })}
    </span>
  );
};

export default CounterMoney;