'use client';

import { useEffect, useRef, useState } from 'react';

import { MAPBOX_TOKEN } from '@/lib/mapbox-optimization';

export interface GeocodedLocation {
  lat: number;
  lng: number;
  address: string;
}

interface Suggestion extends GeocodedLocation {
  id: string;
}

/** Only the fields we read, so a shape change fails loudly here and not deep in the UI. */
interface GeocodingResponse {
  features?: { id?: string; place_name?: string; center?: [number, number] }[];
}

interface AddressSearchProps {
  onSelect: (location: GeocodedLocation) => void;
  /** The dashboard's current draft location, or null once "Clear Search" is used. */
  draftLocation: GeocodedLocation | null;
}

const GEOCODING_ENDPOINT = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

const RECENT_SEARCHES_KEY = 'smd:recentAddressSearches';
const RECENT_SEARCHES_LIMIT = 5;

function loadRecentSearches(): Suggestion[] {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = raw ? (JSON.parse(raw) as Suggestion[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Floating, debounced address search that geocodes via the Mapbox Places API. */
export function AddressSearch({ onSelect, draftLocation }: AddressSearchProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<Suggestion[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  /** Selecting a suggestion sets `query` to its address, which would otherwise
   *  re-trigger this effect and reopen the dropdown with a fresh search. */
  const justSelected = useRef(false);

  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

  function selectSuggestion(suggestion: Suggestion) {
    justSelected.current = true;
    onSelect(suggestion);
    setQuery(suggestion.address);
    setSuggestions([]);

    const deduped = recentSearches.filter((entry) => entry.address !== suggestion.address);
    const updated = [suggestion, ...deduped].slice(0, RECENT_SEARCHES_LIMIT);
    setRecentSearches(updated);
    try {
      window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch {
      // Storage can be unavailable (private browsing, quota) — recent searches just won't persist.
    }
  }

  // "Clear Search" nulls draftLocation in the parent; the input has to follow.
  useEffect(() => {
    if (draftLocation === null) setQuery('');
  }, [draftLocation]);

  useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 3 || !MAPBOX_TOKEN) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({
        access_token: MAPBOX_TOKEN,
        country: 'il',
        language: 'he',
        autocomplete: 'true',
      });

      try {
        const response = await fetch(
          `${GEOCODING_ENDPOINT}/${encodeURIComponent(trimmed)}.json?${params.toString()}`,
          { signal: controller.signal },
        );
        const data = (await response.json()) as GeocodingResponse;

        setSuggestions(
          (data.features ?? [])
            .filter((feature) => feature.id && feature.place_name && feature.center)
            .map((feature) => ({
              id: feature.id!,
              address: feature.place_name!,
              lng: feature.center![0],
              lat: feature.center![1],
            })),
        );
      } catch {
        if (!controller.signal.aborted) setSuggestions([]);
      }
    }, 300);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className="relative w-full">
      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="חיפוש כתובת..."
          className="w-full rounded-full border border-slate-300 bg-white ps-9 pe-4 py-2.5 text-sm shadow-md focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      {suggestions.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-300 bg-white shadow-md">
          {suggestions.map((suggestion) => (
            <li key={suggestion.id}>
              <button
                type="button"
                className="block w-full truncate px-3 py-2 text-start text-sm hover:bg-[#f9f9f7]"
                onClick={() => selectSuggestion(suggestion)}
              >
                {suggestion.address.replace(/, ישראל|, Israel/g, '')}
              </button>
            </li>
          ))}
        </ul>
      ) : isFocused && query.trim().length === 0 && recentSearches.length > 0 ? (
        <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-300 bg-white shadow-md">
          <li className="px-3 pt-2 pb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            חיפושים אחרונים
          </li>
          {recentSearches.map((suggestion) => (
            <li key={suggestion.id}>
              <button
                type="button"
                className="block w-full truncate px-3 py-2 text-start text-sm hover:bg-[#f9f9f7]"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSuggestion(suggestion)}
              >
                {suggestion.address.replace(/, ישראל|, Israel/g, '')}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
