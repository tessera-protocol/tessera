import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ACTION_MAP, classifyAction, isSensitive } from './actions.js';

describe('action classification', () => {
  it('maps OpenClaw tool names to Tessera action classes', () => {
    assert.equal(ACTION_MAP['gmail.send_email'], 'email.send');
    assert.equal(classifyAction('shell.exec'), 'exec.shell');
    assert.equal(classifyAction('browser.purchase'), 'payment.intent');
  });

  it('treats unknown actions as sensitive', () => {
    assert.equal(classifyAction('unknown.tool'), null);
    assert.equal(isSensitive('unknown.tool'), true);
  });
});
