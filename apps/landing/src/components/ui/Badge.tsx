import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  className?: string;
}

export function Badge({ children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-4 py-1.5 rounded-full',
        'text-sm font-medium',
        'bg-sage-100 text-sage-700 border border-sage-200',
        className
      )}
    >
      {children}
    </span>
  );
}
