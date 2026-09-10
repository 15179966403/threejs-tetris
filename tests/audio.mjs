import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AudioService } from '../src/services/AudioService.js';
import { settingsManager } from '../src/services/SettingsManager.js';

describe('AudioService 单元测试', () => {
  it('默认状态下音效处于启用状态', () => {
    const audio = new AudioService();
    assert.equal(audio.isEnabled(), true);
  });

  it('联动 SettingsManager 切换音效开关', () => {
    const audio = new AudioService();
    settingsManager.set('sfxEnabled', false);
    assert.equal(audio.isEnabled(), false);

    settingsManager.set('sfxEnabled', true);
    assert.equal(audio.isEnabled(), true);
  });

  it('无音频硬件上下文时所有音效方法平稳降级、不抛出异常', () => {
    const audio = new AudioService();
    assert.doesNotThrow(() => {
      audio.resume();
      audio.playMove();
      audio.playRotate();
      audio.playSoftDrop();
      audio.playHardDrop();
      audio.playClear(1, 0);
      audio.playClear(4, 2);
      audio.playLaser();
      audio.playGravity();
      audio.playDecay();
      audio.playGameOver();
      audio.playUiClick();
    });
  });

  it('静音模式下安全调用所有音效方法', () => {
    const audio = new AudioService();
    settingsManager.set('sfxEnabled', false);
    assert.doesNotThrow(() => {
      audio.playMove();
      audio.playHardDrop();
      audio.playClear(2, 1);
    });
    // 恢复默认
    settingsManager.set('sfxEnabled', true);
  });
});
