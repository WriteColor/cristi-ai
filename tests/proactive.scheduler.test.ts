import test from 'node:test';
import assert from 'node:assert/strict';
import { ProactiveScheduler } from '../src/domain/interaction/ProactiveScheduler';

test('ProactiveScheduler schedules reminder and generates prompt context', () => {
  const scheduler = new ProactiveScheduler();

  const now = new Date();
  const futureHour = (now.getHours() + 1) % 24;
  const timeStr = `${String(futureHour).padStart(2, '0')}:00`;

  const task = scheduler.scheduleReminder({ time: timeStr, title: 'Estudiar examen de redes' });
  assert.ok(task);
  assert.equal(task.title, 'Estudiar examen de redes');
  assert.equal(task.executed, false);

  const context = scheduler.getPromptContext();
  assert.ok(context.includes('Estudiar examen de redes'));

  // Cancel task
  const cancelled = scheduler.cancelTask(task.id);
  assert.equal(cancelled, true);

  const contextAfter = scheduler.getPromptContext();
  assert.ok(!contextAfter.includes('Estudiar examen de redes'));
});

test('ProactiveScheduler handles scheduleAlarm and calculateMinutesRemaining', () => {
  const scheduler = new ProactiveScheduler();

  const task = scheduler.scheduleAlarm({ time: '12:00', label: 'Alarma almuerzo' });
  assert.ok(task);
  assert.equal(task.title, 'Alarma: Alarma almuerzo');
  assert.equal(task.type, 'alarm');

  const minutes = scheduler.calculateMinutesRemaining('12:00');
  assert.ok(minutes !== null && typeof minutes === 'number');

  scheduler.cancelTask(task.id);
});

test('ProactiveScheduler returns empty prompt context when no pending tasks exist', () => {
  const scheduler = new ProactiveScheduler();
  const tasks = scheduler.getUpcomingTasks(1440);
  for (const t of tasks) {
    scheduler.cancelTask(t.id);
  }

  const context = scheduler.getPromptContext();
  assert.equal(context, '');
});
