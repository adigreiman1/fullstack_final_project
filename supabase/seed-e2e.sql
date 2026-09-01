-- ============================================================
-- Service Mobility Dashboard
-- E2E Test Data Fixture
--
-- Purpose:
-- Creates a deterministic service task for the E2E-02
-- recommendation flow.
--
-- Run this script manually in the Supabase SQL Editor before
-- running the Playwright E2E suite.
--
-- This is test setup data, not an application migration.
-- ============================================================

-- Remove the previous E2E recommendation fixture, if it exists.
DELETE FROM public.service_tasks
WHERE customer_name = 'E2E Recommendation Test';

-- Create a fresh recommendation candidate for tomorrow.
INSERT INTO public.service_tasks (
  address,
  lat,
  lng,
  time_window,
  vehicle_id,
  installer_name,
  car_plate,
  customer_name,
  customer_phone,
  status,
  short_note,
  scheduled_date
)
VALUES (
  'דיזנגוף 10, תל אביב',
  32.0853,
  34.7818,
  '10:00-12:00',
  'E2E-VEHICLE',
  'E2E Tester',
  'E2E-001',
  'E2E Recommendation Test',
  '0500000000',
  'PENDING',
  'E2E test fixture - recommendation flow',
  (NOW() AT TIME ZONE 'Asia/Jerusalem')::date + 1
);

-- Verify the current fixture.
SELECT
  scheduled_date,
  vehicle_id,
  address,
  lat,
  lng,
  customer_name
FROM public.service_tasks
WHERE customer_name = 'E2E Recommendation Test';