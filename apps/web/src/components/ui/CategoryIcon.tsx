import {
  Tv,
  Utensils,
  Car,
  ShoppingBag,
  Zap,
  Film,
  HeartPulse,
  Users,
  GraduationCap,
  Home,
  MoreHorizontal,
  Receipt,
  Gamepad2,
  Heart,
  Briefcase,
  Plane,
  Gift,
  Wifi,
  type LucideIcon,
} from 'lucide-react';

/**
 * Maps kebab-case Lucide icon names (as stored in DB) to their React components.
 */
const iconMap: Record<string, LucideIcon> = {
  tv: Tv,
  utensils: Utensils,
  car: Car,
  'shopping-bag': ShoppingBag,
  zap: Zap,
  film: Film,
  'heart-pulse': HeartPulse,
  users: Users,
  'graduation-cap': GraduationCap,
  home: Home,
  'more-horizontal': MoreHorizontal,
  receipt: Receipt,
  gamepad2: Gamepad2,
  heart: Heart,
  briefcase: Briefcase,
  plane: Plane,
  gift: Gift,
  wifi: Wifi,
};

interface CategoryIconProps {
  name: string;
  className?: string;
  fallback?: LucideIcon;
}

export function CategoryIcon({ name, className, fallback: Fallback = Receipt }: CategoryIconProps) {
  const Icon = iconMap[name] ?? Fallback;
  return <Icon className={className} />;
}

/** Get the Lucide component for an icon name, with fallback */
export function getCategoryIcon(name: string): LucideIcon {
  return iconMap[name] ?? Receipt;
}
