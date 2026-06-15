import { Router } from "express";
import { docker } from "../lib/docker";

const router = Router();

router.get("/containers", async (req, res) => {
  try {
    const all = req.query.all === "true" || req.query.all === "1";
    const containers = await docker.listContainers({ all });
    const result = containers.map((c) => ({
      id: c.Id,
      names: c.Names,
      image: c.Image,
      status: c.Status,
      state: c.State,
      created: c.Created,
      ports: (c.Ports || []).map((p) => ({
        privatePort: p.PrivatePort,
        publicPort: p.PublicPort ?? null,
        type: p.Type,
      })),
    }));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list containers");
    res.status(500).json({ error: "Failed to list containers" });
  }
});

router.post("/containers/:id/start", async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.start();
    res.json({ success: true, message: "容器已启动" });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to start container");
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

router.post("/containers/:id/stop", async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.stop();
    res.json({ success: true, message: "容器已停止" });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to stop container");
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

router.post("/containers/:id/restart", async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.restart();
    res.json({ success: true, message: "容器已重启" });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to restart container");
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

router.delete("/containers/:id", async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    await container.remove({ force: true });
    res.json({ success: true, message: "容器已删除" });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to remove container");
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

router.get("/containers/:id/logs", async (req, res) => {
  try {
    const container = docker.getContainer(req.params.id);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: 100,
    });
    const logStr = logs
      .toString("utf8")
      .split("\n")
      .map((line) => {
        // Docker multiplexed stream: first 8 bytes are header
        if (line.length > 8) {
          const stripped = line.slice(8);
          return stripped;
        }
        return line;
      })
      .join("\n");
    res.json({ logs: logStr, containerId: req.params.id });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to get container logs");
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

export default router;
