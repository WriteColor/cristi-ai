import test from 'node:test';
import assert from 'node:assert/strict';
import {
  live2dModelRegistry,
  Live2DModelRegistry
} from '../src/domain/live2d/Live2DModelRegistry';
import { ContextualEmotionOrchestrator } from '../src/domain/live2d/ContextualEmotionOrchestrator';
import { ExpressionManager } from '../src/domain/live2d/ExpressionManager';
import { ALL_MODEL_PROFILES } from '../src/domain/live2d/models/index';

test('Live2DModelRegistry loads all 13 official models with valid profiles', () => {
  const registry = new Live2DModelRegistry();
  const models = registry.getAllModels();

  assert.equal(models.length, 13, 'Debe haber exactamente 13 modelos oficiales registrados');
  assert.equal(ALL_MODEL_PROFILES.length, 13);

  const expectedIds = [
    'yanderegirl', 'icegirl', 'hiyori', 'miara', 'toki', 'ellen',
    'jane_doe', 'ruan_mei', 'belle', 'sparkle', 'huohuo', 'vivian', 'goth_loli'
  ];

  for (const id of expectedIds) {
    const model = registry.getModel(id);
    assert.ok(model, `Modelo "${id}" debe existir en el registro`);
    assert.equal(model?.id, id);
    assert.ok(model?.path, `Modelo "${id}" debe tener una ruta válida`);
    assert.ok(model?.capabilities, `Modelo "${id}" debe tener capacidades declaradas`);
  }
});

test('Live2DModelRegistry resolves semantic actions with multi-lingual synonyms', () => {
  const registry = new Live2DModelRegistry();

  // Test standard emotions on yanderegirl
  const happyAction = registry.resolveSemanticAction('yanderegirl', 'happy');
  assert.ok(happyAction);
  assert.ok(happyAction.type === 'expression' || happyAction.type === 'parameters');

  const loveAction = registry.resolveSemanticAction('yanderegirl', 'amor');
  assert.ok(loveAction);

  const blushAction = registry.resolveSemanticAction('yanderegirl', 'sonrojo');
  assert.ok(blushAction);

  const yandereAction = registry.resolveSemanticAction('yanderegirl', 'yandere');
  assert.ok(yandereAction);

  // Test unknown emotion falls back safely
  const unknownAction = registry.resolveSemanticAction('yanderegirl', 'non_existent_emotion_xyz');
  assert.ok(unknownAction);
});

test('ContextualEmotionOrchestrator processes model text and strips emotion tags', () => {
  const orchestrator = new ContextualEmotionOrchestrator();

  const rawText = '¡Hola querido! [emotion: happy] Me alegra mucho verte hoy.';
  const cleaned = orchestrator.processModelText(rawText);

  assert.equal(cleaned, '¡Hola querido! Me alegra mucho verte hoy.');
  assert.equal(orchestrator.currentEmotion, 'happy');

  const rawGesto = 'No te acerques a ella... [gesto: yandere] ¿Entendido?';
  const cleanedGesto = orchestrator.processModelText(rawGesto);
  assert.equal(cleanedGesto, 'No te acerques a ella... ¿Entendido?');
  assert.equal(orchestrator.currentEmotion, 'yandere');

  orchestrator.destroy();
});

test('ContextualEmotionOrchestrator detects natural language sentiment', () => {
  const orchestrator = new ContextualEmotionOrchestrator();

  assert.equal(orchestrator.detectNaturalSentiment('te amo mi amor con todo mi corazón'), 'love');
  assert.equal(orchestrator.detectNaturalSentiment('solo eres mío, no me dejes jamás'), 'yandere');
  assert.equal(orchestrator.detectNaturalSentiment('qué vergüenza me da que me digas eso...'), 'blush');
  assert.equal(orchestrator.detectNaturalSentiment('¡no puede ser, qué sorpresa tan grande!'), 'surprised');
  assert.equal(orchestrator.detectNaturalSentiment('déjame analizar los datos del sistema...'), 'thinking');

  orchestrator.destroy();
});

test('ExpressionManager respects blocked expressions per profile', () => {
  const manager = new ExpressionManager(null, 'ellen');

  // If ellen profile has blocked expressions, isBlocked must return true
  const ellenProfile = live2dModelRegistry.getModel('ellen');
  const blocked = ellenProfile?.blockedExpressions || [];

  for (const exp of blocked) {
    assert.equal(manager.isBlocked(exp), true, `Expresión "${exp}" debe estar bloqueada para Ellen`);
  }

  assert.equal(manager.isBlocked('normal_allowed_expression'), false);
  manager.destroy();
});
