import React from 'react';
import { cn } from '@/lib/utils';
import { motion, HTMLMotionProps } from 'motion/react';

interface ButtonProps extends HTMLMotionProps<"button"> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    const variants = {
      primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 border-none font-bold',
      secondary: 'bg-slate-900 hover:bg-slate-800 text-white shadow-xl border-none font-bold',
      outline: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm font-bold',
      ghost: 'bg-transparent hover:text-indigo-600 text-slate-700 border border-transparent font-semibold',
    };

    const sizes = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-6 py-2 text-sm',
      lg: 'px-8 py-4 text-md rounded-xl', // Using rounded-xl from the design
    };

    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          'inline-flex items-center justify-center rounded-full transition-colors',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);
Button.displayName = 'Button';

export function Badge({ children, className, variant = 'default' }: { children: React.ReactNode, className?: string, variant?: 'default' | 'success' | 'warning' | 'critical' | 'ai' }) {
  const variants = {
    default: 'bg-slate-100 text-slate-700 border-slate-200',
    success: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    warning: 'bg-amber-50 text-amber-600 border-amber-100',
    critical: 'bg-red-50 text-red-600 border-red-100',
    ai: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  };

  return (
    <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 uppercase tracking-widest', variants[variant], className)}>
      {children}
    </span>
  );
}
