/**
 * 微信小游戏环境垫片 —— 必须最先 import（ES Module 按依赖顺序求值，
 * 本模块无任何 import，因此其函数体先于 three 执行）。
 *
 * 小游戏运行时提供 wx.createCanvas / wx.createImage，但没有 window/document，
 * 也没有 performance / navigator。three 0.162 在「显式传入 canvas、
 * 不加载纹理」的前提下不会在模块初始化阶段触碰 DOM，
 * 这里补齐兜底对象以覆盖所有边缘路径。
 */
/* global wx */
const g = typeof globalThis !== 'undefined' ? globalThis : {};

if (typeof g.window === 'undefined') g.window = g;
if (typeof g.self === 'undefined') g.self = g;
if (typeof g.global === 'undefined') g.global = g;
if (typeof g.performance === 'undefined') {
  g.performance = { now: () => Date.now() };
}
if (typeof g.navigator === 'undefined') {
  g.navigator = { userAgent: 'WeChat MiniGame', platform: 'minigame' };
}
// three 仅在未显式传入 canvas / 加载图片资源时才会用到 document，这里兜底防崩。
if (typeof g.document === 'undefined') {
  g.document = {
    createElementNS(_ns, tag) {
      return tag === 'canvas' ? wx.createCanvas() : wx.createImage();
    },
    createElement(tag) {
      return tag === 'canvas' ? wx.createCanvas() : wx.createImage();
    },
  };
}
