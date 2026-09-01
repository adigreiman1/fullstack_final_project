'use client';

import { useEffect, useRef, useState } from 'react';

export interface GeocodedLocation {
  lat: number;
  lng: number;
  address: string;
}

/** An Autocomplete prediction — no coordinates yet, those need a Place Details call. */
interface Suggestion {
  id: string;
  address: string;
}

interface RecentSearch extends GeocodedLocation {
  id: string;
}

/** Only the fields we read, so a shape change fails loudly here and not deep in the UI. */
interface AutocompleteResponse {
  suggestions?: { placePrediction?: { placeId?: string; text?: { text?: string } } }[];
}

interface PlaceDetailsResponse {
  location?: { latitude?: number; longitude?: number };
}

interface AddressSearchProps {
  onSelect: (location: GeocodedLocation) => void;
}

const AUTOCOMPLETE_ENDPOINT = 'https://places.googleapis.com/v1/places:autocomplete';
const PLACE_DETAILS_ENDPOINT = 'https://places.googleapis.com/v1/places';

const GOOGLE_PLACES_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

const RECENT_SEARCHES_KEY = 'smd:recentAddressSearches';
const RECENT_SEARCHES_LIMIT = 5;

function loadRecentSearches(): RecentSearch[] {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    const parsed = raw ? (JSON.parse(raw) as RecentSearch[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Resolves the lat/lng for a place prediction via the Places API (New) Place Details endpoint. */
async function fetchPlaceLocation(
  placeId: string,
  signal: AbortSignal,
): Promise<{ lat: number; lng: number } | null> {
  const response = await fetch(`${PLACE_DETAILS_ENDPOINT}/${placeId}`, {
    signal,
    headers: {
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'location',
    },
  });
  const data = (await response.json()) as PlaceDetailsResponse;
  const { latitude, longitude } = data.location ?? {};
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return null;
  return { lat: latitude, lng: longitude };
}

/** Floating, debounced address search that autocompletes via the Google Places API (New). */
export function AddressSearch({ onSelect }: AddressSearchProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() =>
    typeof window === 'undefined' ? [] : loadRecentSearches(),
  );
  const [isFocused, setIsFocused] = useState(false);
  /** Selecting a suggestion sets `query` to its address, which would otherwise
   *  re-trigger this effect and reopen the dropdown with a fresh search. */
  const justSelected = useRef(false);
  /** Pairs one Autocomplete session with its resolving Place Details call, per
   *  Google's session-token billing model; a fresh token starts after each resolution. */
  const sessionToken = useRef(crypto.randomUUID());


  function rememberSearch(location: RecentSearch) {
    setRecentSearches((current) => {
      const deduped = current.filter((entry) => entry.address !== location.address);
      const updated = [location, ...deduped].slice(0, RECENT_SEARCHES_LIMIT);
      try {
        window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // Storage can be unavailable (private browsing, quota) — recent searches just won't persist.
      }
      return updated;
    });
  }

  function selectRecent(recent: RecentSearch) {
    justSelected.current = true;
    onSelect(recent);
    setQuery(recent.address);
    setSuggestions([]);
    rememberSearch(recent);
  }

  async function selectSuggestion(suggestion: Suggestion) {
    justSelected.current = true;
    setQuery(suggestion.address);
    setSuggestions([]);

    const controller = new AbortController();
    let location: { lat: number; lng: number } | null;
    try {
      location = await fetchPlaceLocation(suggestion.id, controller.signal);
    } catch {
      location = null;
    }
    // A new Autocomplete session starts once this one has been resolved to a place.
    sessionToken.current = crypto.randomUUID();
    if (!location) return;

    const resolved: RecentSearch = { id: suggestion.id, address: suggestion.address, ...location };
    onSelect(resolved);
    rememberSearch(resolved);
  }


  useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false;
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 3 || !GOOGLE_PLACES_API_KEY) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(AUTOCOMPLETE_ENDPOINT, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
            'X-Goog-FieldMask':
              'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text',
          },
          body: JSON.stringify({
            input: trimmed,
            languageCode: 'he',
            includedRegionCodes: ['il'],
            sessionToken: sessionToken.current,
          }),
        });
        const data = (await response.json()) as AutocompleteResponse;

        setSuggestions(
          (data.suggestions ?? [])
            .map((entry) => entry.placePrediction)
            .filter(
              (prediction): prediction is { placeId: string; text: { text: string } } =>
                Boolean(prediction?.placeId && prediction?.text?.text),
            )
            .map((prediction) => ({ id: prediction.placeId, address: prediction.text.text })),
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
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            if (value.trim().length < 3 || !GOOGLE_PLACES_API_KEY) setSuggestions([]);
          }}
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
                onClick={() => void selectSuggestion(suggestion)}
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
          {recentSearches.map((recent) => (
            <li key={recent.id}>
              <button
                type="button"
                className="block w-full truncate px-3 py-2 text-start text-sm hover:bg-[#f9f9f7]"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectRecent(recent)}
              >
                {recent.address.replace(/, ישראל|, Israel/g, '')}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
