import { Router } from "express";
import { docker } from "../lib/docker";

const router = Router();

router.get("/volumes", async (req, res) => {
  try {
    const data = await docker.listVolumes();
    const volumes = (data.Volumes || []).map((v) => ({
      name: v.Name,
      driver: v.Driver,
      mountpoint: v.Mountpoint,
      createdAt: (v as { CreatedAt?: string }).CreatedAt || "",
    }));
    res.json(volumes);
  } catch (err) {
    req.log.error({ err }, "Failed to list volumes");
    res.status(500).json({ error: "Failed to list volumes" });
  }
});

router.post("/volumes", async (req, res) => {
  try {
    const { name, driver } = req.body as { name: string; driver?: string };
    const volume = await docker.createVolume({
      Name: name,
      Driver: driver || "local",
    });
    res.status(201).json({
      name: volume.Name,
      driver: volume.Driver,
      mountpoint: volume.Mountpoint,
      createdAt: (volume as { CreatedAt?: string }).CreatedAt || "",
    });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to create volume");
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

router.delete("/volumes/:name", async (req, res) => {
  try {
    const volume = docker.getVolume(req.params.name);
    await volume.remove();
    res.json({ success: true, message: "数据卷已删除" });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to remove volume");
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

export default router;
