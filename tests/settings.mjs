import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SettingsManager } from '../src/services/SettingsManager.js';

describe('SettingsManager 单元测试', () => {
  it('默认配置初始化正确', () => {
    const mgr = new SettingsManager();
    assert.equal(mgr.get('controlMode'), 'dual');
    assert.equal(mgr.get('vibrateEnabled'), true);
    assert.equal(mgr.get('sfxEnabled'), true);
    assert.equal(mgr.get('bgmEnabled'), true);
    assert.equal(mgr.get('ghostEnabled'), true);
  });

  it('更新单项配置与读取', () => {
    const mgr = new SettingsManager();
    mgr.set('controlMode', 'left');
    assert.equal(mgr.get('controlMode'), 'left');
  });

  it('布尔值翻转 toggle', () => {
    const mgr = new SettingsManager();
    const v1 = mgr.toggle('vibrateEnabled');
    assert.equal(v1, false);
    assert.equal(mgr.get('vibrateEnabled'), false);
    const v2 = mgr.toggle('vibrateEnabled');
    assert.equal(v2, true);
    assert.equal(mgr.get('vibrateEnabled'), true);
  });

  it('控制模式三模循环 cycleControlMode: dual -> left -> right -> dual', () => {
    const mgr = new SettingsManager();
    mgr.set('controlMode', 'dual');
    assert.equal(mgr.cycleControlMode(), 'left');
    assert.equal(mgr.cycleControlMode(), 'right');
    assert.equal(mgr.cycleControlMode(), 'dual');
  });

  it('订阅机制 listener 正常触发', () => {
    const mgr = new SettingsManager();
    let notified = null;
    const unsub = mgr.subscribe((s) => {
      notified = s;
    });

    mgr.set('controlMode', 'right');
    assert.ok(notified);
    assert.equal(notified.controlMode, 'right');

    notified = null;
    unsub();
    mgr.set('controlMode', 'left');
    assert.equal(notified, null, '退订后不应再收到通知');
  });
});
