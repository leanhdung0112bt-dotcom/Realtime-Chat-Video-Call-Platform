import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const check = spawnSync('docker', ['compose', 'version'], { cwd: root, stdio: 'ignore' });
if (check.error || check.status !== 0) {
  console.error('Cần cài Docker và Docker Compose trước khi chạy lệnh này.');
  process.exit(1);
}
const env = new URL('../.env', import.meta.url);
if (!existsSync(env)) {
  writeFileSync(env, 'APP_PORT=3000\nCORS_ORIGIN=http://localhost:3000\nJWT_ACCESS_SECRET=' + randomBytes(48).toString('hex') + '\nJWT_REFRESH_SECRET=' + randomBytes(48).toString('hex') + '\n', { mode: 0o600 });
}
const result = spawnSync('docker', ['compose', 'up', '-d', '--build', '--wait'], { cwd: root, stdio: 'inherit' });
if (result.error || result.status !== 0) process.exit(result.status || 1);
console.log('Ứng dụng đã khởi động. Cổng mặc định: http://localhost:3000 (xem APP_PORT nếu đã đổi).');
