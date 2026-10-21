import test from 'node:test';
import assert from 'node:assert/strict';
import { androidAssistant } from '../src/services/assistant';

test('Assistant Service: Exposes parse and execute functions', () => {
  assert.equal(typeof androidAssistant.getIntents, 'function');
  assert.equal(typeof androidAssistant.parseInstruction, 'function');
  assert.equal(typeof androidAssistant.executeInstruction, 'function');
});
