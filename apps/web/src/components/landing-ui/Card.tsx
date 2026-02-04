interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg';
}

export function Card({
  children,
  className = '',
  hover = false,
  padding = 'md',
}: CardProps) {
  const paddingStyles = {
    sm: 'p-5',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={`
        bg-white rounded-xl border border-neutral-200
        ${paddingStyles[padding]}
        ${hover ? 'transition-all duration-300 hover:shadow-md hover:border-neutral-300' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface CardIconProps {
  children: React.ReactNode;
  className?: string;
}

export function CardIcon({ children, className = '' }: CardIconProps) {
  return (
    <div
      className={`
        w-10 h-10 rounded-lg bg-neutral-100 text-neutral-700
        flex items-center justify-center mb-4
        ${className}
      `}
    >
      {children}
    </div>
  );
}

interface FeaturedCardProps {
  children: React.ReactNode;
  className?: string;
}

export function FeaturedCard({ children, className = '' }: FeaturedCardProps) {
  return (
    <div
      className={`
        bg-neutral-50 rounded-2xl border border-neutral-200 p-8 md:p-10
        ${className}
      `}
    >
      {children}
    </div>
  );
}
