'use client';

import { useEffect } from 'react';
import { captureAcquisition } from '@/lib/acquisition';

/**
 * AcquisitionCapture — records how the visit began, on the first page load.
 *
 * The estimate form reads the stored value when it is sent. Capturing only at
 * send time would see the previous internal page as the referrer and record
 * the form itself as the landing page. Mounted once from the layout; renders
 * nothing; stores only a referrer host and a landing path (lib/acquisition.ts).
 */
export default function AcquisitionCapture() {
  useEffect(() => {
    captureAcquisition();
  }, []);
  return null;
}
