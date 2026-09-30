import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { OllamaProvider, OpenAIProvider, MockAIProvider, getAIProvider } from '../server/ai/aiProvider.js';

test('OllamaProvider - Provider Selection', () => {
  const origProvider = process.env.AI_PROVIDER;
  const origModel = process.env.AI_MODEL;
  const origBaseUrl = process.env.AI_BASE_URL;

  // 1. Ollama provider selection
  process.env.AI_PROVIDER = 'ollama';
  delete process.env.AI_MODEL;
  delete process.env.AI_BASE_URL;

  const provider = getAIProvider();
  assert.ok(provider instanceof OllamaProvider, 'Expected OllamaProvider instance');
  assert.equal(provider.model, 'qwen2.5:3b');
  assert.equal(provider.baseUrl, 'http://127.0.0.1:11434');

  // 2. OpenAI provider selection
  process.env.AI_PROVIDER = 'openai';
  process.env.AI_API_KEY = 'test-key-not-real';
  const openaiProvider = getAIProvider();
  assert.ok(openaiProvider instanceof OpenAIProvider, 'Expected OpenAIProvider instance');

  // 3. Mock provider selection
  process.env.AI_PROVIDER = 'mock';
  const mockProvider = getAIProvider();
  assert.ok(mockProvider instanceof MockAIProvider, 'Expected MockAIProvider instance');

  // Restore env
  process.env.AI_PROVIDER = origProvider;
  if (origModel) process.env.AI_MODEL = origModel; else delete process.env.AI_MODEL;
  if (origBaseUrl) process.env.AI_BASE_URL = origBaseUrl; else delete process.env.AI_BASE_URL;
});

test('OllamaProvider - Successful Response Simulation', async () => {
  // Create a lightweight local HTTP mock server
  const mockServer = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const parsed = JSON.parse(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      
      if (parsed.format === 'json') {
        res.end(JSON.stringify({
          model: 'qwen2.5:3b',
          message: {
            role: 'assistant',
            content: JSON.stringify({
              name: 'Caller',
              category: 'flood',
              location: 'Tirunelveli',
              affectedPeople: 10,
              urgency: 'HIGH',
              confirmed: true
            })
          },
          done: true
        }));
      } else {
        res.end(JSON.stringify({
          model: 'qwen2.5:3b',
          message: {
            role: 'assistant',
            content: 'Please stay calm. Help is being dispatched to your area.'
          },
          done: true
        }));
      }
    });
  });

  await new Promise(resolve => mockServer.listen(0, '127.0.0.1', resolve));
  const port = mockServer.address().port;

  try {
    const provider = new OllamaProvider('qwen2.5:3b', `http://127.0.0.1:${port}`);
    const sessionState = {
      stage: 'LOCATION',
      language: 'English',
      data: { category: 'flood', affectedPeople: 10 },
      transcript: []
    };

    const result = await provider.processUtterance(sessionState, 'Water is entering our houses');
    assert.ok(result.reply.includes('Please stay calm'));

    const structured = await provider.extractStructuredEmergency(sessionState);
    assert.equal(structured.category, 'flood');
    assert.equal(structured.location, 'Tirunelveli');
  } finally {
    await new Promise(resolve => mockServer.close(resolve));
  }
});

test('OllamaProvider - Service Unavailable Fallback Handling', async () => {
  // Non-existent port
  const provider = new OllamaProvider('qwen2.5:3b', 'http://127.0.0.1:59998');
  const sessionState = {
    stage: 'GREETING',
    language: 'English',
    data: {
      category: '',
      description: '',
      location: '',
      requirements: [],
      affectedPeople: 1
    },
    transcript: []
  };

  // Must not throw; must gracefully fallback to rule-based conversation engine
  const result = await provider.processUtterance(sessionState, 'We have severe flooding in our area');
  assert.ok(result);
  assert.ok(result.reply, 'Must return a valid reply even when Ollama is unavailable');
  assert.equal(sessionState.data.category, 'flood');

  // Structured extraction fallback
  const structured = await provider.extractStructuredEmergency(sessionState);
  assert.ok(structured);
  assert.equal(structured.category, 'flood');

  // Conversation analysis fallback
  const analysis = await provider.analyzeConversation(sessionState);
  assert.ok(analysis);
  assert.equal(analysis.classification, 'EMERGENCY');
});

test('OllamaProvider - Request Timeout Handling', async () => {
  // Server that deliberately stalls longer than timeout
  const slowServer = http.createServer((req, res) => {
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: { content: 'Late response' } }));
    }, 1000);
  });

  await new Promise(resolve => slowServer.listen(0, '127.0.0.1', resolve));
  const port = slowServer.address().port;

  try {
    // 50ms timeout
    const provider = new OllamaProvider('qwen2.5:3b', `http://127.0.0.1:${port}`, { timeoutMs: 50 });
    const sessionState = {
      stage: 'LOCATION',
      language: 'English',
      data: { category: 'fire', location: 'Near Market' },
      transcript: []
    };

    // Must trigger timeout abort and gracefully fallback to Mock provider
    const result = await provider.processUtterance(sessionState, 'Fire is spreading fast');
    assert.ok(result);
    assert.ok(result.reply);
  } finally {
    await new Promise(resolve => slowServer.close(resolve));
  }
});
