import assert from 'node:assert/strict';
import {
  buildTransparentRelaySubUrl,
  shouldShowTransparentRelaySubscription,
  toSafeCount,
} from './my-sub.ts';

assert.equal(toSafeCount(3), 3);
assert.equal(toSafeCount('4'), 4);
assert.equal(toSafeCount(null), 0);
assert.equal(toSafeCount(Number.NaN), 0);

assert.equal(
  buildTransparentRelaySubUrl('http://140.245.126.119:6366', 'abc 123'),
  'http://140.245.126.119:6366/api/v1/open_api/transparent_relay_sub?token=abc%20123',
);

assert.equal(
  shouldShowTransparentRelaySubscription({ subToken: 'token', availableCount: 1, skippedCount: 0 }),
  true,
  '有可用透明中转节点时必须展示到我的订阅',
);
assert.equal(
  shouldShowTransparentRelaySubscription({ subToken: 'token', availableCount: 0, skippedCount: 2 }),
  false,
  '全部被跳过时不展示空订阅,避免用户复制不可用链接',
);
assert.equal(
  shouldShowTransparentRelaySubscription({ subToken: '', availableCount: 1, skippedCount: 0 }),
  false,
  '没有 token 时不能展示',
);

console.log('my-sub transparent subscription helpers: ok');
