import { Router } from "express";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const KEYS_PATH = resolve(__dirname, "../keys.json");

interface KeyEntry {
  key: string;
  expire: string;
  deviceIds: string[];
  maxDevices: number;
}

function loadKeys(): KeyEntry[] {
  return JSON.parse(readFileSync(KEYS_PATH, "utf-8")) as KeyEntry[];
}

function saveKeys(keys: KeyEntry[]): void {
  writeFileSync(KEYS_PATH, JSON.stringify(keys, null, 2), "utf-8");
}

function calcDaysLeft(expire: string): number {
  const exp = new Date(expire);
  exp.setHours(23, 59, 59, 999);
  return Math.ceil((exp.getTime() - Date.now()) / 86400000);
}

const router = Router();

router.post("/session", (req, res) => {
  const { apiKey, deviceId } = req.body as { apiKey?: string; deviceId?: string };

  if (!apiKey || !deviceId) {
    res.status(400).json({ success: false, message: "apiKey và deviceId là bắt buộc" });
    return;
  }

  const keys = loadKeys();
  const entry = keys.find((k) => k.key === apiKey);

  if (!entry) {
    res.json({ success: false, message: "Key không tồn tại" });
    return;
  }

  const daysLeft = calcDaysLeft(entry.expire);

  if (daysLeft <= 0) {
    res.json({ success: false, message: "Key đã hết hạn" });
    return;
  }

  if (entry.deviceIds.includes(deviceId)) {
    res.json({ success: true, expire: entry.expire, daysLeft });
    return;
  }

  if (entry.deviceIds.length >= entry.maxDevices) {
    res.json({ success: false, message: "Key đã được sử dụng trên thiết bị khác" });
    return;
  }

  entry.deviceIds.push(deviceId);
  saveKeys(keys);
  res.json({ success: true, expire: entry.expire, daysLeft });
});

export default router;
