import { useEffect, useState } from "react";
import type { Skill, Command } from "../types";

interface StartSessionModalProps {
  skills: Skill[];
  commands: Command[];
  cwd: string;
  prompt: string;
  pendingStart: boolean;
  onCwdChange: (value: string) => void;
  onPromptChange: (value: string) => void;
  onStart: () => void;
  onClose: () => void;
}

export function StartSessionModal({
  cwd,
  prompt,
  pendingStart,
  skills,
  commands,
  onCwdChange,
  onPromptChange,
  onStart,
  onClose
}: StartSessionModalProps) {
  const [recentCwds, setRecentCwds] = useState<string[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [selectedCommand, setSelectedCommand] = useState<Command | null>(null);
  const [argumentValue, setArgumentValue] = useState<string>("");
  const [showPreview, setShowPreview] = useState(false);

  // 构建完整的 prompt
  const buildPrompt = (item: Skill | Command | null, arg: string) => {
    if (!item) return "";
    const argPart = arg.trim() ? ` ${arg.trim()}` : (item.argumentHint ? "" : "");
    return `/${item.name}${argPart}`;
  };

  const handleSkillSelect = (skill: Skill | null) => {
    setSelectedSkill(skill);
    setSelectedCommand(null);
    setArgumentValue("");
    setShowPreview(!!skill);
    onPromptChange(buildPrompt(skill, ""));
  };

  const handleCommandSelect = (command: Command | null) => {
    setSelectedCommand(command);
    setSelectedSkill(null);
    setArgumentValue("");
    setShowPreview(!!command);
    onPromptChange(buildPrompt(command, ""));
  };

  // 当参数变化时更新 prompt
  useEffect(() => {
    if (selectedSkill) {
      onPromptChange(buildPrompt(selectedSkill, argumentValue));
    } else if (selectedCommand) {
      onPromptChange(buildPrompt(selectedCommand, argumentValue));
    }
  }, [argumentValue, selectedSkill, selectedCommand]);

  useEffect(() => {
    window.electron.getRecentCwds().then(setRecentCwds).catch(console.error);
  }, []);

  const handleSelectDirectory = async () => {
    const result = await window.electron.selectDirectory();
    if (result) onCwdChange(result);
  };

  // 解析 argumentHint 提取占位符
  const parseArgumentHint = (hint?: string) => {
    if (!hint) return null;
    // 匹配 <placeholder> 或 [placeholder] 格式
    const match = hint.match(/[<\[](\w+)[>\]]/);
    return match ? match[1] : hint;
  };

  const selectedItem = selectedSkill || selectedCommand;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/20 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-ink-900/5 bg-surface p-6 shadow-elevated max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-ink-800">Start Session</div>
          <button className="rounded-full p-1.5 text-muted hover:bg-surface-tertiary hover:text-ink-700 transition-colors" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">Create a new session to start interacting with agent.</p>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted">Working Directory</span>
            <div className="flex gap-2">
              <input
                className="flex-1 rounded-xl border border-ink-900/10 bg-surface-secondary px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors"
                placeholder="/path/to/project"
                value={cwd}
                onChange={(e) => onCwdChange(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={handleSelectDirectory}
                className="rounded-xl border border-ink-900/10 bg-surface px-3 py-2 text-sm text-ink-700 hover:bg-surface-tertiary transition-colors"
              >
                Browse...
              </button>
            </div>
            {recentCwds.length > 0 && (
              <div className="mt-2 grid gap-2 w-full">
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-light">Recent</div>
                <div className="flex flex-wrap gap-2 w-full min-w-0">
                  {recentCwds.map((path) => (
                    <button
                      key={path}
                      type="button"
                      className={`truncate rounded-full border px-3 py-1.5 text-xs transition-colors whitespace-nowrap ${cwd === path ? "border-accent/60 bg-accent/10 text-ink-800" : "border-ink-900/10 bg-white text-muted hover:border-ink-900/20 hover:text-ink-700"}`}
                      onClick={() => onCwdChange(path)}
                      title={path}
                    >
                      {path}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </label>

          {/* Skills Section */}
          {skills.length > 0 && (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">Skills</span>
                <span className="text-[10px] text-muted-light">{skills.length} available</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                <button
                  type="button"
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors ${!selectedSkill ? "border-accent/60 bg-accent/10 text-ink-800" : "border-ink-900/10 bg-white text-muted hover:border-ink-900/20 hover:text-ink-700"}`}
                  onClick={() => handleSkillSelect(null)}
                >
                  None
                </button>
                {skills.map((skill) => (
                  <button
                    key={skill.name}
                    type="button"
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors ${selectedSkill?.name === skill.name ? "border-accent/60 bg-accent/10 text-ink-800" : "border-ink-900/10 bg-white text-muted hover:border-ink-900/20 hover:text-ink-700"}`}
                    onClick={() => handleSkillSelect(skill)}
                    title={skill.description}
                  >
                    /{skill.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Commands Section */}
          {commands.length > 0 && (
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted">Commands</span>
                <span className="text-[10px] text-muted-light">{commands.length} available</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                <button
                  type="button"
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors ${!selectedCommand ? "border-accent/60 bg-accent/10 text-ink-800" : "border-ink-900/10 bg-white text-muted hover:border-ink-900/20 hover:text-ink-700"}`}
                  onClick={() => handleCommandSelect(null)}
                >
                  None
                </button>
                {commands.map((command) => (
                  <button
                    key={command.name}
                    type="button"
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors ${selectedCommand?.name === command.name ? "border-accent/60 bg-accent/10 text-ink-800" : "border-ink-900/10 bg-white text-muted hover:border-ink-900/20 hover:text-ink-700"}`}
                    onClick={() => handleCommandSelect(command)}
                    title={command.description}
                  >
                    /{command.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Selected Item Details */}
          {selectedItem && (
            <div className="grid gap-2 rounded-xl border border-ink-900/10 bg-surface-secondary p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink-800">/{selectedItem.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                      {selectedSkill ? "Skill" : "Command"}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1 line-clamp-2">{selectedItem.description}</p>
                </div>
              </div>

              {/* Argument Input */}
              {selectedItem.argumentHint && (
                <div className="grid gap-1 mt-2">
                  <label className="text-xs font-medium text-muted">
                    Arguments: <code className="text-ink-700 bg-ink-900/5 px-1 rounded">{selectedItem.argumentHint}</code>
                  </label>
                  <input
                    type="text"
                    className="rounded-lg border border-ink-900/10 bg-white px-3 py-1.5 text-sm text-ink-800 placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors"
                    placeholder={parseArgumentHint(selectedItem.argumentHint) || "Enter arguments..."}
                    value={argumentValue}
                    onChange={(e) => setArgumentValue(e.target.value)}
                  />
                </div>
              )}

              {/* Preview Toggle */}
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-muted hover:text-ink-700 transition-colors mt-1"
                onClick={() => setShowPreview(!showPreview)}
              >
                <svg 
                  viewBox="0 0 24 24" 
                  className={`h-3.5 w-3.5 transition-transform ${showPreview ? "rotate-180" : ""}`} 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                >
                  <path d="M19 9l-7 7-7-7" />
                </svg>
                {showPreview ? "Hide preview" : "Show prompt preview"}
              </button>

              {/* Prompt Preview */}
              {showPreview && (
                <div className="rounded-lg bg-ink-900/5 p-2.5 font-mono text-xs text-ink-700 break-all">
                  {buildPrompt(selectedItem, argumentValue)}
                </div>
              )}
            </div>
          )}

          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted">Prompt</span>
            <textarea
              rows={4}
              className="rounded-xl border border-ink-900/10 bg-surface-secondary p-3 text-sm text-ink-800 placeholder:text-muted-light focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 transition-colors resize-none"
              placeholder="Describe the task you want agent to handle..."
              value={prompt}
              onChange={(e) => {
                onPromptChange(e.target.value);
                // 如果用户手动编辑了 prompt，清除选择
                if (selectedItem && !e.target.value.startsWith(`/${selectedItem.name}`)) {
                  setSelectedSkill(null);
                  setSelectedCommand(null);
                  setArgumentValue("");
                }
              }}
            />
          </label>
          <button
            className="flex items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-medium text-white shadow-soft hover:bg-accent-hover transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onStart}
            disabled={pendingStart || !cwd.trim() || !prompt.trim()}
          >
            {pendingStart ? (
              <>
                <svg aria-hidden="true" className="w-4 h-4 animate-spin" viewBox="0 0 100 101" fill="none">
                  <path d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z" fill="currentColor" opacity="0.3" />
                  <path d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z" fill="white" />
                </svg>
                <span>Starting...</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                <span>Start Session</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
