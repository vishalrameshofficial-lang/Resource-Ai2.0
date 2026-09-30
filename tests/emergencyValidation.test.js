import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEmergencyRequest, VALID_CATEGORIES, VALID_URGENCIES } from '../server/ai/schemas.js';

test('Emergency Schema Validation - Valid Request', () => {
  const input = {
    name: 'Ravi Kumar',
    phone: '+919876543210',
    language: 'Tamil',
    category: 'flood',
    description: 'Ground floor inundated by river water',
    location: 'Near Tirunelveli railway station',
    landmark: 'Station road bridge',
    affectedPeople: 25,
    requirements: [
      { item: 'food', quantity: 25, unit: 'packets' },
      { item: 'drinking water', quantity: 50, unit: 'litres' }
    ],
    urgency: 'HIGH',
    immediateDanger: true,
    confirmed: true
  };

  const result = validateEmergencyRequest(input);
  assert.equal(result.valid, true);
  assert.equal(result.data.caller_name, 'Ravi Kumar');
  assert.equal(result.data.caller_phone, '+919876543210');
  assert.equal(result.data.emergency_category, 'flood');
  assert.equal(result.data.affected_people_count, 25);
  assert.equal(result.data.urgency, 'HIGH');
  assert.equal(result.data.immediate_danger, 1);
  assert.equal(result.data.confirmed, true);
});

test('Emergency Schema Validation - Rejects Missing Phone and Location', () => {
  const input = {
    category: 'flood',
    affectedPeople: 5
  };

  const result = validateEmergencyRequest(input);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some(e => e.includes('phone')));
  assert.ok(result.errors.some(e => e.includes('location')));
});

test('Emergency Schema Validation - Normalizes Categories and Urgency Defaults', () => {
  const input = {
    phone: '9845012345',
    location: 'Kullu bypass',
    category: 'unrecognized_disaster_type',
    urgency: 'ULTRA_EXTREME'
  };

  const result = validateEmergencyRequest(input);
  assert.equal(result.valid, true);
  assert.equal(result.data.emergency_category, 'other');
  assert.equal(result.data.urgency, 'HIGH'); // Defaults to HIGH for safety
});
