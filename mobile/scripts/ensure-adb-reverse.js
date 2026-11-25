const { execFileSync } = require('child_process');

const verbose = process.argv.includes('--verbose');
const PORTS = [3000, 8081];

function log(message) {
  if (verbose) {
    console.log(message);
  }
}

function getConnectedAndroidDevices() {
  try {
    const raw = execFileSync('adb', ['devices'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 4000,
    });
    return raw
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/))
      .filter(([, state]) => state === 'device')
      .map(([serial]) => serial);
  } catch {
    return null;
  }
}

function main() {
  const devices = getConnectedAndroidDevices();
  if (devices === null) {
    log('[adb-reverse] adb không khả dụng trong PATH — bỏ qua.');
    return;
  }

  if (devices.length === 0) {
    log('[adb-reverse] Chưa có thiết bị/emulator Android nào kết nối.');
    return;
  }

  for (const serial of devices) {
    const forwarded = [];
    for (const port of PORTS) {
      try {
        execFileSync('adb', ['-s', serial, 'reverse', `tcp:${port}`, `tcp:${port}`], {
          stdio: ['ignore', 'ignore', 'ignore'],
          timeout: 4000,
        });
        forwarded.push(port);
      } catch {
        // Ignore transient offline device errors so npm start/android never fails
      }
    }
    if (forwarded.length > 0) {
      console.log(
        `[adb-reverse] ${serial}: đã nối cổng ${forwarded.map((p) => `tcp:${p}`).join(', ')}`,
      );
    }
  }
}

main();
