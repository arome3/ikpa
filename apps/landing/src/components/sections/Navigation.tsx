'use client';

import { useState, useEffect } from 'react';
import { Container, Button } from '@/components/ui';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#faq', label: 'FAQ' },
];

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled ? 'bg-cream/90 backdrop-blur-md shadow-sm' : 'bg-transparent'
      )}
    >
      <Container>
        <div className="flex items-center justify-between h-16 md:h-20">
          <a
            href="/"
            className={cn(
              'font-serif text-3xl font-bold transition-colors duration-300',
              scrolled ? 'text-forest' : 'text-white drop-shadow-md'
            )}
          >
            Ikpa
          </a>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-charcoal/70 hover:text-forest transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <a href="http://localhost:3000/signin">
              <Button size="sm" className="bg-[#064E3B] hover:bg-[#053D2E] shadow-lg shadow-[#064E3B]/20">Login</Button>
            </a>
          </div>

          <button
            className="md:hidden text-forest p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-sage-100 bg-cream/95 backdrop-blur-md">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-charcoal/70 hover:text-forest transition-colors py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-4 border-t border-sage-100">
                <a href="http://localhost:3000/signin">
                  <Button fullWidth className="bg-[#064E3B] hover:bg-[#053D2E] shadow-lg shadow-[#064E3B]/20">Login</Button>
                </a>
              </div>
            </div>
          </div>
        )}
      </Container>
    </nav>
  );
}
