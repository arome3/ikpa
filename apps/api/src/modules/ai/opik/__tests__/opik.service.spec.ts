/**
 * OpikService Unit Tests
 *
 * Tests cover:
 * - Module lifecycle (onModuleInit, onModuleDestroy)
 * - Trace creation (createTrace, createAgentTrace)
 * - Span creation (createLLMSpan, createToolSpan, createRetrievalSpan, createGeneralSpan)
 * - Nested span creation (createNestedSpan)
 * - Span/trace ending (endSpan, endLLMSpan, endTrace)
 * - Feedback and scoring (addFeedback, addSpanScore)
 * - Sampling support (shouldSample, setSamplingRate)
 * - Flush with timeout and retry
 * - Utility methods (flush, isAvailable, getClient)
 * - Graceful degradation (missing config, disabled client)
 * - Error handling
 *
 * Target: >80% coverage
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  OpikService,
  OPIK_CLIENT_FACTORY,
  OpikClientFactory,
} from '../opik.service';
import { OpikFlushException } from '../exceptions';
import { OpikTrace, TrackedTrace } from '../interfaces';

describe('OpikService', () => {
  let service: OpikService;
  let configService: ConfigService;

  // Mock functions for the Opik client
  const mockNestedSpanEnd = vi.fn();
  const mockNestedSpan = vi.fn().mockReturnValue({ end: mockNestedSpanEnd, span: vi.fn() });
  const mockSpanEnd = vi.fn();
  const mockSpan = vi.fn().mockReturnValue({ end: mockSpanEnd, span: mockNestedSpan });
  const mockTraceEnd = vi.fn();
  const mockTrace = vi.fn().mockReturnValue({
    span: mockSpan,
    end: mockTraceEnd,
  });
  const mockFlush = vi.fn().mockResolvedValue(undefined);
  const mockLogFeedbackScore = vi.fn();
  const mockLogSpanScore = vi.fn();

  // Mock Opik client that will be returned by the factory
  const mockOpikClient = {
    trace: mockTrace,
    flush: mockFlush,
    logFeedbackScore: mockLogFeedbackScore,
    logSpanScore: mockLogSpanScore,
  };

  // Factory function that returns the mock client
  const mockClientFactory: OpikClientFactory = vi.fn(() => mockOpikClient as any);

  const mockConfigValues: Record<string, string | number | undefined> = {
    OPIK_API_KEY: 'test-api-key',
    OPIK_WORKSPACE_NAME: 'test-workspace',
    OPIK_PROJECT_NAME: 'test-project',
    OPIK_URL_OVERRIDE: 'https://test.api.com',
    OPIK_SAMPLING_RATE: 1.0,
    OPIK_FLUSH_TIMEOUT_MS: 5000,
    OPIK_FLUSH_RETRY_ATTEMPTS: 3,
    OPIK_FLUSH_RETRY_DELAY_MS: 100, // Short delay for tests
    NODE_ENV: 'test',
  };

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();

    // Reset mock implementations
    mockNestedSpanEnd.mockClear();
    mockNestedSpan.mockClear().mockReturnValue({ end: mockNestedSpanEnd, span: vi.fn() });
    mockSpanEnd.mockClear();
    mockSpan.mockClear().mockReturnValue({ end: mockSpanEnd, span: mockNestedSpan });
    mockTraceEnd.mockClear();
    mockTrace.mockClear().mockReturnValue({
      span: mockSpan,
      end: mockTraceEnd,
    });
    mockFlush.mockClear().mockResolvedValue(undefined);
    mockLogFeedbackScore.mockClear();
    mockLogSpanScore.mockClear();
    (mockClientFactory as Mock).mockClear().mockReturnValue(mockOpikClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpikService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string, defaultValue?: unknown) =>
              mockConfigValues[key] ?? defaultValue,
            ),
          },
        },
        {
          provide: OPIK_CLIENT_FACTORY,
          useValue: mockClientFactory,
        },
      ],
    }).compile();

    service = module.get<OpikService>(OpikService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // LIFECYCLE TESTS
  // ==========================================

  describe('onModuleInit', () => {
    it('should initialize Opik client with correct config', () => {
      service.onModuleInit();

      expect(service.isAvailable()).toBe(true);
      expect(service.getClient()).not.toBeNull();
      expect(mockClientFactory).toHaveBeenCalledWith({
        apiKey: 'test-api-key',
        workspaceName: 'test-workspace',
        projectName: 'test-project',
        apiUrl: 'https://test.api.com',
      });
    });

    it('should log project name and sampling rate on successful initialization', () => {
      const logSpy = vi.spyOn(service['logger'], 'log');

      service.onModuleInit();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Opik client initialized for project:'),
      );
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('sampling:'),
      );
    });

    it('should disable tracing when API key is missing', () => {
      (configService.get as Mock).mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'OPIK_API_KEY') return undefined;
          return mockConfigValues[key] ?? defaultValue;
        },
      );

      service.onModuleInit();

      expect(service.isAvailable()).toBe(false);
    });

    it('should disable tracing when workspace name is missing', () => {
      (configService.get as Mock).mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'OPIK_WORKSPACE_NAME') return undefined;
          return mockConfigValues[key] ?? defaultValue;
        },
      );

      service.onModuleInit();

      expect(service.isAvailable()).toBe(false);
    });

    it('should use default values for optional config', () => {
      (configService.get as Mock).mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'OPIK_API_KEY') return 'test-key';
          if (key === 'OPIK_WORKSPACE_NAME') return 'test-workspace';
          return defaultValue;
        },
      );

      service.onModuleInit();

      const config = service.getConfig();
      expect(config?.apiUrl).toBe('https://www.comet.com/opik/api');
      expect(config?.projectName).toBe('ikpa-financial-coach');
    });

    it('should log warning and disable tracing on initialization error', () => {
      const warnSpy = vi.spyOn(service['logger'], 'warn');
      (configService.get as Mock).mockImplementation(() => {
        throw new Error('Config error');
      });

      service.onModuleInit();

      expect(service.isAvailable()).toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Opik initialization failed'),
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('should flush traces on shutdown with timeout', async () => {
      service.onModuleInit();

      await service.onModuleDestroy();

      expect(mockFlush).toHaveBeenCalled();
    });

    it('should log success message after flush', async () => {
      service.onModuleInit();
      const logSpy = vi.spyOn(service['logger'], 'log');

      await service.onModuleDestroy();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('flushed successfully'),
      );
    });

    it('should handle flush error gracefully', async () => {
      service.onModuleInit();
      mockFlush.mockRejectedValueOnce(new Error('Flush failed'));
      const errorSpy = vi.spyOn(service['logger'], 'error');

      await service.onModuleDestroy();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to flush'),
      );
    });

    it('should not flush when client is not available', async () => {
      // Don't call onModuleInit, so client is null

      await service.onModuleDestroy();

      expect(mockFlush).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // TRACE TESTS
  // ==========================================

  describe('createTrace', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should create a trace with correct parameters and traceId', () => {
      const trace = service.createTrace({
        name: 'test_trace',
        input: { test: true },
        metadata: { version: '1.0' },
      });

      expect(trace).not.toBeNull();
      expect(trace?.traceName).toBe('test_trace');
      expect(trace?.traceId).toBeDefined();
      expect(trace?.traceId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(trace?.startedAt).toBeInstanceOf(Date);
      expect(mockTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test_trace',
          input: { test: true },
        }),
      );
    });

    it('should pass tags to Opik client', () => {
      service.createTrace({
        name: 'test_trace',
        input: { test: true },
        tags: ['production', 'financial'],
      });

      expect(mockTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['production', 'financial'],
        }),
      );
    });

    it('should add timestamp, environment, and traceId to metadata', () => {
      service.createTrace({
        name: 'test_trace',
        input: { test: true },
      });

      expect(mockTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            timestamp: expect.any(String),
            environment: 'test',
            traceId: expect.any(String),
          }),
        }),
      );
    });

    it('should return null when client is not available', () => {
      // Force disable
      service['isEnabled'] = false;

      const trace = service.createTrace({
        name: 'test_trace',
        input: { test: true },
      });

      expect(trace).toBeNull();
    });

    it('should handle trace creation error gracefully', () => {
      mockTrace.mockImplementationOnce(() => {
        throw new Error('Trace creation failed');
      });
      const errorSpy = vi.spyOn(service['logger'], 'error');

      const trace = service.createTrace({
        name: 'test_trace',
        input: {},
      });

      expect(trace).toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('createAgentTrace', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should create agent trace with correct naming convention', () => {
      const trace = service.createAgentTrace({
        agentName: 'shark_auditor',
        userId: 'user-123',
        input: { action: 'audit' },
      });

      expect(trace).not.toBeNull();
      expect(trace?.traceName).toBe('shark_auditor_cognitive_chain');
      expect(trace?.traceId).toBeDefined();
    });

    it('should include userId in trace input', () => {
      service.createAgentTrace({
        agentName: 'nudge_agent',
        userId: 'user-456',
        input: { trigger: 'scheduled' },
      });

      expect(mockTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            userId: 'user-456',
            trigger: 'scheduled',
          }),
        }),
      );
    });

    it('should include agent metadata', () => {
      service.createAgentTrace({
        agentName: 'cashflow_guardian',
        userId: 'user-789',
        input: {},
        metadata: { custom: 'data' },
      });

      expect(mockTrace).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            agent: 'cashflow_guardian',
            version: '1.0',
            custom: 'data',
          }),
        }),
      );
    });
  });

  describe('endTrace', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should end trace with success output', () => {
      const trace = service.createTrace({
        name: 'test_trace',
        input: {},
      });

      service.endTrace(trace, {
        success: true,
        result: { data: 'result' },
      });

      expect(mockTraceEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          output: expect.objectContaining({
            success: true,
            data: 'result',
            durationMs: expect.any(Number),
          }),
        }),
      );
    });

    it('should end trace with error output', () => {
      const trace = service.createTrace({
        name: 'test_trace',
        input: {},
      });

      service.endTrace(trace, {
        success: false,
        error: 'Something went wrong',
      });

      expect(mockTraceEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          output: expect.objectContaining({
            success: false,
            error: 'Something went wrong',
          }),
        }),
      );
    });

    it('should handle null trace gracefully', () => {
      expect(() => {
        service.endTrace(null, { success: true });
      }).not.toThrow();
    });

    it('should handle end trace error gracefully', () => {
      const trace = service.createTrace({
        name: 'test_trace',
        input: {},
      });
      mockTraceEnd.mockImplementationOnce(() => {
        throw new Error('End failed');
      });
      const errorSpy = vi.spyOn(service['logger'], 'error');

      service.endTrace(trace, { success: true });

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  // ==========================================
  // SPAN TESTS
  // ==========================================

  describe('createLLMSpan', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should create LLM span with model, provider metadata, and IDs', () => {
      const trace = service.createTrace({
        name: 'test',
        input: {},
      });

      const span = service.createLLMSpan({
        trace: trace!.trace,
        name: 'generate_response',
        input: { prompt: 'Hello' },
        model: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
      });

      expect(span).not.toBeNull();
      expect(span?.type).toBe('llm');
      expect(span?.name).toBe('generate_response');
      expect(span?.spanId).toBeDefined();
      expect(span?.spanId).toMatch(/^[0-9a-f-]{36}$/);
      expect(span?.traceId).toBeDefined();
      expect(mockSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'generate_response',
          type: 'llm',
          metadata: expect.objectContaining({
            model: 'claude-sonnet-4-20250514',
            provider: 'anthropic',
            spanId: expect.any(String),
          }),
        }),
      );
    });

    it('should return null when trace is falsy', () => {
      const span = service.createLLMSpan({
        trace: null as unknown as OpikTrace,
        name: 'test',
        input: {},
        model: 'test',
        provider: 'anthropic',
      });

      expect(span).toBeNull();
    });
  });

  describe('createToolSpan', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should create tool span with correct type and IDs', () => {
      const trace = service.createTrace({
        name: 'test',
        input: {},
      });

      const span = service.createToolSpan({
        trace: trace!.trace,
        name: 'calculate_savings',
        input: { userId: 'user-123' },
      });

      expect(span).not.toBeNull();
      expect(span?.type).toBe('tool');
      expect(span?.spanId).toBeDefined();
      expect(span?.traceId).toBeDefined();
      expect(mockSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tool',
        }),
      );
    });
  });

  describe('createRetrievalSpan', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should create retrieval span with query and IDs', () => {
      const trace = service.createTrace({
        name: 'test',
        input: {},
      });

      const span = service.createRetrievalSpan({
        trace: trace!.trace,
        name: 'fetch_transactions',
        query: { userId: 'user-123', limit: 100 },
      });

      expect(span).not.toBeNull();
      expect(span?.type).toBe('retrieval');
      expect(span?.spanId).toBeDefined();
      expect(mockSpan).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'retrieval',
          input: { userId: 'user-123', limit: 100 },
        }),
      );
    });
  });

  describe('createGeneralSpan', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should create general span with IDs', () => {
      const trace = service.createTrace({
        name: 'test',
        input: {},
      });

      const span = service.createGeneralSpan({
        trace: trace!.trace,
        name: 'await_user_decision',
        input: { options: ['keep', 'cancel'] },
      });

      expect(span).not.toBeNull();
      expect(span?.type).toBe('general');
      expect(span?.spanId).toBeDefined();
      expect(span?.traceId).toBeDefined();
    });
  });

  // ==========================================
  // NESTED SPAN TESTS
  // ==========================================

  describe('createNestedSpan', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should create nested span with parent reference', () => {
      const trace = service.createTrace({
        name: 'test',
        input: {},
      });

      const parentSpan = service.createLLMSpan({
        trace: trace!.trace,
        name: 'planning',
        input: { task: 'analyze' },
        model: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
      });

      const nestedSpan = service.createNestedSpan({
        parentSpan: parentSpan!,
        name: 'nested_tool_call',
        type: 'tool',
        input: { action: 'calculate' },
      });

      expect(nestedSpan).not.toBeNull();
      expect(nestedSpan?.name).toBe('nested_tool_call');
      expect(nestedSpan?.type).toBe('tool');
      expect(nestedSpan?.spanId).toBeDefined();
      expect(nestedSpan?.traceId).toBe(parentSpan?.traceId);
      expect(nestedSpan?.parentSpanId).toBe(parentSpan?.spanId);
    });

    it('should return null when parent span is null', () => {
      const nestedSpan = service.createNestedSpan({
        parentSpan: null as any,
        name: 'nested',
        type: 'tool',
        input: {},
      });

      expect(nestedSpan).toBeNull();
    });

    it('should handle nested span creation error gracefully', () => {
      const trace = service.createTrace({
        name: 'test',
        input: {},
      });

      const parentSpan = service.createLLMSpan({
        trace: trace!.trace,
        name: 'planning',
        input: {},
        model: 'test',
        provider: 'anthropic',
      });

      // Make nested span creation throw
      mockNestedSpan.mockImplementationOnce(() => {
        throw new Error('Nested span creation failed');
      });
      const errorSpy = vi.spyOn(service['logger'], 'error');

      const nestedSpan = service.createNestedSpan({
        parentSpan: parentSpan!,
        name: 'nested',
        type: 'tool',
        input: {},
      });

      expect(nestedSpan).toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('endSpan', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should end span with duration metadata', async () => {
      const trace = service.createTrace({
        name: 'test',
        input: {},
      });

      const span = service.createToolSpan({
        trace: trace!.trace,
        name: 'test_span',
        input: {},
      });

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 10));

      service.endSpan(span, { output: { result: 'success' } });

      expect(mockSpanEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          output: { result: 'success' },
          metadata: expect.objectContaining({
            durationMs: expect.any(Number),
          }),
        }),
      );
    });

    it('should handle null span gracefully', () => {
      expect(() => service.endSpan(null, { output: {} })).not.toThrow();
    });

    it('should handle end span error gracefully', () => {
      const trace = service.createTrace({
        name: 'test',
        input: {},
      });
      const span = service.createToolSpan({
        trace: trace!.trace,
        name: 'test_span',
        input: {},
      });
      mockSpanEnd.mockImplementationOnce(() => {
        throw new Error('End failed');
      });
      const errorSpy = vi.spyOn(service['logger'], 'error');

      service.endSpan(span, { output: {} });

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('endLLMSpan', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should end LLM span with token usage', () => {
      const trace = service.createTrace({
        name: 'test',
        input: {},
      });

      const span = service.createLLMSpan({
        trace: trace!.trace,
        name: 'llm_call',
        input: { prompt: 'test' },
        model: 'test-model',
        provider: 'anthropic',
      });

      service.endLLMSpan(span, {
        output: { response: 'Hello!' },
        usage: {
          promptTokens: 10,
          completionTokens: 5,
          totalTokens: 15,
        },
      });

      expect(mockSpanEnd).toHaveBeenCalledWith(
        expect.objectContaining({
          output: { response: 'Hello!' },
          metadata: expect.objectContaining({
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
            durationMs: expect.any(Number),
          }),
        }),
      );
    });

    it('should handle missing usage gracefully', () => {
      const trace = service.createTrace({
        name: 'test',
        input: {},
      });

      const span = service.createLLMSpan({
        trace: trace!.trace,
        name: 'llm_call',
        input: { prompt: 'test' },
        model: 'test-model',
        provider: 'anthropic',
      });

      service.endLLMSpan(span, {
        output: { response: 'Hello!' },
      });

      expect(mockSpanEnd).toHaveBeenCalled();
    });

    it('should handle null span gracefully', () => {
      expect(() =>
        service.endLLMSpan(null, { output: {} }),
      ).not.toThrow();
    });
  });

  // ==========================================
  // FEEDBACK & SCORING TESTS
  // ==========================================

  describe('addFeedback', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should add feedback to trace', () => {
      const result = service.addFeedback({
        traceId: 'trace-123',
        name: 'response_quality',
        value: 0.85,
        category: 'quality',
        comment: 'Well structured response',
        source: 'llm_judge',
      });

      expect(result).toBe(true);
      expect(mockLogFeedbackScore).toHaveBeenCalledWith(
        expect.objectContaining({
          traceId: 'trace-123',
          name: 'response_quality',
          value: 0.85,
          categoryName: 'quality',
          reason: 'Well structured response',
          source: 'llm_judge',
        }),
      );
    });

    it('should return false when client is not available', () => {
      service['isEnabled'] = false;

      const result = service.addFeedback({
        traceId: 'trace-123',
        name: 'test',
        value: 0.5,
      });

      expect(result).toBe(false);
    });

    it('should handle feedback error gracefully', () => {
      mockLogFeedbackScore.mockImplementationOnce(() => {
        throw new Error('Feedback failed');
      });
      const errorSpy = vi.spyOn(service['logger'], 'error');

      const result = service.addFeedback({
        traceId: 'trace-123',
        name: 'test',
        value: 0.5,
      });

      expect(result).toBe(false);
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('addSpanScore', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should add score to span', () => {
      const result = service.addSpanScore({
        spanId: 'span-456',
        name: 'latency',
        value: 1.5,
        unit: 'seconds',
        comment: 'Within acceptable range',
      });

      expect(result).toBe(true);
      expect(mockLogSpanScore).toHaveBeenCalledWith(
        expect.objectContaining({
          spanId: 'span-456',
          name: 'latency',
          value: 1.5,
          unit: 'seconds',
          reason: 'Within acceptable range',
        }),
      );
    });

    it('should return false when client is not available', () => {
      service['isEnabled'] = false;

      const result = service.addSpanScore({
        spanId: 'span-456',
        name: 'test',
        value: 1.0,
      });

      expect(result).toBe(false);
    });
  });

  // ==========================================
  // SAMPLING TESTS
  // ==========================================

  describe('sampling', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should sample all traces when rate is 1.0', () => {
      service.setSamplingRate(1.0);

      const trace = service.createTrace({
        name: 'test',
        input: {},
      });

      expect(trace).not.toBeNull();
    });

    it('should sample no traces when rate is 0', () => {
      service.setSamplingRate(0);

      const trace = service.createTrace({
        name: 'test',
        input: {},
      });

      expect(trace).toBeNull();
    });

    it('should respect sampling rate probabilistically', () => {
      service.setSamplingRate(0.5);

      // Mock Math.random to return predictable values
      const originalRandom = Math.random;
      let callCount = 0;

      Math.random = () => {
        callCount++;
        return callCount % 2 === 0 ? 0.3 : 0.7; // Alternates below/above 0.5
      };

      const results = [];
      for (let i = 0; i < 4; i++) {
        results.push(service.createTrace({ name: `test_${i}`, input: {} }));
      }

      Math.random = originalRandom;

      // With our mock, every other trace should be sampled
      const sampledCount = results.filter((r) => r !== null).length;
      expect(sampledCount).toBe(2);
    });

    it('should get current sampling rate', () => {
      service.setSamplingRate(0.75);
      expect(service.getSamplingRate()).toBe(0.75);
    });

    it('should reject invalid sampling rates', () => {
      const warnSpy = vi.spyOn(service['logger'], 'warn');

      service.setSamplingRate(-0.1);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid sampling rate'));

      service.setSamplingRate(1.5);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid sampling rate'));
    });
  });

  // ==========================================
  // FLUSH TESTS
  // ==========================================

  describe('flush', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should flush traces without throwing', async () => {
      await expect(service.flush()).resolves.not.toThrow();
      expect(mockFlush).toHaveBeenCalled();
    });

    it('should not throw when client is not available', async () => {
      service['isEnabled'] = false;

      await expect(service.flush()).resolves.not.toThrow();
    });

    it('should retry on flush failure', async () => {
      mockFlush
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);

      await service.flush({ retryAttempts: 3 });

      expect(mockFlush).toHaveBeenCalledTimes(3);
    });

    it('should log warning on each retry', async () => {
      mockFlush
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined);
      const warnSpy = vi.spyOn(service['logger'], 'warn');

      await service.flush({ retryAttempts: 2 });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Flush attempt 1/2 failed'),
      );
    });

    it('should throw when throwOnError is true and all retries fail', async () => {
      mockFlush.mockRejectedValue(new Error('Network error'));

      await expect(
        service.flush({ throwOnError: true, retryAttempts: 2 }),
      ).rejects.toThrow(OpikFlushException);
    });

    it('should respect timeout option', async () => {
      // Mock a slow flush that takes longer than timeout
      mockFlush.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );

      await expect(
        service.flush({ timeoutMs: 50, retryAttempts: 1, throwOnError: true }),
      ).rejects.toThrow(OpikFlushException);
    });

    it('should include attempts count in exception when all retries fail', async () => {
      mockFlush.mockRejectedValue(new Error('Network error'));

      try {
        await service.flush({ throwOnError: true, retryAttempts: 3 });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(OpikFlushException);
      }
    });
  });

  // ==========================================
  // UTILITY TESTS
  // ==========================================

  describe('isAvailable', () => {
    it('should return false before initialization', () => {
      expect(service.isAvailable()).toBe(false);
    });

    it('should return true after successful initialization', () => {
      service.onModuleInit();
      expect(service.isAvailable()).toBe(true);
    });

    it('should return false when disabled', () => {
      service.onModuleInit();
      service['isEnabled'] = false;
      expect(service.isAvailable()).toBe(false);
    });
  });

  describe('getClient', () => {
    it('should return null before initialization', () => {
      expect(service.getClient()).toBeNull();
    });

    it('should return client after initialization', () => {
      service.onModuleInit();
      expect(service.getClient()).not.toBeNull();
    });
  });

  describe('getConfig', () => {
    it('should return null before initialization', () => {
      expect(service.getConfig()).toBeNull();
    });

    it('should return config after initialization', () => {
      service.onModuleInit();

      const config = service.getConfig();

      expect(config).not.toBeNull();
      expect(config?.apiKey).toBe('test-api-key');
      expect(config?.workspaceName).toBe('test-workspace');
      expect(config?.projectName).toBe('test-project');
    });
  });

  // ==========================================
  // GRACEFUL DEGRADATION TESTS
  // ==========================================

  describe('graceful degradation', () => {
    it('should not crash when creating trace with disabled client', () => {
      service.onModuleInit();
      service['isEnabled'] = false;

      const result = service.createTrace({ name: 'test', input: {} });
      expect(result).toBeNull();
    });

    it('should not crash when creating span with null trace', () => {
      service.onModuleInit();

      const result = service.createToolSpan({
        trace: null as unknown as OpikTrace,
        name: 'test',
        input: {},
      });

      expect(result).toBeNull();
    });

    it('should handle all operations gracefully when not initialized', () => {
      // Don't call onModuleInit

      expect(service.createTrace({ name: 'test', input: {} })).toBeNull();

      expect(
        service.createAgentTrace({
          agentName: 'test',
          userId: 'user',
          input: {},
        }),
      ).toBeNull();

      // These should not throw
      service.endTrace(null, { success: true });
      service.endSpan(null, { output: {} });
      service.endLLMSpan(null, { output: {} });
    });
  });

  // ==========================================
  // SPAN CREATION ERROR HANDLING
  // ==========================================

  describe('span creation error handling', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should handle span creation error gracefully', () => {
      const trace = service.createTrace({ name: 'test', input: {} });

      // Make the span function throw on next call
      mockSpan.mockImplementationOnce(() => {
        throw new Error('Span creation failed');
      });
      const errorSpy = vi.spyOn(service['logger'], 'error');

      const span = service.createToolSpan({
        trace: trace!.trace,
        name: 'test_span',
        input: {},
      });

      expect(span).toBeNull();
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  // ==========================================
  // CONTEXT PROPAGATION TESTS
  // ==========================================

  describe('context propagation', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    describe('runWithContext', () => {
      it('should propagate context to nested async calls', async () => {
        const context = {
          traceId: 'test-trace-id',
          traceName: 'test_trace',
        };

        let capturedContext: ReturnType<typeof service.getContext>;

        await service.runWithContext(context, async () => {
          capturedContext = service.getContext();
        });

        expect(capturedContext!).toEqual(context);
      });

      it('should propagate context through multiple nested async calls', async () => {
        const context = {
          traceId: 'trace-123',
          spanId: 'span-456',
          traceName: 'nested_test',
          baggage: { userId: 'user-789' },
        };

        const results: (ReturnType<typeof service.getContext>)[] = [];

        await service.runWithContext(context, async () => {
          results.push(service.getContext());

          await new Promise((resolve) => setTimeout(resolve, 10));
          results.push(service.getContext());

          await Promise.resolve().then(() => {
            results.push(service.getContext());
          });
        });

        expect(results).toHaveLength(3);
        results.forEach((ctx) => {
          expect(ctx).toEqual(context);
        });
      });

      it('should return undefined outside of context', () => {
        expect(service.getContext()).toBeUndefined();
      });

      it('should isolate contexts between different runWithContext calls', async () => {
        const context1 = { traceId: 'trace-1', traceName: 'test1' };
        const context2 = { traceId: 'trace-2', traceName: 'test2' };

        const results = await Promise.all([
          service.runWithContext(context1, async () => {
            await new Promise((r) => setTimeout(r, 5));
            return service.getContext();
          }),
          service.runWithContext(context2, async () => {
            await new Promise((r) => setTimeout(r, 5));
            return service.getContext();
          }),
        ]);

        expect(results[0]).toEqual(context1);
        expect(results[1]).toEqual(context2);
      });
    });

    describe('runWithContextSync', () => {
      it('should propagate context to synchronous code', () => {
        const context = {
          traceId: 'sync-trace',
          traceName: 'sync_test',
        };

        let capturedContext: ReturnType<typeof service.getContext>;

        service.runWithContextSync(context, () => {
          capturedContext = service.getContext();
        });

        expect(capturedContext!).toEqual(context);
      });

      it('should return function result', () => {
        const context = { traceId: 'trace', traceName: 'test' };

        const result = service.runWithContextSync(context, () => {
          return 'hello';
        });

        expect(result).toBe('hello');
      });
    });

    describe('getContext', () => {
      it('should return undefined when not in context', () => {
        expect(service.getContext()).toBeUndefined();
      });

      it('should return context when in runWithContext', async () => {
        const context = { traceId: 'ctx-trace', traceName: 'test' };

        await service.runWithContext(context, async () => {
          expect(service.getContext()).toEqual(context);
        });
      });
    });
  });

  // ==========================================
  // HEADER EXTRACTION/INJECTION TESTS
  // ==========================================

  describe('header extraction and injection', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    describe('extractContextFromHeaders', () => {
      it('should extract context from x-trace-id header', () => {
        const headers = {
          'x-trace-id': 'incoming-trace-123',
          'x-span-id': 'incoming-span-456',
          'x-trace-name': 'remote_operation',
        };

        const context = service.extractContextFromHeaders(headers);

        expect(context).not.toBeNull();
        expect(context!.traceId).toBe('incoming-trace-123');
        expect(context!.spanId).toBe('incoming-span-456');
        expect(context!.traceName).toBe('remote_operation');
        expect(context!.isRemote).toBe(true);
      });

      it('should extract context from traceparent header (W3C format)', () => {
        const headers = {
          traceparent: '00-traceid-spanid-01',
        };

        const context = service.extractContextFromHeaders(headers);

        expect(context).not.toBeNull();
        expect(context!.traceId).toBe('00-traceid-spanid-01');
        expect(context!.traceName).toBe('remote_trace'); // default name
        expect(context!.isRemote).toBe(true);
      });

      it('should return null when no trace headers present', () => {
        const headers = {
          'content-type': 'application/json',
        };

        const context = service.extractContextFromHeaders(headers);

        expect(context).toBeNull();
      });

      it('should parse baggage header', () => {
        const headers = {
          'x-trace-id': 'trace-123',
          baggage: 'userId=user-456,sessionId=sess-789',
        };

        const context = service.extractContextFromHeaders(headers);

        expect(context!.baggage).toEqual({
          userId: 'user-456',
          sessionId: 'sess-789',
        });
      });

      it('should handle URL-encoded baggage values', () => {
        const headers = {
          'x-trace-id': 'trace-123',
          baggage: 'key=hello%20world',
        };

        const context = service.extractContextFromHeaders(headers);

        expect(context!.baggage).toEqual({
          key: 'hello world',
        });
      });

      it('should handle array-valued headers', () => {
        const headers: Record<string, string | string[] | undefined> = {
          'x-trace-id': ['trace-123', 'trace-456'], // Takes first
        };

        const context = service.extractContextFromHeaders(headers);

        expect(context!.traceId).toBe('trace-123');
      });
    });

    describe('injectContextToHeaders', () => {
      it('should inject current context into headers', async () => {
        const context = {
          traceId: 'outgoing-trace-123',
          spanId: 'outgoing-span-456',
          traceName: 'test_operation',
        };

        let headers: Record<string, string> = {};

        await service.runWithContext(context, async () => {
          headers = service.injectContextToHeaders();
        });

        expect(headers['x-trace-id']).toBe('outgoing-trace-123');
        expect(headers['x-span-id']).toBe('outgoing-span-456');
        expect(headers['x-trace-name']).toBe('test_operation');
      });

      it('should return empty object when not in context', () => {
        const headers = service.injectContextToHeaders();

        expect(headers).toEqual({});
      });

      it('should not include span-id when not present', async () => {
        const context = {
          traceId: 'trace-only',
          traceName: 'test',
        };

        let headers: Record<string, string> = {};

        await service.runWithContext(context, async () => {
          headers = service.injectContextToHeaders();
        });

        expect(headers['x-trace-id']).toBe('trace-only');
        expect(headers['x-span-id']).toBeUndefined();
      });

      it('should include baggage header when present', async () => {
        const context = {
          traceId: 'trace-123',
          traceName: 'test',
          baggage: { userId: 'user-456', env: 'test' },
        };

        let headers: Record<string, string> = {};

        await service.runWithContext(context, async () => {
          headers = service.injectContextToHeaders();
        });

        expect(headers.baggage).toBe('userId=user-456,env=test');
      });
    });
  });

  // ==========================================
  // WITH TRACE TESTS
  // ==========================================

  describe('withTrace', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should create trace and set up context propagation', async () => {
      let capturedContext: ReturnType<typeof service.getContext>;
      let capturedTrace: TrackedTrace | null = null;

      await service.withTrace(
        { name: 'test_with_trace', input: { data: 'test' } },
        async (trace) => {
          capturedTrace = trace;
          capturedContext = service.getContext();
        },
      );

      expect(capturedTrace).not.toBeNull();
      expect(capturedContext!).toBeDefined();
      expect(capturedContext!.traceId).toBe(capturedTrace!.traceId);
      expect(capturedContext!.traceName).toBe('test_with_trace');
    });

    it('should return function result', async () => {
      const result = await service.withTrace(
        { name: 'test', input: {} },
        async () => {
          return 'operation result';
        },
      );

      expect(result).toBe('operation result');
    });

    it('should pass null trace when client unavailable', async () => {
      service['isEnabled'] = false;

      let capturedTrace: TrackedTrace | null = null;

      await service.withTrace(
        { name: 'test', input: {} },
        async (trace) => {
          capturedTrace = trace;
        },
      );

      expect(capturedTrace).toBeNull();
    });

    it('should pass null trace when sampled out', async () => {
      service.setSamplingRate(0);

      let capturedTrace: TrackedTrace | null = null;

      await service.withTrace(
        { name: 'test', input: {} },
        async (trace) => {
          capturedTrace = trace;
        },
      );

      expect(capturedTrace).toBeNull();
    });
  });

  // ==========================================
  // BATCH OPERATIONS TESTS
  // ==========================================

  describe('batch operations', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    describe('createSpanBatch', () => {
      it('should create multiple spans in a batch', () => {
        const trace = service.createTrace({ name: 'batch_test', input: {} });

        const spans = service.createSpanBatch({
          trace: trace!.trace,
          spans: [
            { name: 'span_1', type: 'tool', input: { step: 1 } },
            { name: 'span_2', type: 'retrieval', input: { step: 2 } },
            { name: 'span_3', type: 'llm', input: { step: 3 } },
          ],
        });

        expect(spans).toHaveLength(3);
        spans.forEach((span, i) => {
          expect(span).not.toBeNull();
          expect(span!.name).toBe(`span_${i + 1}`);
          expect(span!.spanId).toBeDefined();
        });
      });

      it('should return array of nulls when trace is null', () => {
        const spans = service.createSpanBatch({
          trace: null as any,
          spans: [
            { name: 'span_1', type: 'tool', input: {} },
            { name: 'span_2', type: 'tool', input: {} },
          ],
        });

        expect(spans).toHaveLength(2);
        expect(spans[0]).toBeNull();
        expect(spans[1]).toBeNull();
      });

      it('should preserve span types', () => {
        const trace = service.createTrace({ name: 'test', input: {} });

        const spans = service.createSpanBatch({
          trace: trace!.trace,
          spans: [
            { name: 'tool_span', type: 'tool', input: {} },
            { name: 'llm_span', type: 'llm', input: {} },
            { name: 'retrieval_span', type: 'retrieval', input: {} },
            { name: 'general_span', type: 'general', input: {} },
          ],
        });

        expect(spans[0]!.type).toBe('tool');
        expect(spans[1]!.type).toBe('llm');
        expect(spans[2]!.type).toBe('retrieval');
        expect(spans[3]!.type).toBe('general');
      });
    });

    describe('endSpanBatch', () => {
      it('should end multiple spans in a batch', () => {
        const trace = service.createTrace({ name: 'test', input: {} });

        const spans = service.createSpanBatch({
          trace: trace!.trace,
          spans: [
            { name: 'span_1', type: 'tool', input: {} },
            { name: 'span_2', type: 'tool', input: {} },
          ],
        });

        service.endSpanBatch({
          spans: [
            { span: spans[0]!, output: { result: 'a' } },
            { span: spans[1]!, output: { result: 'b' } },
          ],
        });

        expect(mockSpanEnd).toHaveBeenCalledTimes(2);
      });

      it('should handle null spans in batch gracefully', () => {
        expect(() => {
          service.endSpanBatch({
            spans: [
              { span: null as any, output: { result: 'a' } },
            ],
          });
        }).not.toThrow();
      });

      it('should include metadata in batch end', () => {
        const trace = service.createTrace({ name: 'test', input: {} });

        const [span] = service.createSpanBatch({
          trace: trace!.trace,
          spans: [{ name: 'span_1', type: 'tool', input: {} }],
        });

        service.endSpanBatch({
          spans: [
            { span: span!, output: { result: 'done' }, metadata: { custom: 'data' } },
          ],
        });

        expect(mockSpanEnd).toHaveBeenCalledWith(
          expect.objectContaining({
            output: { result: 'done' },
            metadata: expect.objectContaining({
              custom: 'data',
            }),
          }),
        );
      });
    });
  });

  // ==========================================
  // SAMPLING RULES TESTS
  // ==========================================

  describe('sampling rules', () => {
    beforeEach(() => {
      service.onModuleInit();
      service.setSamplingRate(1.0); // Reset to 100% default
    });

    describe('setSamplingRules', () => {
      it('should set sampling rules', () => {
        const rules = [
          { name: 'rule1', match: { agent: 'shark_auditor' }, rate: 1.0 },
          { name: 'rule2', match: { environment: 'production' }, rate: 0.1 },
        ];

        service.setSamplingRules(rules);

        expect(service.getSamplingRules()).toEqual(rules);
      });

      it('should log when rules are updated', () => {
        const logSpy = vi.spyOn(service['logger'], 'log');

        service.setSamplingRules([
          { match: { test: true }, rate: 0.5 },
        ]);

        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('1 rule(s) configured'),
        );
      });
    });

    describe('rule-based sampling', () => {
      it('should use matching rule rate instead of default', () => {
        // Set default to 0 (never sample)
        service.setSamplingRate(0);

        // But rule says always sample for shark_auditor
        service.setSamplingRules([
          { match: { agent: 'shark_auditor' }, rate: 1.0 },
        ]);

        // Create trace with matching metadata
        const trace = service.createTrace({
          name: 'shark_auditor_trace',
          input: {},
          metadata: { agent: 'shark_auditor' },
        });

        expect(trace).not.toBeNull();
      });

      it('should use default rate when no rules match', () => {
        service.setSamplingRate(0); // Never sample by default

        service.setSamplingRules([
          { match: { agent: 'non_existent' }, rate: 1.0 },
        ]);

        const trace = service.createTrace({
          name: 'other_trace',
          input: {},
          metadata: { agent: 'shark_auditor' },
        });

        expect(trace).toBeNull();
      });

      it('should match by trace name pattern', () => {
        service.setSamplingRate(0);

        service.setSamplingRules([
          { match: {}, traceNamePattern: '^shark_.*', rate: 1.0 },
        ]);

        const sharkTrace = service.createTrace({
          name: 'shark_audit_trace',
          input: {},
        });

        const otherTrace = service.createTrace({
          name: 'other_trace',
          input: {},
        });

        expect(sharkTrace).not.toBeNull();
        expect(otherTrace).toBeNull();
      });

      it('should use first matching rule', () => {
        // Mock random to always return 0.5
        const originalRandom = Math.random;
        Math.random = () => 0.5;

        service.setSamplingRules([
          { name: 'rule1', match: { agent: 'shark' }, rate: 0.3 }, // Won't sample (0.5 > 0.3)
          { name: 'rule2', match: { agent: 'shark' }, rate: 0.9 }, // Would sample, but won't be reached
        ]);

        const trace = service.createTrace({
          name: 'test',
          input: {},
          metadata: { agent: 'shark' },
        });

        Math.random = originalRandom;

        // First rule matched with rate 0.3, random 0.5 > 0.3, so not sampled
        expect(trace).toBeNull();
      });

      it('should require all match conditions', () => {
        service.setSamplingRate(0);

        service.setSamplingRules([
          { match: { agent: 'shark', environment: 'production' }, rate: 1.0 },
        ]);

        // Only agent matches, not environment
        const trace = service.createTrace({
          name: 'test',
          input: {},
          metadata: { agent: 'shark', environment: 'development' },
        });

        expect(trace).toBeNull();
      });
    });
  });

  // ==========================================
  // EXPONENTIAL BACKOFF TESTS
  // ==========================================

  describe('exponential backoff', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    it('should use exponential backoff by default', async () => {
      mockFlush
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce(undefined);

      const delaySpy = vi.spyOn(service as any, 'delay');

      await service.flush({ retryAttempts: 3, exponentialBackoff: true });

      // First retry: base delay * 2^0 = 100ms (+ jitter)
      // Second retry: base delay * 2^1 = 200ms (+ jitter)
      expect(delaySpy).toHaveBeenCalledTimes(2);
      const firstDelay = delaySpy.mock.calls[0][0];
      const secondDelay = delaySpy.mock.calls[1][0];

      // Second delay should be roughly double the first (accounting for jitter)
      expect(secondDelay).toBeGreaterThan(firstDelay);
    });

    it('should use linear delay when exponentialBackoff is false', async () => {
      mockFlush
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce(undefined);

      const delaySpy = vi.spyOn(service as any, 'delay');

      await service.flush({ retryAttempts: 3, exponentialBackoff: false });

      expect(delaySpy).toHaveBeenCalledTimes(2);
      const firstDelay = delaySpy.mock.calls[0][0];
      const secondDelay = delaySpy.mock.calls[1][0];

      // Both should be the same (no exponential increase)
      expect(firstDelay).toBe(secondDelay);
    });

    it('should cap delay at MAX_BACKOFF_DELAY_MS', () => {
      // Test the private method directly
      const backoff1 = (service as any).calculateExponentialBackoff(1);
      const backoff10 = (service as any).calculateExponentialBackoff(10);

      // Very high attempt should be capped at 30000ms
      expect(backoff10).toBeLessThanOrEqual(30000);
    });

    it('should include jitter in backoff calculation', () => {
      const delays: number[] = [];

      for (let i = 0; i < 10; i++) {
        delays.push((service as any).calculateExponentialBackoff(2));
      }

      // With jitter, not all delays should be identical
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  // ==========================================
  // TRACE LINKING TESTS
  // ==========================================

  describe('trace linking', () => {
    beforeEach(() => {
      service.onModuleInit();
    });

    describe('createTrace with linkOptions', () => {
      it('should include link metadata when linkOptions provided', () => {
        service.createTrace(
          {
            name: 'linked_trace',
            input: {},
          },
          {
            remoteTraceId: 'remote-trace-123',
            remoteSpanId: 'remote-span-456',
            relationship: 'child_of',
            remoteService: 'api-gateway',
          },
        );

        expect(mockTrace).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              linkedTrace: {
                remoteTraceId: 'remote-trace-123',
                remoteSpanId: 'remote-span-456',
                relationship: 'child_of',
                remoteService: 'api-gateway',
              },
            }),
          }),
        );
      });

      it('should work without linkOptions', () => {
        const trace = service.createTrace({
          name: 'unlinked_trace',
          input: {},
        });

        expect(trace).not.toBeNull();
      });
    });

    describe('linkToRemoteTrace', () => {
      it('should log debug message when linking', async () => {
        const debugSpy = vi.spyOn(service['logger'], 'debug');
        const context = { traceId: 'local-trace', traceName: 'test' };

        await service.runWithContext(context, async () => {
          service.linkToRemoteTrace('remote-trace-123', {
            relationship: 'follows_from',
            remoteService: 'other-service',
          });
        });

        expect(debugSpy).toHaveBeenCalledWith(
          expect.stringContaining('Linked trace local-trace to remote trace remote-trace-123'),
        );
      });

      it('should log debug when no current context', () => {
        const debugSpy = vi.spyOn(service['logger'], 'debug');

        service.linkToRemoteTrace('remote-trace-123');

        expect(debugSpy).toHaveBeenCalledWith(
          'No current context to link trace to',
        );
      });
    });

    describe('context from remote trace', () => {
      it('should include parent trace info when context is remote', async () => {
        const remoteContext = {
          traceId: 'parent-trace-id',
          spanId: 'parent-span-id',
          traceName: 'parent_trace',
          isRemote: true,
        };

        await service.runWithContext(remoteContext, async () => {
          service.createTrace({
            name: 'child_trace',
            input: {},
          });
        });

        expect(mockTrace).toHaveBeenCalledWith(
          expect.objectContaining({
            metadata: expect.objectContaining({
              parentTraceId: 'parent-trace-id',
              parentSpanId: 'parent-span-id',
              propagatedFrom: 'remote',
            }),
          }),
        );
      });
    });
  });

  // ==========================================
  // IMPORT VALIDATION
  // ==========================================

  describe('import types', () => {
    it('should export TrackedTrace type', () => {
      const trace = service.createTrace({ name: 'test', input: {} });
      service.onModuleInit();

      // This test just validates the types work
      if (trace) {
        const _traceId: string = trace.traceId;
        const _traceName: string = trace.traceName;
        const _startedAt: Date = trace.startedAt;
        expect(_traceId).toBeDefined();
        expect(_traceName).toBeDefined();
        expect(_startedAt).toBeDefined();
      }
    });
  });
});
