import assert from 'node:assert/strict';
import {
  buildTransparentGroups,
  formatForwardAddress,
  isProtocolManagedForward,
} from './my-sub.ts';

assert.equal(formatForwardAddress('1.2.3.4', 443), '1.2.3.4:443');
assert.equal(formatForwardAddress('2401:db8::1', 443), '[2401:db8::1]:443');

assert.equal(
  isProtocolManagedForward({ name: 'inbound-12-user-3', tunnelName: '手工隧道' }),
  true,
  'inbound-* 自动协议转发不应该展示到透明中转订阅里',
);
assert.equal(
  isProtocolManagedForward({ name: '自建转发', tunnelName: 'inbound-tunnel-node7' }),
  true,
  '协议托管隧道里的转发不应该展示到透明中转订阅里',
);

const groups = buildTransparentGroups([
  {
    id: 1,
    name: '香港入口',
    tunnelId: 10,
    tunnelName: 'HK→SG 透明中转',
    inIp: '38.55.105.29,2401:db8::1',
    inPort: 10443,
    remoteAddr: '127.0.0.1:443',
    status: 1,
  },
  {
    id: 2,
    name: '已暂停',
    tunnelId: 10,
    tunnelName: 'HK→SG 透明中转',
    inIp: '38.55.105.29',
    inPort: 9443,
    remoteAddr: '127.0.0.1:9443',
    status: 0,
  },
  {
    id: 3,
    name: 'inbound-22-user-5',
    tunnelId: 11,
    tunnelName: 'inbound-tunnel-node3',
    inIp: '10.0.0.1',
    inPort: 20001,
    remoteAddr: '127.0.0.1:40001',
    status: 1,
  },
  {
    id: 4,
    name: '日本备用',
    tunnelId: 12,
    tunnelName: 'JP 透明中转',
    inIp: '203.0.113.7',
    inPort: 8443,
    remoteAddr: '127.0.0.1:8443',
    status: 1,
  },
]);

assert.equal(groups.length, 2);
assert.deepEqual(groups.map((g) => g.tunnelName), ['HK→SG 透明中转', 'JP 透明中转']);
assert.equal(groups[0].entries.length, 2, '多入口 IP 要展开成两条可复制地址');
assert.equal(groups[0].entries[0].address, '38.55.105.29:10443');
assert.equal(groups[0].entries[1].address, '[2401:db8::1]:10443');
assert.equal(
  groups[0].compositeText,
  '香港入口 | 38.55.105.29:10443\n香港入口 | [2401:db8::1]:10443',
  '复合订阅给车友复制入口地址即可,不要暴露内部/原始目标地址',
);
assert.equal(groups[1].compositeText, '日本备用 | 203.0.113.7:8443');
assert.equal(groups[0].compositeText.includes('127.0.0.1'), false);

console.log('my-sub transparent helpers: ok');
