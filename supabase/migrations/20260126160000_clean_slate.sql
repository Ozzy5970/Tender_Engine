-- Clean Slate: Remove all user generated data for testing
-- DOES NOT delete Templates, Profiles (Users), or Subscriptions

BEGIN;

-- 1. Remove Tenders and related requirements/risks
DELETE FROM compliance_requirements;
DELETE FROM tenders;

-- 2. Remove Compliance Documents
DELETE FROM compliance_documents;

-- 3. Reset Legal Consents (Optional, if they want to re-accept terms)
-- DELETE FROM legal_consents;

COMMIT;
