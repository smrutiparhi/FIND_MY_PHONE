import { Router } from 'express';
import { requireAuth } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import { deleteMe, getMe, updateMe } from '../controllers/auth.controller';
import { updateProfileSchema } from '../validation/schemas/auth.schemas';

/**
 * Registration, login, logout, and password reset all happen client-side
 * via supabase-js talking directly to Supabase (see docs/ARCHITECTURE.md) -
 * credentials never pass through this backend, and Supabase's own platform
 * rate-limits those endpoints. Everything here operates on the already-
 * authenticated caller (req.user, set by requireAuth), never on a
 * credential.
 */
export const authRouter = Router();

authRouter.get('/me', requireAuth, asyncHandler(getMe));
authRouter.patch('/me', requireAuth, validate(updateProfileSchema), asyncHandler(updateMe));
authRouter.delete('/account', requireAuth, asyncHandler(deleteMe));
