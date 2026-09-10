import test from 'node:test';
import assert from 'node:assert/strict';
import { ProactiveScheduler } from '../src/domain/interaction/ProactiveScheduler';
import { ExternalReplyService } from '../src/domain/interaction/ExternalReplyService';
import { InteractionOrchestrator } from '../src/domain/interaction/InteractionOrchestrator';

test('ProactiveScheduler schedules alarms, calculates remaining minutes, and provides LLM prompt context', () => {
  const scheduler = new ProactiveScheduler();

  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  const targetTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const alarm = scheduler.scheduleAlarm({
    id: 'test_alarm_1',
    time: targetTime,
    label: 'Tomar medicina'
  });

  assert.equal(alarm.id, 'test_alarm_1');
  assert.equal(alarm.type, 'alarm');
  assert.equal(alarm.targetTime, targetTime);

  const remaining = scheduler.calculateMinutesRemaining(targetTime);
  assert.ok(remaining !== null && remaining >= 28 && remaining <= 32);

  const upcoming = scheduler.getUpcomingTasks(60);
  assert.ok(upcoming.some((t) => t.id === 'test_alarm_1'));

  const promptContext = scheduler.getPromptContext();
  assert.ok(promptContext.includes('ALARMAS Y RECORDATORIOS ACTIVOS'));
  assert.ok(promptContext.includes('Tomar medicina'));

  const cancelled = scheduler.cancelTask('test_alarm_1');
  assert.equal(cancelled, true);

  scheduler.destroy();
});

test('InteractionOrchestrator handles external sender registration and response delivery', async () => {
  const sentMessages: { channelId: string; text: string }[] = [];

  const orchestrator = new InteractionOrchestrator({
    senders: {
      discord: async (channelId: string, text: string) => {
        sentMessages.push({ channelId, text });
        return { success: true };
      }
    }
  });

  // Calling deliverExternalResponse without correlationId returns error
  const emptyRes = await orchestrator.deliverExternalResponse('Hola', null);
  assert.equal(emptyRes.success, false);

  // Calling with non-existent correlationId returns error
  const notFoundRes = await orchestrator.deliverExternalResponse('Hola', 'missing-corr-id');
  assert.equal(notFoundRes.success, false);

  orchestrator.destroy();
});

test('ExternalReplyService configures options and controls listener lifecycle', () => {
  const replyService = new ExternalReplyService();

  assert.doesNotThrow(() => {
    replyService.configure({
      model: 'gemini-2.5-flash',
      systemPrompt: 'Eres Cristi AI, asistente cariñosa.',
      timeoutMs: 8000
    });
  });

  assert.doesNotThrow(() => replyService.start());
  assert.doesNotThrow(() => replyService.stop());
  assert.doesNotThrow(() => replyService.destroy());
});
