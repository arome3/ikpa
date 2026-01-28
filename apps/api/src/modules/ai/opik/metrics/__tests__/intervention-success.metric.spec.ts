/**
 * InterventionSuccessMetric Unit Tests
 *
 * Tests cover:
 * - Score 1 when user saved
 * - Score 0 when user spent
 * - Score 0 when no action recorded
 * - Handles context in different locations (context.userAction vs userAction)
 * - Metadata in results
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InterventionSuccessMetric } from '../intervention-success.metric';
import { DatasetItem } from '../interfaces';

describe('InterventionSuccessMetric', () => {
  let metric: InterventionSuccessMetric;

  beforeEach(() => {
    metric = new InterventionSuccessMetric();
  });

  describe('metric metadata', () => {
    it('should have correct name', () => {
      expect(metric.name).toBe('InterventionSuccess');
    });

    it('should have correct description', () => {
      expect(metric.description).toBe(
        'Measures whether user saved instead of spent after intervention',
      );
    });
  });

  describe('score()', () => {
    it('should return score 1 when user saved (context.userAction)', async () => {
      const datasetItem: DatasetItem = {
        input: 'I want to buy a new phone',
        output: '',
        context: { userAction: 'saved' },
      };

      const result = await metric.score(datasetItem, 'Consider waiting 48 hours.');

      expect(result.score).toBe(1);
      expect(result.reason).toBe('User chose to save instead of spend');
      expect(result.metadata?.action).toBe('saved');
      expect(result.metadata?.interventionSuccessful).toBe(true);
    });

    it('should return score 1 when user saved (top-level userAction)', async () => {
      const datasetItem: DatasetItem = {
        input: 'I want to buy a new phone',
        output: '',
        userAction: 'saved',
      };

      const result = await metric.score(datasetItem, 'Consider waiting 48 hours.');

      expect(result.score).toBe(1);
      expect(result.reason).toBe('User chose to save instead of spend');
    });

    it('should return score 0 when user spent (context.userAction)', async () => {
      const datasetItem: DatasetItem = {
        input: 'I want to buy a new phone',
        output: '',
        context: { userAction: 'spent' },
      };

      const result = await metric.score(datasetItem, 'Consider waiting 48 hours.');

      expect(result.score).toBe(0);
      expect(result.reason).toBe('User proceeded with spending');
      expect(result.metadata?.action).toBe('spent');
      expect(result.metadata?.interventionSuccessful).toBe(false);
    });

    it('should return score 0 when user spent (top-level userAction)', async () => {
      const datasetItem: DatasetItem = {
        input: 'I want to buy a new phone',
        output: '',
        userAction: 'spent',
      };

      const result = await metric.score(datasetItem, 'Consider waiting 48 hours.');

      expect(result.score).toBe(0);
      expect(result.reason).toBe('User proceeded with spending');
    });

    it('should return score 0 when no action recorded', async () => {
      const datasetItem: DatasetItem = {
        input: 'I want to buy a new phone',
        output: '',
      };

      const result = await metric.score(datasetItem, 'Consider waiting 48 hours.');

      expect(result.score).toBe(0);
      expect(result.reason).toBe('No user action recorded');
      expect(result.metadata?.hasAction).toBe(false);
    });

    it('should return score 0 when context is empty', async () => {
      const datasetItem: DatasetItem = {
        input: 'I want to buy a new phone',
        output: '',
        context: {},
      };

      const result = await metric.score(datasetItem, 'Consider waiting 48 hours.');

      expect(result.score).toBe(0);
      expect(result.reason).toBe('No user action recorded');
    });

    it('should prefer context.userAction over top-level userAction', async () => {
      const datasetItem: DatasetItem = {
        input: 'I want to buy a new phone',
        output: '',
        userAction: 'spent', // top-level says spent
        context: { userAction: 'saved' }, // context says saved - this should win
      };

      const result = await metric.score(datasetItem, 'Consider waiting 48 hours.');

      expect(result.score).toBe(1);
      expect(result.reason).toBe('User chose to save instead of spend');
    });
  });
});
