export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type ConnectionMode = 'local' | 'remote';
export type ActiveTab = 'desktop' | 'controls' | 'files' | 'apps' | 'system' | 'assistant' | 'connect';
export type StreamResolution = '480p' | '720p' | '1080p';

export interface RegisteredLaptop {
  id: string;
  name: string;
  agentUrl: string;
  mode: ConnectionMode;
  deviceId?: string;
  lastConnected?: string;
  isDefault?: boolean;
}

export interface OsInfo {
  system: string;
  release: string;
  version: string;
  architecture: string;
  hostname: string;
}

export interface CpuInfo {
  model: string;
  cores_physical: number;
  cores_logical: number;
  current_frequency_mhz: number | null;
  usage_percent: number;
}

export interface MemoryInfo {
  total_bytes: number;
  available_bytes: number;
  used_bytes: number;
  usage_percent: number;
}

export interface BatteryInfo {
  percent: number | null;
  power_plugged: boolean | null;
  is_charging: boolean | null;
  seconds_left: number | null;
}

export interface SystemInfoResponse {
  os: OsInfo;
  cpu: CpuInfo;
  memory: MemoryInfo;
  battery: BatteryInfo;
  timestamp: string;
}

export interface PairResponse {
  success: boolean;
  message: string;
  session_token: string;
  expires_in_seconds: number;
  agent_version: string;
}

export interface RemoteDevicePairResponse {
  success: boolean;
  device_id: string;
  device_secret: string;
  device_name: string;
  paired_at: string;
  expires_in_seconds: number;
  message: string;
}

export interface RemoteSessionResponse {
  success: boolean;
  session_token: string;
  expires_in_seconds: number;
  device_id: string;
  message: string;
}

export interface IceServerConfig {
  ice_servers: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
  transport_policy: 'all' | 'relay';
}

export interface StreamAnswerResponse {
  sdp: string;
  type: string;
  session_id: string;
  resolution: string;
  fps: number;
}

export interface ScreenInfoResponse {
  primary_monitor: {
    width: number;
    height: number;
    top: number;
    left: number;
  };
  total_monitors: number;
}

export interface InputOperationResponse {
  success: boolean;
  message: string;
  action?: string;
  position?: { x: number; y: number };
}

export interface ApprovedRoot {
  id: string;
  name: string;
  path: string;
  is_default: boolean;
  free_space_bytes?: number;
}

export interface ApprovedRootsResponse {
  roots: ApprovedRoot[];
  total: number;
}

export interface FileItem {
  name: string;
  path: string;
  size_bytes: number;
  is_directory: boolean;
  modified_at: string;
  extension: string;
}

export interface DirectoryListingResponse {
  root_id: string;
  current_path: string;
  relative_path: string;
  items: FileItem[];
  total_items: number;
}

export interface AppInfo {
  app_id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  is_disruptive: boolean;
}

export interface AppAllowlistResponse {
  applications: AppInfo[];
  total: number;
}

export interface LaunchAppResponse {
  success: boolean;
  app_id: string;
  pid: number | null;
  message: string;
}

export interface InterpretedCommand {
  raw_prompt: string;
  intent: string;
  parameters: Record<string, unknown>;
  summary: string;
  is_supported: boolean;
  requires_confirmation: boolean;
  risk_level: 'safe' | 'medium' | 'high' | 'prohibited';
  rejection_reason?: string | null;
}

export interface ExecuteCommandResult {
  success: boolean;
  intent: string;
  message: string;
  data: Record<string, unknown>;
  audit_id: string;
}

export interface IntentCatalogItem {
  intent: string;
  name: string;
  description: string;
  parameters: Record<string, string>;
  requires_confirmation: boolean;
  examples: string[];
}
