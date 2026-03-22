import os from 'os';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';

const AGENT_ID_FILE = process.platform === 'win32'
  ? 'C:\\ProgramData\\local-server-api\\agent-id.txt'
  : '/etc/local-server-api/agent-id';

function runCommand(command: string, timeout = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(command, { timeout }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr?.trim() || error.message));
        return;
      }
      resolve((stdout || '').trim());
    });
  });
}

async function getLinuxFingerprintParts(): Promise<Record<string, string>> {
  const result: Record<string, string> = {};

  const safeRead = (file: string): string => {
    try {
      return fs.readFileSync(file, 'utf8').trim();
    } catch {
      return '';
    }
  };

  result.machineId = safeRead('/etc/machine-id');
  result.productUuid = safeRead('/sys/class/dmi/id/product_uuid');
  result.productSerial = safeRead('/sys/class/dmi/id/product_serial');
  result.boardSerial = safeRead('/sys/class/dmi/id/board_serial');
  result.hostname = os.hostname();

  return result;
}

async function getMacFingerprintParts(): Promise<Record<string, string>> {
  const result: Record<string, string> = {
    hostname: os.hostname()
  };

  try {
    const uuid = await runCommand(`ioreg -rd1 -c IOPlatformExpertDevice | awk -F\\" '/IOPlatformUUID/{print $(NF-1)}'`);
    result.platformUuid = uuid;
  } catch {
    result.platformUuid = '';
  }

  try {
    const serial = await runCommand(`system_profiler SPHardwareDataType | awk -F': ' '/Serial Number/{print $2}'`);
    result.serial = serial;
  } catch {
    result.serial = '';
  }

  return result;
}

async function getWindowsFingerprintParts(): Promise<Record<string, string>> {
  const result: Record<string, string> = {
    hostname: os.hostname()
  };

  try {
    const machineGuid = await runCommand(`reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid`);
    result.machineGuid = machineGuid;
  } catch {
    result.machineGuid = '';
  }

  try {
    const uuid = await runCommand(`powershell -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"`);
    result.uuid = uuid;
  } catch {
    result.uuid = '';
  }

  try {
    const biosSerial = await runCommand(`powershell -Command "(Get-CimInstance Win32_BIOS).SerialNumber"`);
    result.biosSerial = biosSerial;
  } catch {
    result.biosSerial = '';
  }

  return result;
}

export async function getServerFingerprintParts(): Promise<Record<string, string>> {
  if (process.platform === 'linux') {
    return getLinuxFingerprintParts();
  }

  if (process.platform === 'darwin') {
    return getMacFingerprintParts();
  }

  if (process.platform === 'win32') {
    return getWindowsFingerprintParts();
  }

  return { hostname: os.hostname() };
}

export async function getServerFingerprint(): Promise<string> {
  const parts = await getServerFingerprintParts();

  const normalized = Object.keys(parts)
    .sort()
    .map((key) => `${key}=${parts[key] || ''}`)
    .join('|');

  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function ensureDirExists(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getOrCreateAgentId(): string {
  try {
    if (fs.existsSync(AGENT_ID_FILE)) {
      return fs.readFileSync(AGENT_ID_FILE, 'utf8').trim();
    }

    const agentId = crypto.randomUUID();
    ensureDirExists(AGENT_ID_FILE);
    fs.writeFileSync(AGENT_ID_FILE, agentId, 'utf8');
    return agentId;
  } catch {
    return crypto.randomUUID();
  }
}