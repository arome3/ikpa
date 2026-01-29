interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  centered?: boolean;
  light?: boolean;
}

export function SectionHeader({ title, subtitle, centered = true, light = false }: SectionHeaderProps) {
  return (
    <div className={`mb-12 md:mb-16 ${centered ? 'text-center' : ''}`}>
      <h2
        className={`
          text-3xl md:text-4xl lg:text-5xl font-bold mb-4
          ${light ? 'text-white' : 'text-primary-900'}
        `}
      >
        {title}
      </h2>
      {subtitle && (
        <p
          className={`
            text-lg md:text-xl max-w-3xl
            ${centered ? 'mx-auto' : ''}
            ${light ? 'text-primary-200' : 'text-primary-600'}
          `}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}
