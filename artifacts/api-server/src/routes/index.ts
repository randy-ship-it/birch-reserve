import { Router, type IRouter } from "express";
import healthRouter from "./health";
import marketplaceRouter from "./marketplace";
import launchRouter from "./launch";
import sponsorReservationsRouter from "./sponsorReservations";
import splashAdReservationsRouter from "./splashAdReservations";
import conciergeRouter from "./concierge";
import randyChatRouter from "./randyChat";
import editorialRouter from "./editorial";
import voiceCallEndedRouter from "./voiceCallEnded";

const router: IRouter = Router();

router.use(healthRouter);
router.use(marketplaceRouter);
router.use(launchRouter);
router.use(sponsorReservationsRouter);
router.use(splashAdReservationsRouter);
router.use(conciergeRouter);
router.use(randyChatRouter);
router.use(editorialRouter);
router.use(voiceCallEndedRouter);

export default router;
