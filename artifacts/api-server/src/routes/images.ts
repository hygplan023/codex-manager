import { Router } from "express";
import { docker } from "../lib/docker";

const router = Router();

router.get("/images", async (req, res) => {
  try {
    const images = await docker.listImages({ all: false });
    const result = images.map((img) => ({
      id: img.Id,
      repoTags: img.RepoTags || [],
      size: img.Size,
      created: img.Created,
    }));
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to list images");
    res.status(500).json({ error: "Failed to list images" });
  }
});

router.delete("/images/:id", async (req, res) => {
  try {
    const image = docker.getImage(req.params.id);
    await image.remove({ force: true });
    res.json({ success: true, message: "镜像已删除" });
  } catch (err: unknown) {
    req.log.error({ err }, "Failed to remove image");
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, message: msg });
  }
});

export default router;
