import test from 'node:test';
import assert from 'node:assert/strict';

const PORT = 5055;

test('API Endpoints - Health, Requests, Stats and Exotel Status', async (t) => {
  // 1. Health check
  const healthRes = await fetch(`http://localhost:${PORT}/api/health`);
  assert.equal(healthRes.status, 200);
  const healthData = await healthRes.json();
  assert.equal(healthData.status, 'healthy');
  assert.equal(healthData.app, 'ResourceAI');
  assert.ok(healthData.database.includes('node:sqlite'));

  // 2. Stats endpoint
  const statsRes = await fetch(`http://localhost:${PORT}/api/stats`);
  assert.equal(statsRes.status, 200);
  const statsData = await statsRes.json();
  assert.equal(statsData.success, true);
  assert.ok(statsData.data.total >= 0);
  assert.ok(Array.isArray(statsData.data.byCategory));

  // 3. Exotel Status endpoint
  const exotelRes = await fetch(`http://localhost:${PORT}/api/exotel/status`);
  assert.equal(exotelRes.status, 200);
  const exotelData = await exotelRes.json();
  assert.equal(exotelData.success, true);
  assert.equal(exotelData.data.streamEndpoint, '/api/voice/exotel/stream');
  assert.ok(exotelData.setupGuide.step1);

  // 4. Voice Test Simulator endpoint (simulating phone conversation greeting)
  const voiceRes = await fetch(`http://localhost:${PORT}/api/voice/test`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '', language: 'Tamil' })
  });
  assert.equal(voiceRes.status, 200);
  const voiceData = await voiceRes.json();
  assert.equal(voiceData.success, true);
  assert.ok(voiceData.data.replyText.includes('ResourceAI'));
  assert.equal(voiceData.data.language, 'Tamil');
});
