"use client";
import { useEffect, useState } from "react";

export const SessionTimer = ({ active }: { active: boolean }) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return (
    <span className="tabular-nums">
      {mm}:{ss}
    </span>
  );
};
