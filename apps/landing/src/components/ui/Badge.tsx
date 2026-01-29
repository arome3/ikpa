interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, className = '' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center px-4 py-1.5 rounded-full
        text-sm font-medium
        bg-accent/20 text-accent border border-accent/30
        ${className}
      `}
    >
      {children}
    </span>
  );
}
