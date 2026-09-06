import test from 'node:test';
import assert from 'node:assert/strict';

import { ProactiveArbiter, ProactiveTriggerService } from '../src/services/proactiveTriggerService.js';
import { EventBus } from '../src/services/eventBus.js';

test('ProactiveArbiter applies 15s user-speech cooldown veto', () => {
  const arbiter = new ProactiveArbiter({ userSpeechCooldownMs: 15000 });
  const now = Date.now();

  // User just finished speaking 5 seconds ago
  arbiter.recordUserSpeechEnded(now - 5000);

  const evalRecent = arbiter.evaluate({
    silenceSec: 40,
    context: [{ id: 'm1', category: 'task', content: 'Terminar informe' }],
    now
  });

  assert.equal(evalRecent.allowed, false);
  assert.equal(evalRecent.reason, 'user_speech_cooldown');

  // After 16 seconds, breathing cooldown is over
  const evalLater = arbiter.evaluate({
    silenceSec: 40,
    context: [{ id: 'm1', category: 'task', content: 'Terminar informe' }],
    now: now + 11000 // 16s after user speech
  });

  assert.equal(evalLater.allowed, true);
  assert.ok(evalLater.score >= 0.65);
});

test('ProactiveArbiter prevents question chaining', () => {
  const arbiter = new ProactiveArbiter();
  const now = Date.now();

  // Model asked a question
  arbiter.recordModelSpoke('¿Cómo te fue hoy con el proyecto?', true);

  const evalChaining = arbiter.evaluate({
    silenceSec: 45,
    context: [{ id: 'm1', category: 'preference', content: 'Le gusta el té' }],
    now
  });

  assert.equal(evalChaining.allowed, false);
  assert.equal(evalChaining.reason, 'question_chaining_veto');

  // User spoke and answered
  arbiter.recordUserSpeechEnded(now - 20000);

  const evalAfterAnswer = arbiter.evaluate({
    silenceSec: 45,
    context: [{ id: 'm1', category: 'preference', content: 'Le gusta el té' }],
    now
  });

  assert.equal(evalAfterAnswer.allowed, true);
});

test('ProactiveArbiter prioritizes game threat alerts over standard restrictions', () => {
  const arbiter = new ProactiveArbiter();
  const now = Date.now();

  // Question chaining is active, but urgent game threat arrives
  arbiter.recordModelSpoke('¿Estás ahí?', true);

  const evalThreat = arbiter.evaluate({
    silenceSec: 10,
    context: [],
    now,
    gameThreat: { alertType: 'low_health', health: 4 }
  });

  assert.equal(evalThreat.allowed, true);
  assert.ok(evalThreat.score >= 0.8);
});

test('ProactiveTriggerService queues game threat alerts and dispatches via arbiter', () => {
  const dispatched = [];
  const fakeSocket = {
    isConnected: true,
    isConnecting: false,
    sendTextMessage: (txt) => dispatched.push(txt)
  };

  const service = new ProactiveTriggerService({ geminiSocket: fakeSocket });
  service.lastAutonomousInterventionTime = 0; // reset cooldown

  service.handleGameThreatAlert({ alertType: 'low_health', health: 3 });

  // Dispatched immediately to socket because socket was ready and quiet
  assert.equal(dispatched.length, 1);
  assert.ok(dispatched[0].includes('Tu salud está baja (3/20)'));

  service.destroy();
});
