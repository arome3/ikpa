/**
 * Annualized Framing Calculator Tests
 *
 * Tests cost framing and currency formatting logic.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AnnualizedFramingCalculator } from '../calculators/annualized-framing.calculator';
import { Currency } from '@prisma/client';

describe('AnnualizedFramingCalculator', () => {
  let calculator: AnnualizedFramingCalculator;

  beforeEach(() => {
    calculator = new AnnualizedFramingCalculator();
  });

  describe('generate', () => {
    it('should generate framing for NGN currency', () => {
      const result = calculator.generate({
        monthlyCost: 5000,
        currency: Currency.NGN,
        subscriptionName: 'Netflix',
      });

      expect(result.monthly).toBe('₦5,000/month');
      expect(result.annual).toBe('₦60,000/year');
      expect(result.impact).toContain('Netflix');
      expect(result.impact).toContain('₦60,000');
    });

    it('should generate framing for USD currency', () => {
      const result = calculator.generate({
        monthlyCost: 15.99,
        currency: Currency.USD,
        subscriptionName: 'Spotify',
      });

      expect(result.monthly).toBe('$16/month');
      expect(result.annual).toBe('$192/year');
    });

    it('should generate framing for GHS currency', () => {
      const result = calculator.generate({
        monthlyCost: 100,
        currency: Currency.GHS,
        subscriptionName: 'DStv',
      });

      expect(result.monthly).toBe('GH₵100/month');
      expect(result.annual).toBe('GH₵1,200/year');
    });

    it('should generate framing for KES currency', () => {
      const result = calculator.generate({
        monthlyCost: 1000,
        currency: Currency.KES,
        subscriptionName: 'Showmax',
      });

      expect(result.monthly).toBe('KSh1,000/month');
      expect(result.annual).toBe('KSh12,000/year');
    });

    it('should generate framing for ZAR currency', () => {
      const result = calculator.generate({
        monthlyCost: 250,
        currency: Currency.ZAR,
        subscriptionName: 'Gym',
      });

      expect(result.monthly).toContain('R');
      expect(result.monthly).toContain('250');
      expect(result.annual).toContain('R');
      expect(result.annual).toContain('3');
    });

    it('should generate framing for EGP currency', () => {
      const result = calculator.generate({
        monthlyCost: 500,
        currency: Currency.EGP,
        subscriptionName: 'VPN',
      });

      // EGP uses Arabic numerals in ar-EG locale
      expect(result.monthly).toContain('E£');
      expect(result.monthly).toContain('/month');
      expect(result.annual).toContain('E£');
      expect(result.annual).toContain('/year');
    });

    it('should include context string', () => {
      const result = calculator.generate({
        monthlyCost: 50000,
        currency: Currency.NGN,
        subscriptionName: 'Premium Service',
      });

      expect(result.context).toBeTruthy();
      expect(typeof result.context).toBe('string');
    });

    it('should format large numbers with commas', () => {
      const result = calculator.generate({
        monthlyCost: 100000,
        currency: Currency.NGN,
        subscriptionName: 'Expensive Service',
      });

      expect(result.monthly).toBe('₦100,000/month');
      expect(result.annual).toBe('₦1,200,000/year');
    });

    it('should round decimal amounts', () => {
      const result = calculator.generate({
        monthlyCost: 5999.99,
        currency: Currency.NGN,
        subscriptionName: 'Service',
      });

      expect(result.monthly).toBe('₦6,000/month');
    });
  });

  describe('formatCurrency', () => {
    it('should format NGN with Naira symbol', () => {
      const result = calculator.formatCurrency(10000, Currency.NGN);
      expect(result).toBe('₦10,000');
    });

    it('should format USD with dollar sign', () => {
      const result = calculator.formatCurrency(99.99, Currency.USD);
      expect(result).toBe('$100');
    });

    it('should format GHS with Cedi symbol', () => {
      const result = calculator.formatCurrency(500, Currency.GHS);
      expect(result).toBe('GH₵500');
    });

    it('should format KES with shilling prefix', () => {
      const result = calculator.formatCurrency(2500, Currency.KES);
      expect(result).toBe('KSh2,500');
    });

    it('should format ZAR with Rand symbol', () => {
      const result = calculator.formatCurrency(1500, Currency.ZAR);
      // ZAR locale uses space separator, not comma
      expect(result).toContain('R');
      expect(result).toMatch(/1.?500/); // Accepts 1,500 or 1 500
    });

    it('should format EGP with pound symbol', () => {
      const result = calculator.formatCurrency(3000, Currency.EGP);
      // EGP uses Arabic numerals in ar-EG locale
      expect(result).toContain('E£');
    });

    it('should default to dollar sign for unknown currency', () => {
      const result = calculator.formatCurrency(100, 'XYZ' as Currency);
      expect(result).toBe('$100');
    });
  });

  describe('generateContext', () => {
    it('should generate context for high NGN amounts', () => {
      const result = calculator.generate({
        monthlyCost: 50000,
        currency: Currency.NGN,
        subscriptionName: 'Test',
      });

      // High annual cost should mention rent or something significant
      expect(result.context.length).toBeGreaterThan(0);
    });

    it('should generate context for medium NGN amounts', () => {
      const result = calculator.generate({
        monthlyCost: 20000,
        currency: Currency.NGN,
        subscriptionName: 'Test',
      });

      expect(result.context.length).toBeGreaterThan(0);
    });

    it('should generate context for low NGN amounts', () => {
      const result = calculator.generate({
        monthlyCost: 5000,
        currency: Currency.NGN,
        subscriptionName: 'Test',
      });

      expect(result.context.length).toBeGreaterThan(0);
    });
  });

  describe('calculateAnnualCost', () => {
    it('should multiply monthly cost by 12', () => {
      const result = calculator.generate({
        monthlyCost: 1000,
        currency: Currency.NGN,
        subscriptionName: 'Test',
      });

      expect(result.annual).toContain('12,000');
    });
  });

  describe('impact message', () => {
    it('should include subscription name in impact', () => {
      const result = calculator.generate({
        monthlyCost: 5000,
        currency: Currency.NGN,
        subscriptionName: 'Netflix',
      });

      expect(result.impact).toContain('Netflix');
    });

    it('should include annual savings in impact', () => {
      const result = calculator.generate({
        monthlyCost: 5000,
        currency: Currency.NGN,
        subscriptionName: 'Netflix',
      });

      expect(result.impact).toContain('60,000');
    });

    it('should mention saving or cancelling', () => {
      const result = calculator.generate({
        monthlyCost: 5000,
        currency: Currency.NGN,
        subscriptionName: 'Netflix',
      });

      expect(result.impact.toLowerCase()).toMatch(/cancel|save/);
    });
  });
});
