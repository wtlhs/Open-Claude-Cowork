# Skills 功能对接方案

### 目标
对接 Claude Code 原生的 Skills/Commands 功能，让用户可以在 GUI 中使用和调用预定义的任务模板。

### 实现步骤

#### Phase 1: SDK 层支持（核心）

**1.1 修改 `src/electron/libs/runner.ts`**
- 添加 `settingSources: ['user']` 加载用户配置
- 从 `SDKInitMessage` 提取 skills 列表并发送到前端
- 支持 `plugins` 配置加载自定义 skill 目录

**1.2 修改 `src/electron/types.ts`**
- 添加 `Skill` 类型定义
- 添加 `skill.list` ServerEvent 类型

**1.3 修改 `src/electron/ipc-handlers.ts`**
- 添加 `skill.list` IPC 处理器

**1.4 修改 `src/electron/main.ts`**
- 添加 `get-skills` IPC handler

---

#### Phase 2: 前端 UI

**2.1 修改 `src/ui/types.ts`**
- 添加 `Skill` 类型
- 添加相关 Event 类型

**2.2 修改 `src/ui/store/useAppStore.ts`**
- 添加 `skills` 状态
- 添加 `setSkills` 方法

**2.3 修改 `src/ui/components/StartSessionModal.tsx`**
- 添加 Skills 选择下拉菜单
- 选择 Skill 后自动填充 prompt 模板

**2.4 修改 `src/ui/App.tsx`**
- 监听 `skill.list` 事件更新 store

---

#### Phase 3: preload 桥接

**3.1 修改 `src/electron/preload.cts`**
- 添加 `getSkills()` API

---

### 数据结构

```typescript
type Skill = {
  name: string;
  description: string;
  argumentHint?: string;
};
```

### 文件修改清单

| 文件 | 改动 |
|------|------|
| `runner.ts` | 添加 settingSources, 提取 skills |
| `types.ts` (electron) | 添加 Skill 类型 |
| `ipc-handlers.ts` | 添加 skills 处理逻辑 |
| `main.ts` | 添加 get-skills IPC |
| `preload.cts` | 暴露 getSkills API |
| `types.ts` (ui) | 添加 Skill 类型 |
| `useAppStore.ts` | 添加 skills 状态 |
| `StartSessionModal.tsx` | 添加 Skill 选择器 |
| `App.tsx` | 监听 skill.list 事件 |

---

### Claude Code 原生 Skills 结构

Claude Code 在 `~/.claude/` 目录下支持以下配置：

```
~/.claude/
├── skills/                    # Skill 定义目录
│   └── <skill-name>/
│       └── SKILL.md          # Skill 配置文件
├── commands/                  # Command 定义目录
│   └── <command>.md          # Command 配置文件
└── plugins/                   # 插件目录
```

#### Skill 文件格式 (SKILL.md)

```markdown
---
name: explaining-code
description: Explains code with visual diagrams and analogies
---

[Skill prompt content...]
```

#### Command 文件格式

```markdown
---
argument-hint: [--no-verify] [--style=simple|full]
description: Create well-formatted commits
---

[Command prompt content...]
```

### SDK API 参考

| API | 说明 |
|-----|------|
| `query({ plugins: [...] })` | 加载插件（包含 skills） |
| `query({ settingSources: ['user'] })` | 加载用户配置目录 |
| `Query.supportedCommands()` | 获取可用的 skills/commands 列表 |
| `SDKInitMessage.skills` | 会话初始化时返回 skills 列表 |
| `SDKInitMessage.slash_commands` | 会话初始化时返回 commands 列表 |
