"use client";

import { useEffect, useRef } from "react";

interface SkillBarProps {
  name: string;
  level: number;
}

export default function SkillBar({ name, level }: SkillBarProps) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && barRef.current) {
          barRef.current.style.width = `${level}%`;
        }
      },
      { threshold: 0.3 }
    );
    if (barRef.current) observer.observe(barRef.current);
    return () => observer.disconnect();
  }, [level]);

  return (
    <div className="group">
      <div className="flex justify-between mb-1.5 text-sm">
        <span className="font-mono text-fg">{name}</span>
        <span className="text-muted font-mono text-xs">{level}%</span>
      </div>
      <div className="h-2 rounded-full bg-line overflow-hidden">
        <div
          ref={barRef}
          className="h-full rounded-full bg-gradient-to-r from-accent-dim to-accent transition-all duration-1000 ease-out"
          style={{ width: "0%" }}
        />
      </div>
    </div>
  );
}