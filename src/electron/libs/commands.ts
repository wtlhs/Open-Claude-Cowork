import { query, type SlashCommand } from '@anthropic-ai/claude-agent-sdk';
import type { Skill, Command } from '../types.js';
import { getClaudeCodePath } from './claude-settings.js';
import { getEnhancedEnv } from './util.js';

/**
 * 获取可用的 Skills 列表
 * 通过 SDK 的 supportedCommands() 方法获取
 */
export async function getCommands(): Promise<{ skills: Skill[]; commands: Command[] }> {
  try {
    const q = query({
      prompt: '',  // 空的 prompt 仅用于获取 skills
      options: {
        cwd: process.cwd(),
        pathToClaudeCodeExecutable: getClaudeCodePath(),
        settingSources: ['user'],  // 加载用户配置目录
        permissionMode: 'bypassPermissions',
        allowDangerouslySkipPermissions: true,
        env: getEnhancedEnv(),
      }
    });

    // 获取支持的 commands/skills
    const allCommands = await q.supportedCommands();
    
    // 转换为 Skill 类型
    const skills: Skill[] = [];
    const commands: Command[] = allCommands.map((cmd: SlashCommand) => ({
      name: cmd.name,
      description: cmd.description,
      argumentHint: cmd.argumentHint,
    }));

    // 关闭 query
    q.return();
    
    return { skills, commands };
  } catch (error) {
    console.error('Failed to get skills:', error);
    return { skills: [], commands: [] };
  }
}
