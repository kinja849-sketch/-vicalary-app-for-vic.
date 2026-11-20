import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface GeocodeResult {
  city: string;
  region: string;
  country: string;
  country_code: string;
  formatted_location: string;
  provider: 'google' | 'bigdatacloud' | 'nominatim' | 'fallback';
}

/**
 * Reverse geocode latitude and longitude into specific city/town/province + country.
 * Priority 1: Google Maps Geocoding API (using GOOGLE_MAPS_API_KEY or NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)
 * Priority 2: BigDataCloud Reverse Geocoding API (free, reliable client-friendly reverse geocoding)
 * Priority 3: OpenStreetMap Nominatim
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const lat = typeof body.lat === 'number' ? body.lat : parseFloat(body.lat);
    const lng = typeof body.lng === 'number' ? body.lng : parseFloat(body.lng);

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json(
        { error: 'Invalid or missing coordinates (lat, lng required)' },
        { status: 400 }
      );
    }

    const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    // 1. Google Maps Geocoding API
    if (googleMapsKey && !googleMapsKey.includes('placeholder')) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const googleUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleMapsKey}&result_type=locality|sublocality|administrative_area_level_2|administrative_area_level_1|country`;
        const res = await fetch(googleUrl, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (data.status === 'OK' && Array.isArray(data.results) && data.results.length > 0) {
            const parsed = parseGoogleGeocodeResponse(data.results);
            if (parsed.country) {
              return NextResponse.json({ ...parsed, provider: 'google', latitude: lat, longitude: lng });
            }
          }
        }
      } catch (err: any) {
        console.warn('[Geocode API] Google Maps Geocoding attempt failed:', err?.message);
      }
    }

    // 2. BigDataCloud Reverse Geocode (free, high-precision, no API key required)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
      const res = await fetch(bdcUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const city = data.city || data.locality || data.principalSubdivision || '';
        const region = data.principalSubdivision || '';
        const country = data.countryName || '';
        const countryCode = (data.countryCode || '').toUpperCase();

        if (country) {
          const primaryLoc = city || region;
          const formatted = primaryLoc && country ? `${primaryLoc}, ${country}` : (primaryLoc || country);
          return NextResponse.json({
            city: primaryLoc,
            region,
            country,
            country_code: countryCode,
            formatted_location: formatted,
            provider: 'bigdatacloud',
            latitude: lat,
            longitude: lng
          });
        }
      }
    } catch (err: any) {
      console.warn('[Geocode API] BigDataCloud reverse geocode failed:', err?.message);
    }

    // 3. OpenStreetMap Nominatim Reverse Geocoding
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12&addressdetails=1`;
      const res = await fetch(nomUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'VicalaryHealthCoach/1.0' }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.municipality || addr.suburb || addr.village || addr.county || '';
        const region = addr.state || addr.province || addr.region || '';
        const country = addr.country || '';
        const countryCode = (addr.country_code || '').toUpperCase();

        if (country) {
          const primaryLoc = city || region;
          const formatted = primaryLoc && country ? `${primaryLoc}, ${country}` : (primaryLoc || country);
          return NextResponse.json({
            city: primaryLoc,
            region,
            country,
            country_code: countryCode,
            formatted_location: formatted,
            provider: 'nominatim',
            latitude: lat,
            longitude: lng
          });
        }
      }
    } catch (err: any) {
      console.warn('[Geocode API] Nominatim reverse geocode failed:', err?.message);
    }

    return NextResponse.json(
      {
        city: '',
        region: '',
        country: '',
        country_code: '',
        formatted_location: 'Unknown Location',
        provider: 'fallback',
        latitude: lat,
        longitude: lng
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[Geocode API] Unexpected error:', err);
    return NextResponse.json({ error: err?.message || 'Geocoding failed' }, { status: 500 });
  }
}

function parseGoogleGeocodeResponse(results: any[]): Omit<GeocodeResult, 'provider'> {
  let city = '';
  let sublocality = '';
  let county = '';
  let state = '';
  let country = '';
  let countryCode = '';

  for (const res of results) {
    for (const comp of (res.address_components || [])) {
      const types: string[] = comp.types || [];
      if (!city && (types.includes('locality') || types.includes('postal_town'))) {
        city = comp.long_name;
      } else if (!sublocality && (types.includes('sublocality') || types.includes('sublocality_level_1'))) {
        sublocality = comp.long_name;
      } else if (!county && types.includes('administrative_area_level_2')) {
        county = comp.long_name;
      } else if (!state && types.includes('administrative_area_level_1')) {
        state = comp.long_name;
      } else if (!country && types.includes('country')) {
        country = comp.long_name;
        countryCode = (comp.short_name || '').toUpperCase();
      }
    }
  }

  const primaryLocality = city || sublocality || county || state || '';
  const formatted = primaryLocality && country ? `${primaryLocality}, ${country}` : (primaryLocality || country);

  return {
    city: primaryLocality,
    region: state || county,
    country,
    country_code: countryCode,
    formatted_location: formatted
  };
}
