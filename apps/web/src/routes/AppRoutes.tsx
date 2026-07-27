import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { HealthCheckPage } from '../pages/HealthCheckPage';
import { NotFoundPage } from '../pages/NotFoundPage';

/**
 * Temporary route table for Part 1. Auth-aware routing (/login, /dashboard,
 * /recovery/:caseId, route guards, etc.) is built out starting Part 3.
 */
export function AppRoutes(): ReactElement {
  return (
    <Routes>
      <Route path="/" element={<HealthCheckPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
