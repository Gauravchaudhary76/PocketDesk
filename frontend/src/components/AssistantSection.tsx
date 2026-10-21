import React, { useState } from 'react';
import {
  Sparkles,
  Send,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldAlert,
  Play,
  X,
  Camera,
  Cpu,
  Search,
  Maximize2
} from 'lucide-react';
import type { InterpretedCommand, ExecuteCommandResult } from '../types';
import { assistantService } from '../services/assistant';
import { StageBadge } from './StageBadge';

interface AssistantSectionProps {
  agentUrl: string;
  token: string | null;
  isConnected: boolean;
  onOpenInfo: (stage: number, title: string, desc: string, details?: string[]) => void;
}

export const AssistantSection: React.FC<AssistantSectionProps> = ({
  agentUrl,
  token,
  isConnected,
  onOpenInfo,
}) => {
  const [prompt, setPrompt] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Active proposed command and executed result
  const [proposedCommand, setProposedCommand] = useState<InterpretedCommand | null>(null);
  const [executionResult, setExecutionResult] = useState<ExecuteCommandResult | null>(null);
  const [previewScreenshotModal, setPreviewScreenshotModal] = useState<string | null>(null);

  const quickPrompts = [
    { label: 'Check Laptop Telemetry', prompt: 'how is my laptop doing?' },
    { label: 'Launch Calculator', prompt: 'launch calculator' },
    { label: 'Capture Desktop Screenshot', prompt: 'take a screenshot' },
    { label: 'Search Documents', prompt: 'search for files in documents' },
    { label: 'Show Supported Commands', prompt: 'help' },
  ];

  const handleParsePrompt = async (textToParse?: string) => {
    const inputStr = (textToParse || prompt).trim();
    if (!inputStr || !isConnected || !token || !agentUrl) return;

    setIsParsing(true);
    setError(null);
    setProposedCommand(null);
    setExecutionResult(null);

    try {
      const response = await assistantService.parseInstruction(agentUrl, token, inputStr);
      setProposedCommand(response);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to parse natural-language command';
      setError(msg);
    } finally {
      setIsParsing(false);
    }
  };

  const handleExecuteCommand = async (confirmed: boolean = false) => {
    if (!proposedCommand || !token || !agentUrl) return;

    setIsExecuting(true);
    setError(null);

    try {
      const result = await assistantService.executeInstruction(
        agentUrl,
        token,
        proposedCommand.command_id,
        proposedCommand.action_type,
        proposedCommand.parameters,
        confirmed
      );
      setExecutionResult(result);
      setProposedCommand(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to execute proposed desktop action';
      setError(msg);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancelProposed = () => {
    setProposedCommand(null);
    setError(null);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-950/70 border border-purple-800/60 text-purple-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">AI Desktop Command Assistant</h3>
            <p className="text-xs text-slate-400">
              Submit natural language instructions mapped to authorized desktop actions
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StageBadge stage={8} label="Stage 8 Feature" variant="filled" />
          <button
            type="button"
            onClick={() =>
              onOpenInfo(
                8,
                'Stage 8 AI Desktop Assistant Security & Intent Architecture',
                'PocketDesk uses a zero-dependency local rule-based intent engine to execute verified desktop instructions safely.',
                [
                  'Local Rule-Based Intent Parser: Does not require paid third-party AI keys or external API subscriptions.',
                  'Zero Arbitrary Shell Execution: Language instructions never directly spawn shell commands or eval() arbitrary strings.',
                  'Predefined Action Allowlist: Only mapped to authorized actions (app launching, system telemetry, file search, screenshot capture, help).',
                  'Confirmation Gate: Potentially sensitive actions (e.g. desktop screenshots, disruptive tools) require explicit user confirmation before execution.',
                  'Prohibited Command Defense: Destructive commands (rm, del, format, shutdown, process termination) are permanently blocked.',
                  'Audit Trail: Every executed instruction generates a structured security log entry with audit ID.',
                ]
              )
            }
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="View AI Assistant Security Specs"
          >
            <ShieldAlert className="w-4 h-4 text-purple-400" />
          </button>
        </div>
      </div>

      {!isConnected ? (
        <div className="p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-2">
          <Sparkles className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-xs font-medium text-slate-300">Agent Disconnected</p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Connect and pair with your Windows laptop to use the AI desktop command interface.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Quick Suggestion Chips */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-slate-400 block">
              Suggested Instructions:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {quickPrompts.map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setPrompt(qp.prompt);
                    handleParsePrompt(qp.prompt);
                  }}
                  disabled={isParsing || isExecuting}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  {qp.label}
                </button>
              ))}
            </div>
          </div>

          {/* Natural Language Prompt Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleParsePrompt();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isParsing || isExecuting}
                placeholder="Type an instruction (e.g. 'open notepad', 'check battery', 'take screenshot')..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500 text-xs transition-colors pr-8"
              />
              {prompt && (
                <button
                  type="button"
                  onClick={() => setPrompt('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isParsing || isExecuting || !prompt.trim()}
              className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-md shadow-purple-900/30 flex items-center gap-1.5 disabled:opacity-50 transition-all cursor-pointer shrink-0"
            >
              {isParsing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              <span>Interpret</span>
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-900/60 rounded-xl text-rose-300 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block">Instruction Error</span>
                <p className="text-[11px] text-rose-300/90">{error}</p>
              </div>
            </div>
          )}

          {/* Proposed Action Preview Card */}
          {proposedCommand && (
            <div className="p-4 bg-slate-950 rounded-xl border border-purple-900/50 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider font-semibold text-purple-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Proposed Desktop Action
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    proposedCommand.risk_level === 'prohibited'
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : proposedCommand.requires_confirmation
                      ? 'bg-amber-950 text-amber-400 border border-amber-800'
                      : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  }`}
                >
                  {proposedCommand.risk_level === 'prohibited'
                    ? 'Prohibited'
                    : proposedCommand.requires_confirmation
                    ? 'Confirmation Required'
                    : 'Safe Action'}
                </span>
              </div>

              <div className="space-y-1">
                <p className="text-xs font-semibold text-white">
                  {proposedCommand.summary}
                </p>
                <p className="text-[11px] text-slate-400">
                  Instruction: <span className="font-mono text-slate-300 italic">"{proposedCommand.raw_prompt}"</span>
                </p>
                {proposedCommand.parameters && Object.keys(proposedCommand.parameters).length > 0 && (
                  <div className="pt-1 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-slate-500">Parameters:</span>
                    {Object.entries(proposedCommand.parameters).map(([k, v]) => (
                      <span key={k} className="text-[10px] font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
                        {k}: {String(v)}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* If Prohibited / Unsupported */}
              {!proposedCommand.is_supported && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-900/60 rounded-lg text-rose-300 text-[11px]">
                  {proposedCommand.rejection_reason || 'Instruction is not supported by PocketDesk desktop security policy.'}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                <button
                  type="button"
                  onClick={handleCancelProposed}
                  disabled={isExecuting}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                {proposedCommand.is_supported && (
                  <button
                    type="button"
                    onClick={() => handleExecuteCommand(proposedCommand.requires_confirmation)}
                    disabled={isExecuting}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-900/30 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isExecuting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Play className="w-3.5 h-3.5" />
                    )}
                    <span>{proposedCommand.requires_confirmation ? 'Confirm & Execute' : 'Execute Action'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Execution Result Display */}
          {executionResult && (
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold text-white">{executionResult.message}</span>
                </div>
                <span className="text-[10px] font-mono text-slate-500">
                  {executionResult.audit_id}
                </span>
              </div>

              {/* Screenshot Preview */}
              {executionResult.action_type === 'capture_screenshot' && executionResult.result_data?.image_data_uri && (
                <div className="space-y-2">
                  <div className="relative group rounded-lg overflow-hidden border border-slate-800 max-w-sm">
                    <img
                      src={executionResult.result_data.image_data_uri}
                      alt="Host Desktop Screenshot"
                      className="w-full h-auto object-cover"
                    />
                    <div
                      onClick={() => setPreviewScreenshotModal(executionResult.result_data?.image_data_uri || null)}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity text-white text-xs gap-1.5 font-medium"
                    >
                      <Maximize2 className="w-4 h-4" />
                      <span>View Full Screenshot</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <Camera className="w-3.5 h-3.5 text-purple-400" />
                    <span>Captured at {executionResult.result_data.timestamp} ({executionResult.result_data.original_width}x{executionResult.result_data.original_height})</span>
                  </div>
                </div>
              )}

              {/* System Telemetry Preview */}
              {executionResult.action_type === 'get_system_status' && executionResult.result_data && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">CPU Usage</span>
                    <span className="text-sm font-bold text-white flex items-center gap-1">
                      <Cpu className="w-3.5 h-3.5 text-blue-400" />
                      {executionResult.result_data.cpu?.usage_percent}%
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">RAM Usage</span>
                    <span className="text-sm font-bold text-white">
                      {executionResult.result_data.memory?.usage_percent}%
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">Battery</span>
                    <span className="text-sm font-bold text-white">
                      {executionResult.result_data.battery?.percent !== null
                        ? `${executionResult.result_data.battery?.percent}%`
                        : 'AC Powered'}
                    </span>
                  </div>
                  <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 block">OS Host</span>
                    <span className="text-xs font-semibold text-slate-200 truncate block">
                      {executionResult.result_data.os?.hostname}
                    </span>
                  </div>
                </div>
              )}

              {/* File Search Matches Preview */}
              {executionResult.action_type === 'search_files' && executionResult.result_data?.matches && (
                <div className="space-y-1.5 text-xs">
                  <span className="text-[11px] text-slate-400 font-medium">
                    Found {executionResult.result_data.matches.length} Matching Files:
                  </span>
                  {executionResult.result_data.matches.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic">No files matched your query.</p>
                  ) : (
                    <div className="divide-y divide-slate-800 max-h-48 overflow-y-auto rounded-lg border border-slate-800">
                      {executionResult.result_data.matches.map((m: any, idx: number) => (
                        <div key={idx} className="p-2 flex items-center justify-between hover:bg-slate-900/60 transition-colors">
                          <div className="flex items-center gap-2 truncate">
                            <Search className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span className="font-medium text-slate-200 truncate">{m.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono shrink-0 ml-2">
                            {m.root_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Help Catalog Preview */}
              {executionResult.action_type === 'show_help' && executionResult.result_data?.catalog && (
                <div className="space-y-2 text-xs">
                  <span className="text-[11px] text-slate-400 font-medium block">
                    Supported Command Intents:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {executionResult.result_data.catalog.map((cat: any, idx: number) => (
                      <div key={idx} className="p-2.5 bg-slate-900 rounded-lg border border-slate-800 space-y-1">
                        <span className="font-semibold text-purple-300 block text-[11px]">
                          {cat.description}
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {cat.example_phrases.map((ex: string, i: number) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => {
                                setPrompt(ex);
                                handleParsePrompt(ex);
                              }}
                              className="text-[10px] font-mono text-slate-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 hover:text-white"
                            >
                              "{ex}"
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Full Screenshot Modal */}
      {previewScreenshotModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in"
          onClick={() => setPreviewScreenshotModal(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-slate-800 shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewScreenshotModal(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-slate-900/80 text-white hover:bg-slate-800 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewScreenshotModal}
              alt="Desktop Full Preview"
              className="w-full h-auto max-h-[85vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};
