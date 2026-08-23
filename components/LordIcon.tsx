"use client"
import React from 'react';

type LordIconTrigger =
    | 'hover'
    | 'click'
    | 'loop'
    | 'loop-on-hover'
    | 'morph'
    | 'boomerang';

interface LordIconProps {
    src: string;
    trigger?: LordIconTrigger;
    delay?: number;
    size?: number;
    colors?: string;
    className?: string;
}

export const LordIcon: React.FC<LordIconProps> = ({
    src,
    trigger = 'hover',
    delay,
    size = 40,
    colors = 'primary:#13ec37,secondary:#13ec37',
    className
}) => {
    return (
        <lord-icon
            src={src}
            trigger={trigger}
            delay={delay}
            colors={colors}
            style={{ width: size, height: size }}
            className={className}
        ></lord-icon>
    );
};

// Global type declaration for the custom element
declare global {
    namespace JSX {
        interface IntrinsicElements {
            'lord-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
                src?: string;
                trigger?: string;
                delay?: string | number;
                colors?: string;
                state?: string;
            };
        }
    }
}
