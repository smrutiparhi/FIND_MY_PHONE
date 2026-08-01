import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { EVIDENCE_MAX_FILE_SIZE_BYTES } from '@recoverai/shared';
import { ValidationError } from '../lib/errors';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: EVIDENCE_MAX_FILE_SIZE_BYTES, files: 1 },
});

/**
 * Wraps multer's callback-style single-file parser so a too-large or
 * malformed multipart request becomes a normal 400 ValidationError through
 * the app's own error envelope, instead of an uncaught error reaching the
 * generic 500 path. The actual type/size allow-list check still happens in
 * evidenceValidation.ts - this only catches multer's own parsing failures.
 */
export function evidenceUploadMiddleware(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      next(new ValidationError(`File is too large. Maximum size is ${Math.floor(EVIDENCE_MAX_FILE_SIZE_BYTES / (1024 * 1024))} MB.`));
      return;
    }
    next(new ValidationError('Could not process the uploaded file.'));
  });
}
