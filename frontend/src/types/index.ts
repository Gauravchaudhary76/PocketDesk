export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface DeviceInfo {
  id: string;
  name: string;
  os: string;
  hostname: string;
  ipAddress: string;
  batteryLevel: number;
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
