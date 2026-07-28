import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from './auth.routes';
import { recoveryCaseRouter } from './recoveryCase.routes';
import { deviceRouter } from './device.routes';

export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/recovery-cases', recoveryCaseRouter);
apiRouter.use('/devices', deviceRouter);
