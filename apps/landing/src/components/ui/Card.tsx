import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover = false }: CardProps) {
  return (
    <div
      className={cn(
        'bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-sage-100',
        hover && 'transition-all duration-300 hover:shadow-lg hover:border-sage-200 hover:-translate-y-1',
        className
      )}
    >
      {children}
    </div>
  );
}

interface CardIconProps {
  children: React.ReactNode;
  className?: string;
}

export function CardIcon({ children, className }: CardIconProps) {
  return (
    <div
      className={cn(
        'w-12 h-12 rounded-xl bg-sage-100 text-sage-600',
        'flex items-center justify-center mb-4',
        className
      )}
    >
      {children}
    </div>
  );
}
