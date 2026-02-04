interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-3 py-1 rounded-full
        text-xs font-medium
        bg-neutral-100 text-neutral-700
        ${className}
      `}
    >
      {children}
    </span>
  );
}
