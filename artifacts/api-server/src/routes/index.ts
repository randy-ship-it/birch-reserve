import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketplaceRouter from "./marketplace";
import launchRouter from "./launch";
import sponsorReservationsRouter from "./sponsorReservations";
import splashAdReservationsRouter from "./splashAdReservations";
import conciergeRouter from "./concierge";
import editorialRouter from "./editorial";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketplaceRouter);
router.use(launchRouter);
router.use(sponsorReservationsRouter);
router.use(splashAdReservationsRouter);
router.use(conciergeRouter);
router.use(editorialRouter);

export default router;
