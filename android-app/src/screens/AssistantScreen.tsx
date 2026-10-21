import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StyleSheet,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { androidAssistant } from '../services/assistant';
import type {
  InterpretedCommand,
  ExecuteCommandResult,
  ConnectionStatus,
} from '../types';

interface AssistantScreenProps {
  status: ConnectionStatus;
  agentUrl: string;
}

export const AssistantScreen: React.FC<AssistantScreenProps> = ({ status, agentUrl }) => {
  const [prompt, setPrompt] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [proposedAction, setProposedAction] = useState<InterpretedCommand | null>(null);
  const [lastResult, setLastResult] = useState<ExecuteCommandResult | null>(null);

  // Fullscreen image viewer for screenshots
  const [screenshotModalUri, setScreenshotModalUri] = useState<string | null>(null);

  const quickChips = [
    { label: '🔋 Check Battery & System', prompt: 'check battery and system' },
    { label: '📝 Open Notepad', prompt: 'open notepad' },
    { label: '📸 Take Screenshot', prompt: 'take screenshot' },
    { label: '🔍 Search Downloads', prompt: 'search downloads for report' },
    { label: '⏹ Stop Stream', prompt: 'stop screen share' },
    { label: '❓ Show Help', prompt: 'help' },
  ];

  const handleParsePrompt = async (textToParse?: string) => {
    const raw = textToParse || prompt;
    if (!raw.trim() || status !== 'connected') return;

    try {
      setIsParsing(true);
      setError(null);
      setLastResult(null);
      const res = await androidAssistant.parseInstruction(agentUrl, raw);
      setProposedAction(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Instruction parsing failed');
    } finally {
      setIsParsing(false);
    }
  };

  const handleExecute = async (confirmed = false) => {
    if (!proposedAction || status !== 'connected') return;

    try {
      setIsExecuting(true);
      setError(null);
      const res = await androidAssistant.executeInstruction(
        agentUrl,
        proposedAction.raw_prompt,
        proposedAction.intent,
        proposedAction.parameters,
        confirmed
      );
      setLastResult(res);
      setProposedAction(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Action execution failed');
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>AI Command Interface</Text>
        <Text style={styles.subtitle}>
          Local rule-based natural language parsing with zero paid APIs and zero shell execution.
        </Text>
      </View>

      {/* Suggested Instruction Chips */}
      <View style={styles.chipsSection}>
        <Text style={styles.sectionLabel}>Suggested Instructions:</Text>
        <View style={styles.chipsRow}>
          {quickChips.map((chip, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.chip}
              onPress={() => {
                setPrompt(chip.prompt);
                handleParsePrompt(chip.prompt);
              }}
              disabled={isParsing || isExecuting || status !== 'connected'}
            >
              <Text style={styles.chipText}>{chip.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Prompt Input Form */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.textInput}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="e.g. 'open calculator', 'battery status'..."
          placeholderTextColor="#475569"
          editable={!isParsing && !isExecuting && status === 'connected'}
          onSubmitEditing={() => handleParsePrompt()}
        />
        <TouchableOpacity
          style={[
            styles.parseBtn,
            (!prompt.trim() || isParsing || isExecuting || status !== 'connected') &&
              styles.parseBtnDisabled,
          ]}
          onPress={() => handleParsePrompt()}
          disabled={!prompt.trim() || isParsing || isExecuting || status !== 'connected'}
        >
          {isParsing ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.parseBtnText}>Interpret</Text>
          )}
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Proposed Action Preview Card */}
      {proposedAction && (
        <View style={styles.proposedCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Proposed Desktop Action</Text>
            <View
              style={[
                styles.riskBadge,
                proposedAction.risk_level === 'prohibited'
                  ? styles.riskProhibited
                  : proposedAction.requires_confirmation
                  ? styles.riskMedium
                  : styles.riskSafe,
              ]}
            >
              <Text style={styles.riskBadgeText}>
                {proposedAction.risk_level === 'prohibited'
                  ? 'Prohibited'
                  : proposedAction.requires_confirmation
                  ? 'Confirmation Required'
                  : 'Safe Action'}
              </Text>
            </View>
          </View>

          <Text style={styles.proposedSummary}>{proposedAction.summary}</Text>
          <Text style={styles.proposedPrompt}>
            Prompt: "{proposedAction.raw_prompt}"
          </Text>

          {/* If Prohibited / Unsupported */}
          {!proposedAction.is_supported && (
            <View style={styles.rejectionBox}>
              <Text style={styles.rejectionText}>
                {proposedAction.rejection_reason || 'Instruction violates security policy.'}
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.proposedActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setProposedAction(null)}
              disabled={isExecuting}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            {proposedAction.is_supported && (
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => handleExecute(proposedAction.requires_confirmation)}
                disabled={isExecuting}
              >
                {isExecuting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={styles.confirmBtnText}>
                    {proposedAction.requires_confirmation ? 'Confirm & Execute' : 'Execute Action'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Execution Results Display */}
      {lastResult && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultSuccess}>✓ {lastResult.message}</Text>
            <Text style={styles.auditId}>Audit: {lastResult.audit_id}</Text>
          </View>

          {/* Screenshot Display */}
          {lastResult.intent === 'capture_screenshot' &&
            lastResult.data?.image_data_uri && (
              <View style={styles.screenshotWrapper}>
                <TouchableOpacity
                  onPress={() =>
                    setScreenshotModalUri(String(lastResult.data.image_data_uri))
                  }
                >
                  <Image
                    source={{ uri: String(lastResult.data.image_data_uri) }}
                    style={styles.screenshotThumb}
                    resizeMode="contain"
                  />
                  <Text style={styles.zoomHint}>🔍 Tap to view full size</Text>
                </TouchableOpacity>
              </View>
            )}

          {/* Telemetry Result */}
          {lastResult.intent === 'get_system_status' && lastResult.data && (
            <View style={styles.resultDetails}>
              <Text style={styles.resultDataText}>
                CPU: {String((lastResult.data.cpu as { usage_percent?: number })?.usage_percent || 'N/A')}%
              </Text>
              <Text style={styles.resultDataText}>
                RAM: {String((lastResult.data.memory as { usage_percent?: number })?.usage_percent || 'N/A')}%
              </Text>
              <Text style={styles.resultDataText}>
                Battery: {String((lastResult.data.battery as { percent?: number })?.percent ?? 'N/A')}%
              </Text>
            </View>
          )}

          {/* File Search Result */}
          {lastResult.intent === 'search_files' && Array.isArray(lastResult.data?.matches) && (
            <View style={styles.resultDetails}>
              <Text style={styles.resultDataHeader}>
                Found {(lastResult.data.matches as unknown[]).length} matching files:
              </Text>
              {(lastResult.data.matches as Array<{ name: string; path: string }>).map((m, i) => (
                <Text key={i} style={styles.fileMatchText} numberOfLines={1}>
                  📄 {m.name}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Fullscreen Screenshot Modal */}
      <Modal visible={screenshotModalUri !== null} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={styles.modalCloseBtn}
            onPress={() => setScreenshotModalUri(null)}
          >
            <Text style={styles.modalCloseText}>✕ Close</Text>
          </TouchableOpacity>
          {screenshotModalUri && (
            <Image
              source={{ uri: screenshotModalUri }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  content: {
    padding: 14,
    gap: 12,
  },
  header: {
    gap: 4,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
  },
  chipsSection: {
    gap: 6,
  },
  sectionLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#0b1329',
    borderWidth: 1,
    borderColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  chipText: {
    color: '#cbd5e1',
    fontSize: 11,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#0b1329',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 12,
  },
  parseBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parseBtnDisabled: {
    opacity: 0.5,
  },
  parseBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#f43f5e',
    padding: 8,
    borderRadius: 6,
  },
  errorText: {
    color: '#f43f5e',
    fontSize: 11,
  },
  proposedCard: {
    backgroundColor: '#0b1329',
    borderWidth: 1,
    borderColor: '#7c3aed',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    color: '#c4b5fd',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  riskBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  riskSafe: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  riskMedium: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  riskProhibited: {
    backgroundColor: 'rgba(244, 63, 94, 0.2)',
  },
  riskBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '700',
  },
  proposedSummary: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  proposedPrompt: {
    color: '#94a3b8',
    fontSize: 11,
    fontStyle: 'italic',
  },
  rejectionBox: {
    backgroundColor: 'rgba(244, 63, 94, 0.15)',
    padding: 8,
    borderRadius: 6,
  },
  rejectionText: {
    color: '#f43f5e',
    fontSize: 11,
  },
  proposedActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  confirmBtn: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  confirmBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  resultCard: {
    backgroundColor: '#0b1329',
    borderWidth: 1,
    borderColor: '#10b981',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultSuccess: {
    color: '#10b981',
    fontSize: 12,
    fontWeight: '700',
  },
  auditId: {
    color: '#64748b',
    fontSize: 9,
    fontFamily: 'monospace',
  },
  screenshotWrapper: {
    alignItems: 'center',
    gap: 4,
  },
  screenshotThumb: {
    width: '100%',
    height: 160,
    borderRadius: 6,
    backgroundColor: '#000000',
  },
  zoomHint: {
    color: '#38bdf8',
    fontSize: 10,
  },
  resultDetails: {
    gap: 2,
    paddingTop: 4,
  },
  resultDataHeader: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  resultDataText: {
    color: '#94a3b8',
    fontSize: 11,
  },
  fileMatchText: {
    color: '#94a3b8',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 40,
    right: 20,
    zIndex: 10,
    backgroundColor: '#1e293b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modalCloseText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalImage: {
    width: '100%',
    height: '80%',
  },
});
