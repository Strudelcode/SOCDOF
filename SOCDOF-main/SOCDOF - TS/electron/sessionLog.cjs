// Readable per-session log files for crash diagnosis.
// Each app start writes its own file into <data>/logs and keeps only the newest MAX_SESSION_LOGS files.
const fs = require('fs');
const path = require('path');

const MAX_SESSION_LOGS = 20;
const LOG_DIR_NAME = 'logs';

let logFilePath = null;

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatTimestamp(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatFileTimestamp(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

// Turns an arbitrary value (Error, object, string) into readable multi-line text.
function describe(value) {
  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`;
  }
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function writeLine(level, message) {
  if (!logFilePath) return;
  const line = `[${formatTimestamp(new Date())}] ${level.padEnd(7)} ${message}\n`;
  try {
    fs.appendFileSync(logFilePath, line, 'utf8');
  } catch {
    // Logging must never crash the app
  }
}

// Removes the oldest session logs so that only MAX_SESSION_LOGS files remain.
function pruneOldLogs(logDir) {
  try {
    const files = fs
      .readdirSync(logDir)
      .filter((name) => name.startsWith('session-') && name.endsWith('.log'))
      .sort();
    // Keep room for the session file that is about to be created
    const excess = files.length - (MAX_SESSION_LOGS - 1);
    for (let i = 0; i < excess; i += 1) {
      fs.unlinkSync(path.join(logDir, files[i]));
    }
  } catch {
    // Pruning is best effort
  }
}

// Starts a new session log in <dataDir>/logs. Returns the log file path or null.
function startSessionLog(dataDir, appInfo) {
  try {
    const logDir = path.join(dataDir, LOG_DIR_NAME);
    fs.mkdirSync(logDir, { recursive: true });
    pruneOldLogs(logDir);

    const now = new Date();
    logFilePath = path.join(logDir, `session-${formatFileTimestamp(now)}.log`);

    const header = [
      '==============================================================',
      ' SOCDOF session log',
      '==============================================================',
      ` Started:    ${formatTimestamp(now)}`,
      ` Version:    ${appInfo.version}`,
      ` Platform:   ${appInfo.platform}`,
      ` Electron:   ${appInfo.electron}`,
      ` Node:       ${appInfo.node}`,
      ` Data dir:   ${dataDir}`,
      ` Process ID: ${process.pid}`,
      '==============================================================',
      '',
    ].join('\n');
    fs.writeFileSync(logFilePath, header, 'utf8');
    return logFilePath;
  } catch {
    logFilePath = null;
    return null;
  }
}

function logInfo(message) {
  writeLine('INFO', message);
}

function logWarn(message) {
  writeLine('WARN', message);
}

// Logs a crash or error with its details. Use for uncaught exceptions and renderer/child process failures.
function logError(title, details) {
  const body = details === undefined ? '' : `\n${describe(details)}`;
  writeLine('ERROR', `${title}${body}`);
}

function getSessionLogPath() {
  return logFilePath;
}

module.exports = { startSessionLog, logInfo, logWarn, logError, getSessionLogPath };
