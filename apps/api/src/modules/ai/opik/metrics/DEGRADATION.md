# Graceful Degradation Documentation

## Overview

Graceful degradation in the IKPA metrics system ensures that evaluation continues to function even when external dependencies (Redis cache, Anthropic API) are unavailable or experiencing issues. The system is designed to **fail safely** - returning reasonable default values rather than blocking operations or throwing unhandled errors.

### Design Philosophy

1. **Availability over accuracy**: When AI evaluation is unavailable, return neutral/safe defaults
2. **Fail-open for non-blocking metrics**: Non-safety metrics degrade gracefully without blocking user operations
3. **Fail-safe for safety metrics**: FinancialSafetyMetric uses local pattern matching with no external dependencies
4. **Transparency**: All degraded responses include metadata indicating the degradation state

---

## Failure Scenarios and Behavior

### 1. Redis Unavailable

**Detection**: `redisService?.isAvailable()` returns `false`

**Behavior**:
- Cache reads return `null` (cache miss)
- Cache writes are silently skipped
- Evaluation proceeds with LLM call (no caching)
- System continues functioning without interruption

**Impact**:
- Increased Anthropic API usage (no cache hits)
- Slightly higher latency
- No functionality loss

**Code Path** (ToneEmpathyMetric, CulturalSensitivityMetric):
```typescript
if (!this.redisService?.isAvailable()) {
  return null; // Cache miss, proceed to LLM
}
```

---

### 2. Anthropic API Unavailable (Not Configured)

**Detection**: `anthropicService.isAvailable()` returns `false`

**Behavior**:
- Returns default/neutral score immediately
- Logs warning: "Anthropic service unavailable, returning default score"
- Returns `MetricResult` with `isDefault: true` metadata

**Affected Metrics**:
- ToneEmpathyMetric: Returns score 3 (neutral)
- CulturalSensitivityMetric: Returns score 3 (neutral)

**Not Affected** (no LLM dependency):
- FinancialSafetyMetric (regex-based)
- InterventionSuccessMetric (context-based)
- StakeEffectivenessMetric (calculation-based)

**Code Path**:
```typescript
if (!this.anthropicService.isAvailable()) {
  this.logger.warn('Anthropic service unavailable, returning default score');
  return this.getDefaultResult('AI service unavailable for evaluation');
}
```

---

### 3. Circuit Breaker Open

**Detection**: `isCircuitOpen()` returns `true` in AnthropicService

**Trigger Conditions**:
- 5 consecutive failures (`CIRCUIT_BREAKER_THRESHOLD`)
- Circuit remains open for 60 seconds (`CIRCUIT_BREAKER_RESET_MS`)

**Behavior**:
- Throws `AnthropicServiceUnavailableException('Circuit breaker is open')`
- Metric catches exception and returns default score
- No API call is made (immediate rejection)

**Response**:
```typescript
{
  score: 3, // GEVAL_DEFAULT_SCORE
  reason: 'Evaluation failed: Circuit breaker is open',
  metadata: {
    error: true,
    errorType: 'AnthropicServiceUnavailableException'
  }
}
```

---

### 4. Rate Limit Exceeded (429)

**Behavior**:
1. **Retry with exponential backoff**:
   - Attempt 1: 1000ms base delay
   - Attempt 2: 2000ms delay
   - Attempt 3: 4000ms delay (max 10000ms)
   - Jitter: +/- 20% randomization
2. **After MAX_RETRY_ATTEMPTS (3)**: Throws `AnthropicRateLimitException`
3. **Metric fallback**: Returns default score with error metadata

**Retry Configuration** (`metrics.constants.ts`):
```typescript
MAX_RETRY_ATTEMPTS = 3
RETRY_BASE_DELAY_MS = 1000
RETRY_MAX_DELAY_MS = 10000
RETRY_JITTER_FACTOR = 0.2
```

**Retryable Error Patterns**:
- 429 (rate limit)
- 502, 503 (server errors)
- Timeout errors
- Network errors (ETIMEDOUT, ECONNRESET, ECONNREFUSED)

---

### 5. Timeout

**Configuration**:
- Evaluation timeout: 30 seconds (`EVALUATION_TIMEOUT_MS`)
- API call timeout: 90 seconds (`DEFAULT_API_TIMEOUT_MS`)

**Behavior**:
1. API call is wrapped with timeout promise
2. If timeout exceeded, throws `Error('Anthropic API call timed out after {ms}ms')`
3. Retried as a transient error
4. After retries exhausted, returns default score

