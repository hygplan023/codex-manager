import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dockerRouter from "./docker";
import containersRouter from "./containers";
import imagesRouter from "./images";
import volumesRouter from "./volumes";
import ollamaRouter from "./ollama";
import servicesRouter from "./services";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dockerRouter);
router.use(containersRouter);
router.use(imagesRouter);
router.use(volumesRouter);
router.use(ollamaRouter);
router.use(servicesRouter);

export default router;
