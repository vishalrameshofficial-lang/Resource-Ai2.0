import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.AI_PROVIDER = 'mock';

import app from '../server/app.js';
import { getDatabase } from '../server/db/database.js';
import { callService } from '../server/services/callService.js';
import { MockAIProvider } from '../server/ai/aiProvider.js';
import { DEPARTMENTS } from '../server/ai/prompts.js';

let server;
let baseUrl = '';

test.before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(() => {
  if (server) server.close();
});

test('Post-Call Classification - 12 Configurable Departments taxonomy is defined', () => {
  assert.equal(DEPARTMENTS.length, 12);
  assert.ok(DEPARTMENTS.includes('Water & Sanitation'));
  assert.ok(DEPARTMENTS.includes('Fire & Rescue'));
  assert.ok(DEPARTMENTS.includes('Medical / Healthcare'));
  assert.ok(DEPARTMENTS.includes('Food & Essential Supplies'));
  assert.ok(DEPARTMENTS.includes('Shelter & Evacuation'));
  assert.ok(DEPARTMENTS.includes('Electricity'));
  assert.ok(DEPARTMENTS.includes('Roads & Transportation'));
  assert.ok(DEPARTMENTS.includes('Police / Security'));
  assert.ok(DEPARTMENTS.includes('Waste Management'));
  assert.ok(DEPARTMENTS.includes('Disaster Management'));
  assert.ok(DEPARTMENTS.includes('Government Services'));
  assert.ok(DEPARTMENTS.includes('Other / Unclassified'));
});

test('Post-Call Classification - Prompt Example 1: Fire & Rescue', async () => {
  const ai = new MockAIProvider();
  const transcript = 'There is a fire near the market and people are trapped.';
  const res = await ai.classifyCallQuery(transcript);

  assert.equal(res.department, 'Fire & Rescue');
  assert.equal(res.required_service, 'Fire Rescue');
  assert.ok(res.required_resources.includes('Fire Rescue Team'));
  assert.equal(res.priority, 'Critical');
  assert.equal(res.location, 'near the market');
  assert.equal(res.affected_people, 'people are trapped');
  assert.ok(res.confidence >= 0.9);
});

test('Post-Call Classification - Prompt Example 2: Medical / Healthcare', async () => {
  const ai = new MockAIProvider();
  const transcript = 'My father is injured and needs an ambulance.';
  const res = await ai.classifyCallQuery(transcript);

  assert.equal(res.department, 'Medical / Healthcare');
  assert.equal(res.required_service, 'Emergency Medical Assistance');
  assert.ok(res.required_resources.includes('Ambulance'));
  assert.equal(res.priority, 'Critical');
  assert.equal(res.location, 'Not mentioned');
  assert.ok(res.affected_people.includes('father'));
});

test('Post-Call Classification - Prompt Example 3: Roads & Transportation', async () => {
  const ai = new MockAIProvider();
  const transcript = 'The road near our village is completely blocked after the flood.';
  const res = await ai.classifyCallQuery(transcript);

  assert.equal(res.department, 'Roads & Transportation');
  assert.equal(res.required_service, 'Road Clearance');
  assert.ok(res.required_resources.includes('Road Clearance Team'));
  assert.equal(res.priority, 'High');
});

test('Post-Call Classification - Prompt Example 4: Food & Essential Supplies', async () => {
  const ai = new MockAIProvider();
  const transcript = 'We have not received food supplies for two days.';
  const res = await ai.classifyCallQuery(transcript);

  assert.equal(res.department, 'Food & Essential Supplies');
  assert.equal(res.required_service, 'Emergency Food Supply');
  assert.ok(res.required_resources.includes('Food Supplies'));
  assert.equal(res.priority, 'High');
  assert.equal(res.location, 'Not mentioned');
  assert.equal(res.affected_people, 'Not mentioned');
});

test('Post-Call Classification - Water & Sanitation Example with Non-Hallucination', async () => {
  const ai = new MockAIProvider();
  const transcript = 'There is no drinking water in our village for three days.';
  const res = await ai.classifyCallQuery(transcript);

  assert.equal(res.query, 'There is no drinking water in our village for three days.');
  assert.equal(res.summary, 'Drinking water unavailable for three days.');
  assert.equal(res.department, 'Water & Sanitation');
  assert.equal(res.required_service, 'Drinking Water Supply');
  assert.deepEqual(res.required_resources, ['Water Tanker']);
  assert.equal(res.priority, 'High');
  assert.equal(res.location, 'Not mentioned');
  assert.equal(res.affected_people, 'Not mentioned');
  assert.equal(res.language, 'English');
  assert.equal(res.confidence, 0.94);
});

test('Post-Call Classification - Strict Non-Hallucination & Fallback on Uncertain Query', async () => {
  const ai = new MockAIProvider();
  const transcript = 'Hello, can anyone hear me?';
  const res = await ai.classifyCallQuery(transcript);

  assert.equal(res.department, 'Other / Unclassified');
  assert.equal(res.priority, 'Unknown');
  assert.equal(res.location, 'Not mentioned');
  assert.equal(res.affected_people, 'Not mentioned');
  assert.deepEqual(res.required_resources, []);
  assert.ok(res.confidence <= 0.5);
});

