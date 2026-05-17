-- A. Critical / Red
SELECT public.log_system_error(
  'TEST - TenderDetails',
  'TEST critical: readiness score failed to save',
  'Error: TEST critical\n  at TEST',
  'critical',
  'TEST:CRITICAL:READINESS_SCORE_SAVE',
  '{"test": true, "area": "readiness", "action": "update_readiness_score", "expectedAdminResponse": "urgent"}'::jsonb
);

-- B. Warning / Yellow (Call 1)
SELECT public.log_system_error(
  'TEST - DocumentUploadModal',
  'TEST warning: AI extraction failed but manual fallback is available',
  'Warning: TEST warning\n  at TEST',
  'warning',
  'TEST:WARNING:AI_EXTRACTION_FALLBACK',
  '{"test": true, "area": "document_upload", "docType": "cidb_cert", "failureType": "edge_error_payload", "expectedAdminResponse": "review"}'::jsonb
);

-- B. Warning / Yellow (Call 2 - Dedupe test)
SELECT public.log_system_error(
  'TEST - DocumentUploadModal',
  'TEST warning: AI extraction failed but manual fallback is available',
  'Warning: TEST warning\n  at TEST',
  'warning',
  'TEST:WARNING:AI_EXTRACTION_FALLBACK',
  '{"dedupe_test_added": true}'::jsonb
);

-- C. Info / Low
SELECT public.log_system_error(
  'TEST - System',
  'TEST info: non-blocking diagnostic event',
  'Info: TEST info\n  at TEST',
  'info',
  'TEST:INFO:NON_BLOCKING_DIAGNOSTIC',
  '{"test": true, "area": "diagnostics", "expectedAdminResponse": "weekly_review"}'::jsonb
);
