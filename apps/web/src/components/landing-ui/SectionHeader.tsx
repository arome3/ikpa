interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
  light?: boolean;
  eyebrow?: string;
}

export function SectionHeader({
  title,
  subtitle,
  centered = true,
  light = false,
  eyebrow,
}: SectionHeaderProps) {
  return (
    <div className={`mb-16 ${centered ? 'text-center' : ''}`}>
      {eyebrow && (
        <p
          className={`
            text-sm font-medium tracking-wide uppercase mb-4
            ${light ? 'text-neutral-400' : 'text-neutral-500'}
          `}
        >
          {eyebrow}
        </p>
      )}

      <h2
        className={`
          text-3xl md:text-4xl lg:text-5xl font-display font-bold tracking-tight mb-4
          ${light ? 'text-white' : 'text-neutral-950'}
        `}
      >
        {title}
      </h2>

      {subtitle && (
        <p
          className={`
            text-lg max-w-2xl leading-relaxed
            ${centered ? 'mx-auto' : ''}
            ${light ? 'text-neutral-300' : 'text-neutral-600'}
          `}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
