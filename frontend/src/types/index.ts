export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface OSInfo {
  system: string;
  release: string;
  version: string;
  architecture: string;
  hostname: string;
}

export interface CPUInfo {
  model: string | null;
  cores_physical: number | null;
  cores_logical: number;
  usage_percent: number;
  frequency_mhz: number | null;
}

export interface MemoryInfo {
  total_bytes: number;
  available_bytes: number;
  used_bytes: number;
  usage_percent: number;
}

export interface BatteryInfo {
  present: boolean;
  percent: number | null;
  is_charging: boolean | null;
  power_plugged: boolean | null;
  seconds_left: number | null;
}

export interface SystemInfoResponse {
  os: OSInfo;
  cpu: CPUInfo;
  memory: MemoryInfo;
  battery: BatteryInfo | null;
  timestamp: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  os: string;
  hostname: string;
  ipAddress: string;
  batteryLevel: number | null;
  isCharging: boolean;
  cpuModel: string;
  ramTotalGb: number;
  lastSeen: string;
}

export interface SystemMetrics {
  cpuUsagePercent: number;
  ramUsagePercent: number;
  ramUsedGb: number;
  diskUsagePercent: number;
  diskFreeGb: number;
  networkUpKbps: number;
  networkDownKbps: number;
  temperatureC: number;
}

export interface RunningApplication {
  pid: number;
  name: string;
  windowTitle: string;
  cpuPercent: number;
  memoryMb: number;
  iconName: string;
}

export interface TransferFile {
  id: string;
  name: string;
  sizeBytes: number;
  type: 'upload' | 'download';
  status: 'queued' | 'transferring' | 'completed' | 'cancelled';
  progressPercent: number;
  timestamp: string;
}

export type ActiveTab = 'display' | 'controls' | 'files' | 'apps' | 'system';

export type StreamResolution = '1080p' | '720p' | '540p' | '480p';

export interface StreamConfig {
  fps: number;
  resolution: StreamResolution;
}

export type InputMode = 'touch' | 'trackpad';

export interface ScreenDimensions {
  width: number;
  height: number;
  aspect_ratio: number;
  input_enabled: boolean;
}

export interface InputStatus {
  enabled: boolean;
  authorized_client: string | null;
  held_keys_count: number;
  held_buttons_count: number;
  screen_width: number;
  screen_height: number;
}

export type ConnectionMode = 'local' | 'remote';

export interface PairedDeviceItem {
  device_id: string;
  device_name: string;
  paired_at: string;
  last_seen: string;
  revoked: boolean;
  role: string;
  last_ip: string;
}

export interface IceServerConfig {
  ice_servers: RTCIceServer[];
  turn_configured: boolean;
  nat_traversal_mode: string;
  documentation: string;
}
