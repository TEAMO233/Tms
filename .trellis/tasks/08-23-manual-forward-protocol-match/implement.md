# 实施计划：手动转发自动匹配协议凭证

## 执行前检查

- [x] 任务曾处于 `planning`，已完成计划评审并执行 `task.py start`。
- [x] 确认只修改本需求涉及的后端解析、前端说明和必要的验证代码，不覆盖工作区现有 `.agents/`、`.codex/` 等用户文件。

## 实施步骤

1. **后端增加手动协议匹配器**（已完成）
   - 在 `ForwardServiceImpl` 中解析单目标 loopback 地址和端口。
   - 根据隧道类型确定目标节点与入口节点。
   - 精确查询唯一启用 `Inbound`，再按 `forward.userId` 查询唯一启用 `InboundUser`。
   - 区分无匹配、歧义、凭证缺失，避免凭端口猜测或跨用户取凭证。
2. **接入客户端链接解析顺序**（已完成）
   - 保留 `gostForwardId` 自动转发分支。
   - 在 `sourceLink` 之前调用手动匹配器。
   - 匹配成功时调用现有 `ClientLinkUtil.buildInboundLink`，用隧道入口节点地址和当前转发入口端口生成链接。
   - 让单条链接和聚合订阅自然共享新逻辑；保持聚合遇到坏条目跳过的行为。
3. **调整转发管理表单说明**（已完成）
   - 保留 `sourceLink` 兼容输入，但说明系统协议按钮填入目标端口后会自动读取已分配凭证，不要求用户再填写原始链接。
   - 更新生成链接按钮的提示，覆盖“自动协议匹配”和“手动 sourceLink 兜底”两种情况。
4. **静态检查与场景验证**（已完成）
   - 覆盖六个协议端口、端口转发/隧道转发、不同用户、无凭证、停用入站/凭证、多个目标和重复匹配等场景。
   - 检查日志和响应中不出现凭证或完整链接泄漏。

## 验证命令

```bash
# 前端
cd vite-frontend && npm run build

# 后端（项目要求 JDK 21；若本机仍为 JDK 8，记录环境阻塞并执行可行的源码编译检查）
cd springboot-backend && mvn clean package -DskipTests

# 工作区与任务完整性
cd /Users/teamo/Desktop/Tms && git diff --check
python3 ./.trellis/scripts/validate.py
```

## 实际验证结果

- `vite-frontend`: `npm run build` 通过，TypeScript 检查通过。
- `vite-frontend`: 全量 `npm run lint` 仍被项目既有错误阻塞；非自动修复的目标页检查仅有原文件基线错误，无新增解析/类型错误。该脚本包含 `--fix`，执行后的无关自动格式化已回退。
- `springboot-backend`: Java 8 环境下全量 `javac -source 8 -target 8` 通过；正式 Maven 构建因项目要求 Java 21、当前环境为 JDK 8 而阻塞。
- `.trellis/scripts/validate.py`: 仓库不存在该脚本，无法执行。
- `git diff --check`: 通过；检查代理确认没有新增敏感日志。

## 风险与回滚点

- **入口/目标节点混淆**：在端口转发和隧道转发各用一条固定场景验证，确保链接 endpoint 始终是入口节点。
- **重复监听端口**：匹配器必须拒绝歧义，不得依赖数据库返回顺序。
- **凭证归属错误**：查询条件必须使用 `forward.userId`，并加入跨用户检查。
- **旧 sourceLink 兼容性**：只有明确没有可用自动匹配结果时才进入旧改写逻辑；发现行为变化时可单独回退解析顺序，不涉及数据库回滚。