test('Database Schema - call_sessions table has all extended classification columns', () => {
  const db = getDatabase();
  const tableInfo = db.prepare('PRAGMA table_info(call_sessions)').all();
  const colNames = tableInfo.map(c => c.name);

  const requiredCols = [
    'query',
    'summary',
    'department',
    'required_service',
    'required_resources',
    'priority',
    'location',
    'affected_people',
    'classification_confidence',
    'classification_status',
    'telephony_source_ip'
  ];

  for (const col of requiredCols) {
    assert.ok(colNames.includes(col), `Column ${col} missing from call_sessions schema`);
  }
});

test('Call Service & Database - Persists and parses classification fields correctly', () => {
  const testId = `test_classification_${Date.now()}`;
  const now = new Date().toISOString();

  callService.saveCallSession({
    id: testId,
    callSid: `exo_test_${Date.now()}`,
    streamSid: `str_test_${Date.now()}`,
    callerPhone: '+919876543210',
    exotelNumber: '+914447615477',
    startedAt: now,
    endedAt: now,
    language: 'Tamil',
    transcript: [{ role: 'caller', text: 'எங்கள் பகுதியில் குடிநீர் இல்லை.' }],
    aiSummary: 'Drinking water shortage in Tamil',
    status: 'COMPLETED',
    query: 'எங்கள் பகுதியில் குடிநீர் இல்லை.',
    summary: 'Drinking water unavailable.',
    department: 'Water & Sanitation',
    required_service: 'Drinking Water Supply',
    required_resources: ['Water Tanker'],
    priority: 'High',
    location: 'Not mentioned',
    affected_people: 'Not mentioned',
    classification_confidence: 0.94,
    classification_status: 'completed',
    telephony_source_ip: '122.161.45.89'
  });

  const retrieved = callService.getCallById(testId);
  assert.ok(retrieved);
  assert.equal(retrieved.department, 'Water & Sanitation');
  assert.equal(retrieved.required_service, 'Drinking Water Supply');
  assert.deepEqual(retrieved.required_resources, ['Water Tanker']);
  assert.equal(retrieved.priority, 'High');
  assert.equal(retrieved.location, 'Not mentioned');
  assert.equal(retrieved.telephony_source_ip, '122.161.45.89');
  assert.equal(retrieved.classification_confidence, 0.94);
});

test('API Endpoints - POST /api/calls/:id/analyze returns required JSON schema', async () => {
  const testId = `test_analyze_${Date.now()}`;
  const now = new Date().toISOString();

  callService.saveCallSession({
    id: testId,
    callSid: `exo_an_${Date.now()}`,
    callerPhone: '+919876543210',
    exotelNumber: '+914447615477',
    startedAt: now,
    endedAt: now,
    language: 'English',
    transcript: [{ role: 'caller', text: 'There is a fire near the market and people are trapped.' }],
    status: 'COMPLETED'
  });

  const res = await fetch(`${baseUrl}/api/calls/${testId}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript: 'There is a fire near the market and people are trapped.' })
  });

  assert.equal(res.status, 200);
  const data = await res.json();

  assert.equal(data.department, 'Fire & Rescue');
  assert.equal(data.required_service, 'Fire Rescue');
  assert.ok(data.required_resources.includes('Fire Rescue Team'));
  assert.equal(data.priority, 'Critical');
  assert.equal(data.location, 'near the market');
  assert.equal(data.affected_people, 'people are trapped');
  assert.ok(typeof data.confidence === 'number');

  // Verify saved against the record in database
  const updated = callService.getCallById(testId);
  assert.equal(updated.department, 'Fire & Rescue');
  assert.equal(updated.priority, 'Critical');
});

test('API Endpoints - PATCH /api/calls/:id/classification allows admin correction', async () => {
  const testId = `test_patch_${Date.now()}`;
  const now = new Date().toISOString();

  callService.saveCallSession({
    id: testId,
    callSid: `exo_patch_${Date.now()}`,
    callerPhone: '+919876543210',
    startedAt: now,
    endedAt: now,
    status: 'COMPLETED',
    department: 'Other / Unclassified',
    priority: 'Unknown'
  });

  const res = await fetch(`${baseUrl}/api/calls/${testId}/classification`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      department: 'Roads & Transportation',
      required_service: 'Road Clearance',
      required_resources: ['Road Clearance Team', 'Excavator'],
      priority: 'High',
      location: 'Pallipalayam bus stand'
    })
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.success, true);
  assert.equal(data.data.department, 'Roads & Transportation');
  assert.equal(data.data.location, 'Pallipalayam bus stand');
  assert.deepEqual(data.data.required_resources, ['Road Clearance Team', 'Excavator']);
});

test('API Endpoints - GET /api/calls/departments/stats returns real aggregated data', async () => {
  const res = await fetch(`${baseUrl}/api/calls/departments/stats`);
  assert.equal(res.status, 200);
  const json = await res.json();

  assert.equal(json.success, true);
  assert.ok(Array.isArray(json.data.departments));
  assert.equal(json.data.departments.length, 12);
  assert.ok(typeof json.data.totalCalls === 'number');
  assert.ok(json.data.priorityCounts);
});
