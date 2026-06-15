import { Router } from "express";
import { docker } from "../lib/docker";

const router = Router();

router.get("/docker/info", async (req, res) => {
  try {
    const info = await docker.info();
    res.json({
      serverVersion: info.ServerVersion,
      containers: info.Containers,
      containersRunning: info.ContainersRunning,
      containersPaused: info.ContainersPaused,
      containersStopped: info.ContainersStopped,
      images: info.Images,
      memTotal: info.MemTotal,
      osType: info.OSType,
      architecture: info.Architecture,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get Docker info");
    res.status(500).json({ error: "Docker is not available" });
  }
});

export default router;
