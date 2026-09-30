import test from 'node:test';
import assert from 'node:assert/strict';
import { ConversationSession } from '../server/ai/conversationManager.js';
import { CONVERSATION_STAGES } from '../server/ai/prompts.js';

process.env.AI_PROVIDER = 'mock';

test('AI Conversation Engine - Follows Exact 5-Step Flow Without Separate Urgency', async () => {
  const session = new ConversationSession({
    callerPhone: '+919876543210',
    language: 'English'
  });

  // Turn 0: Greeting
  const greeting = session.getGreeting();
  assert.ok(greeting.includes('Resource AI') || greeting.includes('ResourceAI'));
  assert.ok(greeting.includes('query') || greeting.includes('emergency'));

  // Turn 1: "There is flooding in our area and we need food and drinking water."
  const turn1 = await session.processUtterance('There is flooding in our area and we need food and drinking water');
  assert.equal(session.data.category, 'flood');
  assert.ok(session.data.requirements.length > 0);
  assert.equal(session.stage, CONVERSATION_STAGES.LOCATION);
  assert.ok(turn1.replyText.toLowerCase().includes('location') || turn1.replyText.toLowerCase().includes('happening'));

  // Turn 2: "Near Tirunelveli railway station."
  const turn2 = await session.processUtterance('Near Tirunelveli railway station');
  assert.ok(session.data.location.includes('Tirunelveli'));
  assert.equal(session.stage, CONVERSATION_STAGES.PEOPLE);
  assert.ok(turn2.replyText.toLowerCase().includes('people') || turn2.replyText.toLowerCase().includes('affected'));

  // Turn 3: "About 25 people." -> Urgency step is removed! All data gathered, advances straight to CONFIRMATION
  const turn3 = await session.processUtterance('About 25 people');
  assert.equal(session.data.affectedPeople, 25);
  assert.equal(session.stage, CONVERSATION_STAGES.CONFIRMATION);
  assert.ok(turn3.replyText.toLowerCase().includes('confirm') || turn3.replyText.toLowerCase().includes('correct'));
  assert.ok(turn3.replyText.includes('Tirunelveli'));
  assert.ok(turn3.replyText.includes('25'));

  // Bug 4 check: non-affirmative in CONFIRMATION does NOT submit
  const nonAffirmative = await session.processUtterance('Wait a minute');
  assert.equal(session.stage, CONVERSATION_STAGES.CONFIRMATION);
  assert.ok(!session.requestId);

  // Turn 4: "Yes." -> Strict affirmative triggers submission with real database service
  const mockEmergencyService = {
    createFromCall: async (_sess, data) => ({
      request_id: 'REQ-2026-9999',
      emergency_category: data.emergency_category,
      location: data.location,
      affected_people_count: data.affected_people_count
    })
  };
  const turn4 = await session.processUtterance('Yes', mockEmergencyService);
  assert.equal(session.stage, CONVERSATION_STAGES.COMPLETED);
  assert.ok(turn4.requestId);
  assert.ok(turn4.replyText.includes('recorded in ResourceAI'));
  assert.ok(turn4.replyText.includes(turn4.requestId));

  // SAFETY CHECK: Must NEVER claim government received/dispatched
  assert.ok(!turn4.replyText.toLowerCase().includes('government has received'));
});

test('AI Conversation Engine - Recognizes Normal Locations (Coimbatore, Gandhipuram, RS Puram)', async () => {
  // Test Coimbatore
  const session1 = new ConversationSession({ language: 'English', stage: CONVERSATION_STAGES.LOCATION });
  session1.data.category = 'flood';
  await session1.processUtterance('Coimbatore');
  assert.equal(session1.data.location, 'Coimbatore');

  // Test Gandhipuram
  const session2 = new ConversationSession({ language: 'English', stage: CONVERSATION_STAGES.LOCATION });
  session2.data.category = 'flood';
  await session2.processUtterance('Gandhipuram');
  assert.equal(session2.data.location, 'Gandhipuram');

  // Test RS Puram
  const session3 = new ConversationSession({ language: 'English', stage: CONVERSATION_STAGES.LOCATION });
  session3.data.category = 'flood';
  await session3.processUtterance('RS Puram');
  assert.ok(session3.data.location.includes('Puram'));

  // Test Near railway station
  const session4 = new ConversationSession({ language: 'English', stage: CONVERSATION_STAGES.LOCATION });
  session4.data.category = 'flood';
  await session4.processUtterance('Near railway station');
  assert.ok(session4.data.location.toLowerCase().includes('railway station'));
});

test('AI Conversation Safety Rules - Immediate danger life threats', async () => {
  const session = new ConversationSession({
    callerPhone: '+919988776655',
    language: 'English'
  });

  const res = await session.processUtterance('Water is rapidly rising, family is trapped on rooftop in Kurukkuthoorai');
  assert.equal(session.data.immediateDanger, true);
  assert.equal(session.data.category, 'flood');
  // Must not claim government dispatched
  assert.ok(!res.replyText.toLowerCase().includes('government has accepted'));
});
