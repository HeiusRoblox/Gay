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

const router = Router();

router.post("/login", (req, res) => {
  const { apiKey, deviceId } = req.body as { apiKey?: string; deviceId?: string };

  if (!apiKey || !deviceId) {
    res.status(400).json({ success: false, message: "apiKey and deviceId are required" });
    return;
  }

  const keys = loadKeys();
  const entry = keys.find((k) => k.key === apiKey);

  if (!entry) {
    res.json({ success: false, message: "Invalid key" });
    return;
  }

  const expireDate = new Date(entry.expire);
  expireDate.setHours(23, 59, 59, 999);
  const daysLeft = Math.ceil((expireDate.getTime() - Date.now()) / 86400000);

  if (daysLeft <= 0) {
    res.json({ success: false, message: "Key expired" });
    return;
  }

  if (entry.deviceIds.includes(deviceId)) {
    res.json({ success: true, apiKey: entry.key, expire: entry.expire, daysLeft, message: "Login success" });
    return;
  }

  if (entry.deviceIds.length >= entry.maxDevices) {
    res.json({ success: false, message: "Key already used on another device" });
    return;
  }

  entry.deviceIds.push(deviceId);
  saveKeys(keys);
  res.json({ success: true, apiKey: entry.key, expire: entry.expire, daysLeft, message: "Login success" });
});

export default router;
