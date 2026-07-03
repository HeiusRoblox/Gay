import { Router, Request, Response, NextFunction } from "express";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const KEYS_PATH = resolve(__dirname, "../keys.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const activeSessions = new Set<string>();

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

function auth(req: Request, res: Response, next: NextFunction): void {
  const token = (req.headers["authorization"] || "").replace("Bearer ", "").trim();
  if (!activeSessions.has(token)) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }
  next();
}

const router = Router();

router.post("/admin/login", (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  if (password !== ADMIN_PASSWORD) {
    res.status(401).json({ success: false, message: "Invalid password" });
    return;
  }
  const token = randomUUID();
  activeSessions.add(token);
  res.json({ success: true, token });
});

router.post("/admin/logout", auth, (req: Request, res: Response) => {
  const token = (req.headers["authorization"] || "").replace("Bearer ", "").trim();
  activeSessions.delete(token);
  res.json({ success: true });
});

router.get("/admin/keys", auth, (_req: Request, res: Response) => {
  const keys = loadKeys();
  const now = new Date();
  const result = keys.map((k) => {
    const exp = new Date(k.expire);
    exp.setHours(23, 59, 59, 999);
    const daysLeft = Math.ceil((exp.getTime() - now.getTime()) / 86400000);
    return {
      key: k.key,
      expire: k.expire,
      daysLeft,
      deviceIds: k.deviceIds,
      maxDevices: k.maxDevices,
      deviceCount: k.deviceIds.length,
    };
  });
  res.json({ success: true, keys: result });
});

router.post("/admin/keys", auth, (req: Request, res: Response) => {
  const { key, expire, maxDevices } = req.body as { key?: string; expire?: string; maxDevices?: number };
  if (!key || !expire) {
    res.status(400).json({ success: false, message: "key and expire are required" });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expire)) {
    res.status(400).json({ success: false, message: "expire must be YYYY-MM-DD" });
    return;
  }
  const keys = loadKeys();
  if (keys.find((k) => k.key === key)) {
    res.status(409).json({ success: false, message: "Key already exists" });
    return;
  }
  const max = Number(maxDevices) > 0 ? Number(maxDevices) : 1;
  keys.push({ key, expire, deviceIds: [], maxDevices: max });
  saveKeys(keys);
  res.json({ success: true });
});

router.put("/admin/keys/:key", auth, (req: Request, res: Response) => {
  const { newKey, expire, maxDevices, resetDevices } = req.body as {
    newKey?: string;
    expire?: string;
    maxDevices?: number;
    resetDevices?: boolean;
  };
  if (expire && !/^\d{4}-\d{2}-\d{2}$/.test(expire)) {
    res.status(400).json({ success: false, message: "expire must be YYYY-MM-DD" });
    return;
  }
  const keys = loadKeys();
  const idx = keys.findIndex((k) => k.key === req.params.key);
  if (idx === -1) {
    res.status(404).json({ success: false, message: "Key not found" });
    return;
  }
  if (newKey && newKey !== req.params.key && keys.find((k) => k.key === newKey)) {
    res.status(409).json({ success: false, message: "Key name already exists" });
    return;
  }
  if (newKey) keys[idx].key = newKey;
  if (expire) keys[idx].expire = expire;
  if (maxDevices !== undefined && Number(maxDevices) > 0) keys[idx].maxDevices = Number(maxDevices);
  if (resetDevices) keys[idx].deviceIds = [];
  saveKeys(keys);
  res.json({ success: true });
});

router.delete("/admin/keys/:key", auth, (req: Request, res: Response) => {
  const keys = loadKeys();
  const idx = keys.findIndex((k) => k.key === req.params.key);
  if (idx === -1) {
    res.status(404).json({ success: false, message: "Key not found" });
    return;
  }
  keys.splice(idx, 1);
  saveKeys(keys);
  res.json({ success: true });
});

export default router;
