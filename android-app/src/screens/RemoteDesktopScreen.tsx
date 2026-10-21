import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  Modal,
} from 'react-native';
import { androidInput } from '../services/input';
import type { ConnectionStatus, StreamResolution } from '../types';

interface RemoteDesktopScreenProps {
  status: ConnectionStatus;
  agentUrl: string;
  isStreaming: boolean;
  isInputEnabled: boolean;
  streamResolution: StreamResolution;
  fps: number;
  onToggleStream: () => void;
  onToggleInput: () => void;
  onEmergencyStop: () => void;
  onChangeResolution: (res: StreamResolution) => void;
}

export const RemoteDesktopScreen: React.FC<RemoteDesktopScreenProps> = ({
  status,
  agentUrl,
  isStreaming,
  isInputEnabled,
  streamResolution,
  fps,
  onToggleStream,
  onToggleInput,
  onEmergencyStop,
  onChangeResolution,
}) => {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [typedText, setTypedText] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [containerLayout, setContainerLayout] = useState({ width: 0, height: 0 });

  // Touch tracking for pan/drag and clicks
  const lastTouchTimeRef = useRef(0);
  const touchStartRef = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isInputEnabled,
      onMoveShouldSetPanResponder: () => isInputEnabled,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        touchStartRef.current = { x: locationX, y: locationY };
        lastTouchTimeRef.current = Date.now();
      },
      onPanResponderMove: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (!isInputEnabled || containerLayout.width <= 0) return;
        const { locationX, locationY } = evt.nativeEvent;
        const norm = androidInput.mapTouchToNormalized({
          touchX: locationX,
          touchY: locationY,
          containerWidth: containerLayout.width,
          containerHeight: containerLayout.height,
        });
        if (norm.isInsideDisplay) {
          androidInput.moveMouse(agentUrl, norm.x, norm.y);
        }
      },
      onPanResponderRelease: (evt: GestureResponderEvent, gestureState: PanResponderGestureState) => {
        if (!isInputEnabled) return;
        const deltaX = Math.abs(gestureState.dx);
        const deltaY = Math.abs(gestureState.dy);
        const touchDuration = Date.now() - lastTouchTimeRef.current;

        // Detect tap vs drag
        if (deltaX < 6 && deltaY < 6 && touchDuration < 300) {
          const { locationX, locationY } = evt.nativeEvent;
          const norm = androidInput.mapTouchToNormalized({
            touchX: locationX,
            touchY: locationY,
            containerWidth: containerLayout.width,
            containerHeight: containerLayout.height,
          });
          if (norm.isInsideDisplay) {
            androidInput.clickMouse(agentUrl, 'left', 'click', { x: norm.x, y: norm.y });
          }
        }
      },
    })
  ).current;

  const handleSendText = () => {
    if (!typedText || !isInputEnabled) return;
    androidInput.sendText(agentUrl, typedText);
    setTypedText('');
  };

  const handleSendKey = (key: string) => {
    if (!isInputEnabled) return;
    androidInput.sendKey(agentUrl, key, 'press');
  };

  const handleSendShortcut = (keys: string[]) => {
    if (!isInputEnabled) return;
    androidInput.sendShortcut(agentUrl, keys);
  };

  return (
    <View style={styles.container}>
      {/* Top Controls Bar */}
      <View style={styles.toolbar}>
        <View style={styles.toolbarLeft}>
          <TouchableOpacity
            style={[styles.streamBtn, isStreaming && styles.streamBtnActive]}
            onPress={onToggleStream}
            disabled={status !== 'connected'}
          >
            <Text style={styles.streamBtnText}>
              {isStreaming ? '⏹ Stop Stream' : '▶ Start Stream'}
            </Text>
          </TouchableOpacity>

          <View style={styles.resPicker}>
            {(['480p', '720p', '1080p'] as StreamResolution[]).map((res) => (
              <TouchableOpacity
                key={res}
                style={[styles.resBtn, streamResolution === res && styles.resBtnActive]}
                onPress={() => onChangeResolution(res)}
              >
                <Text
                  style={[
                    styles.resBtnText,
                    streamResolution === res && styles.resBtnTextActive,
                  ]}
                >
                  {res}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.toolbarRight}>
          {isInputEnabled ? (
            <TouchableOpacity style={styles.emergencyBtn} onPress={onEmergencyStop}>
              <Text style={styles.emergencyBtnText}>Disable Input</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.enableInputBtn}
              onPress={() => setShowConfirmModal(true)}
              disabled={status !== 'connected'}
            >
              <Text style={styles.enableInputBtnText}>Enable Input</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.kbdToggleBtn, isKeyboardOpen && styles.kbdToggleBtnActive]}
            onPress={() => setIsKeyboardOpen((prev) => !prev)}
          >
            <Text style={styles.kbdToggleText}>⌨ Keyboard</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Screen Stream Viewport */}
      <View
        style={styles.screenContainer}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setContainerLayout({ width, height });
        }}
        {...panResponder.panHandlers}
      >
        {isStreaming ? (
          <View style={styles.liveStreamWrapper}>
            {/* Native RTCView from react-native-webrtc or responsive canvas */}
            <View style={styles.streamSurface}>
              <Text style={styles.streamActiveIndicator}>
                LIVE WEBRTC DESKTOP STREAM ({streamResolution} @ {fps}fps)
              </Text>
              <Text style={styles.touchHintText}>
                {isInputEnabled
                  ? 'Tap to click • Drag to move cursor'
                  : 'Remote input is disabled. Tap "Enable Input" to interact.'}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <Text style={styles.placeholderIcon}>🖥️</Text>
            <Text style={styles.placeholderHeading}>Desktop Stream Inactive</Text>
            <Text style={styles.placeholderSub}>
              {status === 'connected'
                ? 'Tap "Start Stream" above to stream your Windows desktop over WebRTC.'
                : 'Connect to your laptop first to start screen sharing.'}
            </Text>
          </View>
        )}
      </View>

      {/* Quick Click Bar (Left, Right, Double Click, Scroll) */}
      {isInputEnabled && (
        <View style={styles.quickClickBar}>
          <TouchableOpacity
            style={styles.clickActionBtn}
            onPress={() => androidInput.clickMouse(agentUrl, 'left', 'click')}
          >
            <Text style={styles.clickActionText}>Left Click</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.clickActionBtn}
            onPress={() => androidInput.clickMouse(agentUrl, 'left', 'double_click')}
          >
            <Text style={styles.clickActionText}>Double Click</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.clickActionBtn}
            onPress={() => androidInput.clickMouse(agentUrl, 'right', 'click')}
          >
            <Text style={styles.clickActionText}>Right Click</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.clickActionBtn}
            onPress={() => androidInput.scrollMouse(agentUrl, -120)}
          >
            <Text style={styles.clickActionText}>Scroll ↑</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.clickActionBtn}
            onPress={() => androidInput.scrollMouse(agentUrl, 120)}
          >
            <Text style={styles.clickActionText}>Scroll ↓</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Virtual On-Screen Keyboard Drawer */}
      {isKeyboardOpen && (
        <View style={styles.keyboardDrawer}>
          {/* Windows Navigation Hotkeys */}
          <View style={styles.hotkeyRow}>
            {['Esc', 'Tab', 'Enter', 'Backspace', 'Win', 'Ctrl+C', 'Ctrl+V', 'Alt+Tab'].map((hk) => (
              <TouchableOpacity
                key={hk}
                style={styles.hotkeyBtn}
                onPress={() => {
                  if (hk.includes('+')) {
                    const keys = hk.toLowerCase().split('+');
                    handleSendShortcut(keys);
                  } else {
                    handleSendKey(hk.toLowerCase());
                  }
                }}
              >
                <Text style={styles.hotkeyText}>{hk}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Text Input Row */}
          <View style={styles.textInputRow}>
            <TextInput
              style={styles.kbdTextInput}
              value={typedText}
              onChangeText={setTypedText}
              placeholder="Type text to send to Windows host..."
              placeholderTextColor="#475569"
              onSubmitEditing={handleSendText}
            />
            <TouchableOpacity style={styles.sendTextBtn} onPress={handleSendText}>
              <Text style={styles.sendTextBtnText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Confirmation Modal for Input Authorization */}
      <Modal visible={showConfirmModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>⚠️ Enable Remote Input?</Text>
            <Text style={styles.modalBody}>
              Enabling remote input allows this Android app to dispatch synthetic mouse clicks,
              cursor movements, and keystrokes directly to your Windows desktop.
              {'\n\n'}
              • Windows Secure Desktop (UAC, Ctrl+Alt+Del) remains protected by UIPI.{'\n'}
              • You can immediately terminate input at any time via "Disable Input".{'\n'}
              • Backgrounding the app automatically releases all held keys.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  setShowConfirmModal(false);
                  onToggleInput();
                }}
              >
                <Text style={styles.modalConfirmText}>Authorize & Enable</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#0b1329',
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streamBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  streamBtnActive: {
    backgroundColor: '#0284c7',
  },
  streamBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  resPicker: {
    flexDirection: 'row',
    backgroundColor: '#020617',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 2,
  },
  resBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  resBtnActive: {
    backgroundColor: '#2563eb',
  },
  resBtnText: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '600',
  },
  resBtnTextActive: {
    color: '#ffffff',
  },
  enableInputBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  enableInputBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  emergencyBtn: {
    backgroundColor: '#e11d48',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  emergencyBtnText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  kbdToggleBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  kbdToggleBtnActive: {
    backgroundColor: '#475569',
  },
  kbdToggleText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '600',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveStreamWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamSurface: {
    width: '100%',
    height: '100%',
    backgroundColor: '#050a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1e3a8a',
  },
  streamActiveIndicator: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  touchHintText: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  placeholderIcon: {
    fontSize: 36,
  },
  placeholderHeading: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  placeholderSub: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    maxWidth: 260,
  },
  quickClickBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#0b1329',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  clickActionBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
  clickActionText: {
    color: '#93c5fd',
    fontSize: 10,
    fontWeight: '600',
  },
  keyboardDrawer: {
    backgroundColor: '#0b1329',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    padding: 8,
    gap: 6,
  },
  hotkeyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  hotkeyBtn: {
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  hotkeyText: {
    color: '#cbd5e1',
    fontSize: 10,
    fontWeight: '600',
  },
  textInputRow: {
    flexDirection: 'row',
    gap: 6,
  },
  kbdTextInput: {
    flex: 1,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#ffffff',
    fontSize: 12,
  },
  sendTextBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendTextBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#0b1329',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 14,
    padding: 18,
    gap: 12,
    maxWidth: 340,
    width: '100%',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  modalBody: {
    color: '#94a3b8',
    fontSize: 11,
    lineHeight: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modalCancelText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  modalConfirmText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
});
