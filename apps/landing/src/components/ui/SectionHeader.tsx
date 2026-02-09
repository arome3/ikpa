import { cn } from '@/lib/utils';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
  light?: boolean;
}

export function SectionHeader({ title, subtitle, centered = true, light = false }: SectionHeaderProps) {
  return (
    <div className={cn('mb-12 md:mb-16', centered && 'text-center')}>
      <h2
        className={cn(
          'font-serif text-3xl md:text-4xl lg:text-5xl font-bold mb-4',
          light ? 'text-cream' : 'text-forest'
        )}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={cn(
            'text-lg md:text-xl max-w-3xl',
            centered && 'mx-auto',
            light ? 'text-sage-300' : 'text-charcoal/70'
          )}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
