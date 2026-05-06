"use client";

import React from 'react';
import { cn } from "@/lib/utils";

interface InstitutionalLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'white' | 'compact';
}

export function InstitutionalLogo({ className, size = 'md', variant = 'default' }: InstitutionalLogoProps) {
  const titleSizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl",
    xl: "text-6xl",
  };
  const subtitleSizes = {
    sm: "text-[8px]",
    md: "text-[9px]",
    lg: "text-xs",
    xl: "text-sm",
  };
  const dotSizes = {
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3 w-3",
    xl: "h-4 w-4",
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {/* Hexagon logo mark */}
      <div className={cn(
        "relative flex items-center justify-center shrink-0",
        size === 'sm' ? "h-8 w-8" : size === 'md' ? "h-10 w-10" : size === 'lg' ? "h-14 w-14" : "h-18 w-18"
      )}>
        <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
          <polygon
            points="20,2 36,11 36,29 20,38 4,29 4,11"
            fill="none"
            stroke="#00D47A"
            strokeWidth="1.5"
          />
          <polygon
            points="20,8 31,14.5 31,27.5 20,34 9,27.5 9,14.5"
            fill="rgba(0,212,122,0.08)"
            stroke="rgba(0,212,122,0.3)"
            strokeWidth="0.5"
          />
          <text
            x="20" y="24"
            textAnchor="middle"
            fill="#00D47A"
            fontSize="10"
            fontWeight="900"
            fontFamily="Inter, sans-serif"
            letterSpacing="-0.5"
          >CT</text>
        </svg>
      </div>

      <div className="flex flex-col justify-center">
        <div className="flex items-center gap-1.5">
          <span className={cn(
            "font-black leading-none tracking-tight",
            titleSizes[size],
            "text-white"
          )}>
            CETIEM
          </span>
          <div className={cn("rounded-full bg-[#00D47A]", dotSizes[size])} />
        </div>
        <p className={cn(
          "font-semibold uppercase tracking-[0.2em] mt-0.5",
          subtitleSizes[size],
          "text-white/40"
        )}>
          Agile Audit Hub
        </p>
      </div>
    </div>
  );
}
