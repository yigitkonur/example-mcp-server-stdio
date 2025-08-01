/**
 * Shared test utilities for MCP server testing
 * Provides common test helpers and fixtures
 */

import { describe, test, expect } from '@jest/globals';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { CallToolResult, GetPromptResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Standard test timeout for async operations
 */
export const TEST_TIMEOUT = 10000;

/**
 * Common test data for calculator operations
 */
export const CALCULATOR_TEST_DATA = {
  basicOperations: [
    { operation: 'add', input_1: 10, input_2: 5, expected: 15, symbol: '+' },
    { operation: 'subtract', input_1: 20, input_2: 8, expected: 12, symbol: '-' },
    { operation: 'multiply', input_1: 7, input_2: 6, expected: 42, symbol: '×' },
    { operation: 'divide', input_1: 20, input_2: 4, expected: 5, symbol: '÷' },
  ],
  
  edgeCases: [
    { operation: 'divide', input_1: 10, input_2: 0, expectError: true, errorMessage: 'Cannot divide by zero' },
    { operation: 'multiply', input_1: Number.MAX_VALUE, input_2: 2, expectError: true, errorMessage: 'overflow' },
    { operation: 'subtract', input_1: -Number.MAX_VALUE, input_2: Number.MAX_VALUE, expectError: true, errorMessage: 'underflow' },
  ],
  
  decimalTests: [
    { operation: 'divide', input_1: 7.5, input_2: 2.5, expected: 3 },
    { operation: 'multiply', input_1: 0.1, input_2: 0.2, expected: 0.02 },
    { operation: 'add', input_1: 0.1, input_2: 0.2, expected: 0.30000000000000004 }, // Floating point precision
  ],
  
  largeNumbers: [
    { operation: 'add', input_1: Number.MAX_SAFE_INTEGER - 1, input_2: 1, expected: Number.MAX_SAFE_INTEGER },
    { operation: 'multiply', input_1: 1e308, input_2: 1, expected: 1e308 },
  ],
};

/**
 * Common prompt test data
 */
export const PROMPT_TEST_DATA = {
  explainCalculation: [
    { operation: 'multiply', input_1: 12, input_2: 5, level: 'elementary', expectedKeywords: ['simple terms', 'visual'] },
    { operation: 'divide', input_1: 17, input_2: 3, level: 'advanced', expectedKeywords: ['mathematical properties', 'applications'] },
  ],
  
  generateProblems: [
    { difficulty: 'easy', count: 5, operations: ['add', 'subtract'] },
    { difficulty: 'medium', count: 3, operations: ['multiply'] },
    { difficulty: 'hard', count: 10, operations: ['add', 'subtract', 'multiply', 'divide'] },
  ],
  
  tutorPrompts: [
    { topic: 'fractions', studentLevel: '5th grade', expectedKeywords: ['patient', 'encouraging'] },
    { topic: 'multiplication', studentLevel: '3rd grade', expectedKeywords: ['visual aids'] },
    { topic: 'algebra', studentLevel: 'high school', expectedKeywords: ['algebra'] },
  ],
};

/**
 * Helper to extract text from tool call results
 */
export function extractTextFromResult(result: CallToolResult): string {
  if (result.content.length === 0) return '';
  const firstContent = result.content[0];
  if ('text' in firstContent) {
    return firstContent.text;
  }
  return '';
}

/**
 * Helper to extract text from prompt results
 */
export function extractTextFromPrompt(result: GetPromptResult): string {
  if (result.messages.length === 0) return '';
  const firstMessage = result.messages[0];
  if (firstMessage.content.type === 'text' && 'text' in firstMessage.content) {
    return firstMessage.content.text;
  }
  return '';
}

/**
 * Helper to parse JSON from resource content
 */
export function parseResourceJson(result: ReadResourceResult): any {
  if (result.contents.length === 0) return null;
  try {
    return JSON.parse(result.contents[0].text);
  } catch (e) {
    return null;
  }
}

/**
 * Test helper to verify all required tools are present
 */
export async function verifyRequiredTools(client: Client, requiredTools: string[]): Promise<void> {
  const tools = await client.listTools();
  const toolNames = tools.tools.map(t => t.name);
  
  requiredTools.forEach(toolName => {
    expect(toolNames).toContain(toolName);
  });
}

/**
 * Test helper to verify all required resources are present
 */
export async function verifyRequiredResources(client: Client, requiredUris: string[]): Promise<void> {
  const resources = await client.listResources();
  const resourceUris = resources.resources.map(r => r.uri);
  
  requiredUris.forEach(uri => {
    expect(resourceUris).toContain(uri);
  });
}

/**
 * Test helper to verify all required prompts are present
 */
export async function verifyRequiredPrompts(client: Client, requiredPrompts: string[]): Promise<void> {
  const prompts = await client.listPrompts();
  const promptNames = prompts.prompts.map(p => p.name);
  
  requiredPrompts.forEach(promptName => {
    expect(promptNames).toContain(promptName);
  });
}

/**
 * Test helper for performance testing
 */
export async function measureExecutionTime<T>(
  operation: () => Promise<T>,
  maxDuration: number = 5000
): Promise<{ result: T; duration: number }> {
  const startTime = Date.now();
  const result = await operation();
  const duration = Date.now() - startTime;
  
  expect(duration).toBeLessThan(maxDuration);
  
  return { result, duration };
}

/**
 * Test helper for concurrent operations
 */
export async function testConcurrentOperations<T>(
  operations: Array<() => Promise<T>>,
  validateResult: (result: T, index: number) => void
): Promise<void> {
  const results = await Promise.all(operations.map(op => op()));
  results.forEach((result, index) => validateResult(result, index));
}

/**
 * Standard error test cases for invalid inputs
 */
export const STANDARD_ERROR_TESTS = {
  invalidToolName: { name: 'non-existent-tool', arguments: {} },
  invalidResourceUri: { uri: 'invalid://resource' },
  invalidPromptName: { name: 'non-existent-prompt', arguments: {} },
};

/**
 * Helper to create a standard test suite structure
 */
export function createStandardTestSuite(
  suiteName: string,
  setupFn: () => Promise<{ client: Client; cleanup: () => Promise<void> }>
) {
  describe(suiteName, () => {
    let client: Client;
    let cleanup: () => Promise<void>;

    beforeEach(async () => {
      const setup = await setupFn();
      client = setup.client;
      cleanup = setup.cleanup;
    });

    afterEach(async () => {
      await cleanup();
    });

    // Return client getter for test access
    return {
      getClient: () => client,
    };
  });
}

/**
 * Mathematical constants for validation
 */
export const MATH_CONSTANTS = {
  pi: Math.PI,
  e: Math.E,
  sqrt2: Math.SQRT2,
  ln2: Math.LN2,
  ln10: Math.LN10,
  phi: 1.618033988749895,
};

/**
 * Helper to validate mathematical constants
 */
export function validateMathConstants(constants: Record<string, number>): void {
  Object.entries(MATH_CONSTANTS).forEach(([key, expectedValue]) => {
    expect(constants).toHaveProperty(key);
    expect(constants[key]).toBeCloseTo(expectedValue, 10);
  });
}

/**
 * Helper to generate random test data
 */
export function generateRandomCalculations(count: number = 10): Array<{
  operation: string;
  input_1: number;
  input_2: number;
}> {
  const operations = ['add', 'subtract', 'multiply', 'divide'];
  return Array.from({ length: count }, () => ({
    operation: operations[Math.floor(Math.random() * operations.length)],
    input_1: Math.floor(Math.random() * 100),
    input_2: Math.floor(Math.random() * 100) + 1, // Avoid division by zero
  }));
}

/**
 * Helper to validate calculation result format
 */
export function validateCalculationResult(
  result: CallToolResult,
  expectedValue?: number,
  expectError: boolean = false
): void {
  expect(result.isError).toBe(expectError);
  expect(result.content).toHaveLength(1);
  expect(result.content[0].type).toBe('text');
  
  if (expectedValue !== undefined && !expectError) {
    const text = extractTextFromResult(result);
    expect(text).toContain(expectedValue.toString());
  }
}

/**
 * Standard test timeouts
 */
export const TIMEOUTS = {
  short: 1000,
  medium: 5000,
  long: 10000,
  veryLong: 30000,
};

/**
 * Helper for retry logic in flaky tests
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

/**
 * Batch calculation test helper
 */
export function generateBatchCalculations(count: number = 10): Array<{
  operation: 'add' | 'subtract' | 'multiply' | 'divide';
  input_1: number;
  input_2: number;
}> {
  const operations: Array<'add' | 'subtract' | 'multiply' | 'divide'> = ['add', 'subtract', 'multiply', 'divide'];
  return Array.from({ length: count }, (_, i) => ({
    operation: operations[i % operations.length],
    input_1: Math.floor(Math.random() * 50) + 1,
    input_2: Math.floor(Math.random() * 50) + 1,
  }));
}