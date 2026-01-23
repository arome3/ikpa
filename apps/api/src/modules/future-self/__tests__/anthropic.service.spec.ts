/**
 * Anthropic Service Tests
 *
 * Tests for the Claude API wrapper including:
 * - Service initialization
 * - Message generation
 * - Timeout handling
 * - Retry logic
 */

import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AnthropicService, AnthropicMessage } from '../services/anthropic.service';

// Mock the Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: {
        create: vi.fn(),
      },
    })),
  };
});

describe('AnthropicService', () => {
  let service: AnthropicService;
  let mockConfigService: {
    get: Mock;
  };

  const testMessages: AnthropicMessage[] = [{ role: 'user', content: 'Hello' }];

  beforeEach(async () => {
    mockConfigService = {
      get: vi.fn((key: string, defaultValue?: string) => {
        const config: Record<string, string | undefined> = {
          ANTHROPIC_API_KEY: 'test-api-key',
          ANTHROPIC_MODEL: 'claude-sonnet-4-20250514',
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnthropicService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AnthropicService>(AnthropicService);
    service.onModuleInit();
  });

  describe('onModuleInit', () => {
    it('should initialize when API key is configured', () => {
      expect(service.isAvailable()).toBe(true);
    });

    it('should not initialize when API key is missing', () => {
      const mockConfigNoKey = {
        get: vi.fn(() => undefined),
      };

      const module = Test.createTestingModule({
        providers: [
          AnthropicService,
          { provide: ConfigService, useValue: mockConfigNoKey },
        ],
      }).compile();

      module.then((m) => {
        const serviceNoKey = m.get<AnthropicService>(AnthropicService);
        serviceNoKey.onModuleInit();
        expect(serviceNoKey.isAvailable()).toBe(false);
      });
    });
  });

  describe('isAvailable', () => {
    it('should return true when initialized with valid API key', () => {
      expect(service.isAvailable()).toBe(true);
    });
  });

  describe('generateMessage', () => {
    it('should throw error when service is not available', async () => {
      const mockConfigNoKey = {
        get: vi.fn(() => undefined),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AnthropicService,
          { provide: ConfigService, useValue: mockConfigNoKey },
        ],
      }).compile();

      const serviceNoKey = module.get<AnthropicService>(AnthropicService);
      serviceNoKey.onModuleInit();

      await expect(serviceNoKey.generateMessage(testMessages, 1000)).rejects.toThrow(
        'Anthropic service is not available',
      );
    });

    it('should make API call with correct parameters', async () => {
      const anthropicClient = (service as any).client;
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
        },
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
      });
      anthropicClient.messages.create = mockCreate;

      const result = await service.generateMessage(testMessages, 1000);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      );

      expect(result).toEqual({
        content: 'Test response',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        model: 'claude-sonnet-4-20250514',
        stopReason: 'end_turn',
      });
    });

    it('should handle system prompt', async () => {
      const anthropicClient = (service as any).client;
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
        },
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
      });
      anthropicClient.messages.create = mockCreate;

      await service.generateMessage(testMessages, 1000, 'You are a helpful assistant');

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: 'You are a helpful assistant',
        }),
      );
    });
  });

  describe('retry logic', () => {
    it('should retry on rate limit (429) error', async () => {
      const anthropicClient = (service as any).client;

      let callCount = 0;
      anthropicClient.messages.create = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const error = new Error('Rate limited') as any;
          error.status = 429;
          throw error;
        }
        return Promise.resolve({
          content: [{ type: 'text', text: 'Success after retry' }],
          usage: { input_tokens: 100, output_tokens: 50 },
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
        });
      });

      const result = await service.generateMessage(testMessages, 1000);

      expect(callCount).toBe(2);
      expect(result.content).toBe('Success after retry');
    });

    it('should retry on 500 server error', async () => {
      const anthropicClient = (service as any).client;

      let callCount = 0;
      anthropicClient.messages.create = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          const error = new Error('Internal Server Error') as any;
          error.status = 500;
          throw error;
        }
        return Promise.resolve({
          content: [{ type: 'text', text: 'Success after retry' }],
          usage: { input_tokens: 100, output_tokens: 50 },
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
        });
      });

      const result = await service.generateMessage(testMessages, 1000);

      expect(callCount).toBe(2);
      expect(result.content).toBe('Success after retry');
    });

    it('should retry on timeout error', async () => {
      const anthropicClient = (service as any).client;

      let callCount = 0;
      anthropicClient.messages.create = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Request timed out after 90000ms');
        }
        return Promise.resolve({
          content: [{ type: 'text', text: 'Success after retry' }],
          usage: { input_tokens: 100, output_tokens: 50 },
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
        });
      });

      const result = await service.generateMessage(testMessages, 1000);

      expect(callCount).toBe(2);
      expect(result.content).toBe('Success after retry');
    });

    it('should not retry on 400 bad request', async () => {
      const anthropicClient = (service as any).client;

      anthropicClient.messages.create = vi.fn().mockImplementation(() => {
        const error = new Error('Bad Request') as any;
        error.status = 400;
        throw error;
      });

      await expect(service.generateMessage(testMessages, 1000)).rejects.toThrow('Bad Request');

      expect(anthropicClient.messages.create).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 401 unauthorized', async () => {
      const anthropicClient = (service as any).client;

      anthropicClient.messages.create = vi.fn().mockImplementation(() => {
        const error = new Error('Unauthorized') as any;
        error.status = 401;
        throw error;
      });

      await expect(service.generateMessage(testMessages, 1000)).rejects.toThrow('Unauthorized');

      expect(anthropicClient.messages.create).toHaveBeenCalledTimes(1);
    });

    it('should exhaust retries and throw', async () => {
      const anthropicClient = (service as any).client;

      let callCount = 0;
      anthropicClient.messages.create = vi.fn().mockImplementation(() => {
        callCount++;
        const error = new Error('Server Error') as any;
        error.status = 500;
        throw error;
      });

      await expect(service.generateMessage(testMessages, 1000)).rejects.toThrow('Server Error');

      expect(callCount).toBe(3); // Initial + 2 retries = 3 total (MAX_RETRIES)
    });
  });

  describe('circuit breaker', () => {
    it('should report circuit status', () => {
      const status = service.getCircuitStatus();

      expect(status).toEqual({
        state: 'closed',
        failureCount: 0,
      });
    });
  });

  describe('generate helper', () => {
    it('should convert single prompt to message array', async () => {
      const anthropicClient = (service as any).client;
      const mockCreate = vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Test response' }],
        usage: { input_tokens: 100, output_tokens: 50 },
        model: 'claude-sonnet-4-20250514',
        stop_reason: 'end_turn',
      });
      anthropicClient.messages.create = mockCreate;

      await service.generate('Hello', 1000);

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: 'Hello' }],
        }),
      );
    });
  });
});
