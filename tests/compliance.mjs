import test from 'node:test';
import assert from 'node:assert/strict';
import { PrivacyManager } from '../src/services/PrivacyManager.js';

test('PrivacyManager 隐私合规生命周期测试', async (t) => {
  await t.test('初始未授权状态', () => {
    const pm = new PrivacyManager();
    assert.equal(pm.needAuth, false);
    assert.equal(pm._privacyResolve, null);
  });

  await t.test('接收到 needAuthorization 触发授权需求与监听派发', () => {
    const pm = new PrivacyManager();
    let notifiedState = null;
    pm.onNeedAuth((need) => {
      notifiedState = need;
    });

    let resolvedData = null;
    pm.handleNeedAuth((data) => {
      resolvedData = data;
    });

    assert.equal(pm.needAuth, true);
    assert.equal(notifiedState, true);
    assert.equal(typeof pm._privacyResolve, 'function');
  });

  await t.test('用户同意隐私授权正常 resolve', () => {
    const pm = new PrivacyManager();
    let notifiedState = null;
    pm.onNeedAuth((need) => {
      notifiedState = need;
    });

    let resolvedData = null;
    pm.handleNeedAuth((data) => {
      resolvedData = data;
    });

    pm.agree();
    assert.equal(pm.needAuth, false);
    assert.equal(notifiedState, false);
    assert.deepEqual(resolvedData, { buttonId: 'agree-btn', event: 'agree' });
    assert.equal(pm._privacyResolve, null);
  });

  await t.test('用户拒绝隐私授权正常通知微信', () => {
    const pm = new PrivacyManager();
    let notifiedState = null;
    pm.onNeedAuth((need) => {
      notifiedState = need;
    });

    let resolvedData = null;
    pm.handleNeedAuth((data) => {
      resolvedData = data;
    });

    pm.disagree();
    assert.equal(pm.needAuth, false);
    assert.equal(notifiedState, false);
    assert.deepEqual(resolvedData, { event: 'disagree' });
    assert.equal(pm._privacyResolve, null);
  });

  await t.test('无微信环境调用 requirePrivacyAuthorize 平稳降级返回 true', async () => {
    const pm = new PrivacyManager();
    const ok = await pm.requirePrivacyAuthorize();
    assert.equal(ok, true);
  });
});

