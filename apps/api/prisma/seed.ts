/**
 * Prisma Seed Script
 *
 * Seeds the database with initial data:
 * - Default expense categories
 *
 * Run with: pnpm --filter api prisma db seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Default expense categories for IKPA
const defaultCategories = [
  {
    id: 'food-dining',
    name: 'Food & Dining',
    icon: 'utensils',
    color: '#F59E0B',
    isDefault: true,
    sortOrder: 1,
  },
  {
    id: 'transportation',
    name: 'Transportation',
    icon: 'car',
    color: '#3B82F6',
    isDefault: true,
    sortOrder: 2,
  },
  {
    id: 'shopping',
    name: 'Shopping',
    icon: 'shopping-bag',
    color: '#EC4899',
    isDefault: true,
    sortOrder: 3,
  },
  {
    id: 'utilities',
    name: 'Utilities',
    icon: 'zap',
    color: '#8B5CF6',
    isDefault: true,
    sortOrder: 4,
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    icon: 'film',
    color: '#10B981',
    isDefault: true,
    sortOrder: 5,
  },
  {
    id: 'healthcare',
    name: 'Healthcare',
    icon: 'heart-pulse',
    color: '#EF4444',
    isDefault: true,
    sortOrder: 6,
  },
  {
    id: 'family-support',
    name: 'Family Support',
    icon: 'users',
    color: '#F97316',
    isDefault: true,
    sortOrder: 7,
  },
  {
    id: 'education',
    name: 'Education',
    icon: 'graduation-cap',
    color: '#06B6D4',
    isDefault: true,
    sortOrder: 8,
  },
  {
    id: 'housing',
    name: 'Housing',
    icon: 'home',
    color: '#84CC16',
    isDefault: true,
    sortOrder: 9,
  },
  {
    id: 'other',
    name: 'Other',
    icon: 'more-horizontal',
    color: '#6B7280',
    isDefault: true,
    sortOrder: 10,
  },
];

async function main() {
  console.log('Seeding database...');

  // Seed expense categories using upsert for idempotency
  for (const category of defaultCategories) {
    await prisma.expenseCategory.upsert({
      where: { id: category.id },
      update: {
        name: category.name,
        icon: category.icon,
        color: category.color,
        isDefault: category.isDefault,
        sortOrder: category.sortOrder,
      },
      create: category,
    });
  }

  console.log(`Seeded ${defaultCategories.length} expense categories`);
  console.log('Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