**Response**:
```typescript
{
  score: 3,
  reason: 'Evaluation failed: Anthropic API call timed out after 30000ms',
  metadata: {
    error: true,
    errorType: 'Error'
  }
}
```

---

### 6. Network Errors

**Detected Patterns**:
- `ECONNRESET`
- `ETIMEDOUT`
- `ECONNREFUSED`
- `socket hang up`
- `network`
- `overloaded`

**Behavior**:
1. Automatically retried with exponential backoff
2. After retries exhausted, circuit breaker records failure
3. Returns default score with error metadata

---

## Default Scores Returned

When degradation occurs, each metric returns a specific default score based on its purpose:

| Metric | Default Score | Rationale |
|--------|--------------|-----------|
| **ToneEmpathyMetric** | 3 (neutral) | Middle of 1-5 scale; neither penalizes nor rewards |
| **CulturalSensitivityMetric** | 3 (neutral) | Middle of 1-5 scale; conservative middle ground |
| **FinancialSafetyMetric** | 1 (safe/pass) | Fail-open: This is a non-blocking guardrail metric. If pattern matching works, it blocks unsafe content; if there were LLM dependency issues, it would pass to avoid false blocking. Note: This metric has no LLM dependency - it only uses regex patterns. |
| **InterventionSuccessMetric** | 0 (no intervention) | Based on context data only; returns 0 if `userAction` is missing |
| **StakeEffectivenessMetric** | 0 (no score) | Returns 0 if required context (`stakeType`, `goalCompleted`) is missing |

### GEvalMetric Default Implementation

```typescript
getDefaultResult(reason: string): MetricResult {
  const midpoint = Math.ceil(this.scale / 2); // 3 for scale=5
  return {
    score: midpoint,
    reason,
    metadata: { isDefault: true },
  };
}
```

---

## Metadata Indicators

Degraded responses can be identified by checking the `metadata` field in `MetricResult`:

### Error Indicator

When an error occurred during evaluation:

```typescript
{
  metadata: {
    error: true,
    errorType: 'AnthropicServiceUnavailableException' | 'Error' | string
  }
}
```

### Cached Result Indicator

When a result was served from cache:

```typescript
{
  metadata: {
    cached: true,
    // ... other cached metadata
  }
}
```

### Default/Fallback Indicator

When the default score was returned due to service unavailability:

```typescript
{
  metadata: {
    isDefault: true
  }
}
```

### Fast Path Indicator (ToneEmpathyMetric)

When banned word detection bypassed LLM:

```typescript
{
  metadata: {
    fastPath: true,
    bannedWord: 'failed'
  }
}
```

### Identifying Degraded Responses

```typescript
function isDegradedResponse(result: MetricResult): boolean {
  return !!(
    result.metadata?.error ||
    result.metadata?.isDefault ||
    result.metadata?.fallback
  );
}

function isFromCache(result: MetricResult): boolean {
  return !!result.metadata?.cached;
}
```

---

## Recovery Procedures

### Circuit Breaker Auto-Recovery

The system automatically recovers from sustained failures:

1. **Closed State** (normal):
   - All requests proceed normally
   - Failures increment `failureCount`
   - Opens after 5 consecutive failures

2. **Open State** (blocking):
   - All requests immediately rejected
   - Timer starts: 60 seconds (`CIRCUIT_BREAKER_RESET_MS`)
   - After timeout, transitions to half-open

3. **Half-Open State** (testing):
   - Allows ONE request through
   - If success: transitions to closed, resets failure count
   - If failure: immediately returns to open

**Recovery Flow**:
```
closed --> [5 failures] --> open --> [60s wait] --> half-open --> [success] --> closed
                                                              --> [failure] --> open
```

### Cache Refresh Strategy

- **Cache TTL**: 7 days (`GEVAL_CACHE_TTL_SECONDS = 604800`)
- **Cache Version**: Incremented when evaluation criteria change (`CACHE_VERSION = 'v1'`)
- **Single-Flight Pattern**: Prevents cache stampede by coalescing concurrent requests for the same key

**Single-Flight Behavior**:
```typescript
// Multiple concurrent requests for the same evaluation
// share a single LLM call instead of making duplicate calls
return singleFlight(cacheKey, () => this.evaluateWithLLM(...));
```

### Manual Recovery Actions

If prolonged issues occur:

1. **Check Anthropic API status**: Verify API key validity and service status
2. **Check Redis connectivity**: Ensure Redis is accessible
3. **Monitor circuit breaker state**: Use `anthropicService.getCircuitStatus()`
4. **Review logs**: Check for patterns in failures

