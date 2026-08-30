import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/lib/supabase-server', () => ({
  createServerSupabase: vi.fn(),
}));

import { getRecommendations } from '@/actions/tasks';
import { createServerSupabase } from '@/lib/supabase-server';

const mockedCreateServerSupabase = vi.mocked(createServerSupabase);

function createSupabaseMock() {
  const lte = vi.fn().mockResolvedValue({ data: [], error: null });
  const gte = vi.fn().mockReturnValue({ lte });
  const select = vi.fn().mockReturnValue({ gte });
  const from = vi.fn().mockReturnValue({ select });
  const getClaims = vi.fn().mockResolvedValue({
    data: { claims: { sub: 'test-user' } },
    error: null,
  });

  return {
    auth: { getClaims },
    from,
  };
}

describe('getRecommendations coordinate validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateServerSupabase.mockResolvedValue(createSupabaseMock() as never);
  });

  test.each([
    { lat: 91, lng: 34, label: 'latitude above 90' },
    { lat: -91, lng: 34, label: 'latitude below -90' },
    { lat: 32, lng: 181, label: 'longitude above 180' },
    { lat: 32, lng: -181, label: 'longitude below -180' },
    { lat: Number.NaN, lng: 34, label: 'NaN latitude' },
    { lat: Number.POSITIVE_INFINITY, lng: 34, label: 'infinite latitude' },
    { lat: 32, lng: Number.NaN, label: 'NaN longitude' },
    { lat: 32, lng: Number.NEGATIVE_INFINITY, label: 'infinite longitude' },
  ])('rejects $label before accessing Supabase', async ({ lat, lng }) => {
    const result = await getRecommendations(lat, lng);

    expect(result).toEqual([]);
    expect(mockedCreateServerSupabase).not.toHaveBeenCalled();
  });

  test.each([
    { lat: 90, lng: 180, label: 'positive boundaries' },
    { lat: -90, lng: -180, label: 'negative boundaries' },
    { lat: 0, lng: 0, label: 'zero coordinates' },
    { lat: 32.0853, lng: 34.7818, label: 'ordinary valid coordinates' },
  ])('accepts $label and continues to the protected server flow', async ({ lat, lng }) => {
    const result = await getRecommendations(lat, lng);

    expect(result).toEqual([]);
    expect(mockedCreateServerSupabase).toHaveBeenCalledTimes(1);
  });
});
