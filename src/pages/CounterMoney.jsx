import { useState, useEffect } from 'react';

const CounterMoney = ({ value, prefix = "RM " }) => {
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
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}
  </span>
);
};

// THIS IS THE MISSING LINE:
export default CounterMoney;