---

## Monitoring

### Key Metrics to Watch

#### Error Rates
- **metric**: Count of `metadata.error: true` responses
- **alert threshold**: > 10% error rate over 5 minutes
- **action**: Check Anthropic API status, review logs

#### Cache Hit Rates
- **metric**: Ratio of `metadata.cached: true` to total requests
- **expected**: 40-60% hit rate for repeated evaluations
- **alert threshold**: < 10% hit rate (indicates Redis issues)

#### Latency
- **metric**: Time to complete `score()` method
- **expected**:
  - Cache hit: < 50ms
  - LLM evaluation: 1-5 seconds
- **alert threshold**: > 10 seconds average

#### Circuit Breaker State
- **metric**: `anthropicService.getCircuitStatus().state`
- **alert**: Any time state is `'open'` or `'half-open'`

#### Semaphore Queue Length
- **metric**: `getMetricsUtilStats().semaphoreQueueLength`
- **expected**: 0-2 in queue
- **alert threshold**: > 5 waiting requests (indicates backpressure)

#### In-Flight Requests
- **metric**: `getMetricsUtilStats().inFlightRequests`
- **expected**: 0-2 concurrent requests
- **alert threshold**: > 10 (indicates slow responses or hanging requests)

### Health Check Endpoints

Recommended health check implementation:

```typescript
async getMetricsHealth(): Promise<HealthStatus> {
  return {
    anthropic: {
      available: this.anthropicService.isAvailable(),
      circuitBreaker: this.anthropicService.getCircuitStatus(),
    },
    redis: {
      available: this.redisService?.isAvailable() ?? false,
    },
    semaphore: getMetricsUtilStats(),
  };
}
```

### Log Patterns to Monitor

| Log Level | Pattern | Meaning |
|-----------|---------|---------|
| WARN | `Anthropic service unavailable` | API not configured or circuit open |
| WARN | `Circuit breaker is open` | Sustained failures, requests rejected |
| WARN | `Retry attempt {n}/{max}` | Transient failure, retrying |
| WARN | `Failed to cache` | Redis write failed |
| WARN | `Failed to read cache` | Redis read failed |
| ERROR | `Failed to evaluate {metric}` | Evaluation failed after retries |
| LOG | `Circuit breaker closed after successful request` | Recovery successful |
| LOG | `Circuit breaker entering half-open state` | Testing recovery |

---

## Configuration Reference

### Constants (`metrics.constants.ts`)

```typescript
// Default scores
GEVAL_DEFAULT_SCORE = 3

// Cache configuration
CACHE_VERSION = 'v1'
GEVAL_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60  // 7 days
CACHE_LOCK_TTL_MS = 30000  // 30 seconds

// Retry configuration
MAX_RETRY_ATTEMPTS = 3
RETRY_BASE_DELAY_MS = 1000
RETRY_MAX_DELAY_MS = 10000
RETRY_JITTER_FACTOR = 0.2

// Evaluation timeout
EVALUATION_TIMEOUT_MS = 30000  // 30 seconds

// Rate limiting
MAX_CONCURRENT_LLM_CALLS = 2
```

### Constants (`anthropic.constants.ts`)

```typescript
// Circuit breaker
CIRCUIT_BREAKER_THRESHOLD = 5      // failures before opening
CIRCUIT_BREAKER_RESET_MS = 60000   // 60 seconds to half-open

// Retry configuration
MAX_RETRIES = 3
RETRY_BASE_DELAY_MS = 1000
MAX_RETRY_DELAY_MS = 10000

// Timeouts
DEFAULT_API_TIMEOUT_MS = 90000     // 90 seconds
EVALUATION_API_TIMEOUT_MS = 30000  // 30 seconds
```

---

## Summary

The graceful degradation system ensures:

1. **Continuous operation**: System never fully blocks due to external dependency issues
2. **Transparent failures**: All degraded responses include metadata indicators
3. **Automatic recovery**: Circuit breaker and retry logic handle transient failures
4. **Safe defaults**: Non-blocking metrics return neutral scores; safety metrics use local logic
5. **Observable state**: All degradation states can be monitored and alerted on

When investigating degraded responses, always check:
1. `metadata.error` - Was there an error?
2. `metadata.cached` - Was this from cache?
3. `metadata.isDefault` - Was this a fallback score?
4. Circuit breaker state via `getCircuitStatus()`
5. Semaphore stats via `getMetricsUtilStats()`
