"use client";

import React from 'react';
import { cn } from "@/lib/utils";

interface InstitutionalLogoProps {
    className?: string;
    variant?: 'white' | 'gold' | 'guinda';
    size?: 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * InstitutionalLogo - Cumplimiento Guía Identidad Gráfica 2024-2030 (v3)
 * Utiliza el activo oficial verificado del CDN gob.mx
 */
export function InstitutionalLogo({ className, variant = 'guinda', size = 'md' }: InstitutionalLogoProps) {
    const isWhite = variant === 'white';

    const sizeClasses = {
        sm: "gap-3",
        md: "gap-4",
        lg: "gap-6",
        xl: "gap-8"
    };

    const escudoSizes = {
        sm: "h-8 w-8",
        md: "h-12 w-12",
        lg: "h-16 w-16",
        xl: "h-20 w-20"
    };

    const titleSizes = {
        sm: "text-xl",
        md: "text-3xl",
        lg: "text-5xl",
        xl: "text-7xl"
    };

    const subtitleSizes = {
        sm: "text-[8px]",
        md: "text-[10px]",
        lg: "text-xs",
        xl: "text-sm"
    };

    // Filtro para color Dorado Institucional #BC955C basado en SVG blanco
    const goldFilter = "invert(61%) sepia(35%) saturate(301%) hue-rotate(357deg) brightness(101%) contrast(89%)";
    // Filtro para color Guinda Institucional #9D2449
    const guindaFilter = "invert(13%) sepia(45%) saturate(4155%) hue-rotate(325deg) brightness(95%) contrast(101%)";

    return (
        <div className={cn("flex items-center", sizeClasses[size], className)}>
            {/* Escudo Nacional - Usamos logo_blanco como base resiliente */}
            <img
                src="https://framework-gb.cdn.gob.mx/gobmx/img/logo_blanco.svg"
                alt="Escudo Nacional de México"
                className={cn("object-contain", escudoSizes[size])}
                style={{
                    filter: isWhite ? 'none' : (variant === 'gold' ? goldFilter : guindaFilter)
                }}
            />

            <div className="flex flex-col justify-center border-l border-gray-300 pl-4 h-full py-1">
                <h1 className={cn(
                    "font-heading font-black leading-none tracking-tight",
                    titleSizes[size],
                    isWhite ? "text-white" : "text-[#611232]"
                )}>
                    Economía
                </h1>
                <p className={cn(
                    "font-sans font-bold uppercase tracking-[0.2em] mt-1",
                    subtitleSizes[size],
                    isWhite ? "text-white/80" : "text-[#545454]"
                )}>
                    Secretaría de Economía
                </p>
            </div>
        </div>
    );
}
