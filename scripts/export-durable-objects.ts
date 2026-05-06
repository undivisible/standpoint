import { readFileSync, writeFileSync } from 'node:fs';

const workerPath = '.svelte-kit/cloudflare/_worker.js';
const exportLine = 'export { RoomDO } from "../../src/lib/server/room-do";';
const worker = readFileSync(workerPath, 'utf8');

if (!worker.includes(exportLine)) {
	writeFileSync(workerPath, `${worker.trimEnd()}\n${exportLine}\n`);
}
