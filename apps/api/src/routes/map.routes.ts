import { Router } from 'express';
import { requireAuth } from '../middleware/authenticate';
import { getMapConfig } from '../controllers/map.controller';

export const mapRouter = Router();

mapRouter.get('/config', requireAuth, getMapConfig);
