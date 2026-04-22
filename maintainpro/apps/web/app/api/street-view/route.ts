import { NextRequest, NextResponse } from "next/server";

const RAPIDAPI_HOST = "google-map-places.p.rapidapi.com";
const STREET_VIEW_ENDPOINT = `https://${RAPIDAPI_HOST}/maps/api/streetview`;
const DEFAULT_SIZE = "600x400";

const normalizeNumber = (
  value: string | null,
  options?: {
    min?: number;
    max?: number;
  }
) => {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (typeof options?.min === "number" && parsed < options.min) {
    return null;
  }

  if (typeof options?.max === "number" && parsed > options.max) {
    return null;
  }

  return parsed;
};

const normalizeSize = (value: string | null) => {
  if (!value) {
    return DEFAULT_SIZE;
  }

  const match = /^(\d{2,4})x(\d{2,4})$/i.exec(value.trim());
  if (!match) {
    return DEFAULT_SIZE;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return DEFAULT_SIZE;
  }

  const clampedWidth = Math.min(Math.max(width, 120), 1280);
  const clampedHeight = Math.min(Math.max(height, 120), 1280);

  return `${clampedWidth}x${clampedHeight}`;
};

export async function GET(request: NextRequest) {
  const rapidApiKey = process.env.RAPIDAPI_GOOGLE_MAP_PLACES_KEY?.trim();

  if (!rapidApiKey) {
    return NextResponse.json({ message: "Street View is not configured" }, { status: 503 });
  }

  const latitude = normalizeNumber(request.nextUrl.searchParams.get("lat"), {
    min: -90,
    max: 90
  });
  const longitude = normalizeNumber(request.nextUrl.searchParams.get("lng"), {
    min: -180,
    max: 180
  });

  if (latitude === null || longitude === null) {
    return NextResponse.json({ message: "Valid lat and lng query parameters are required" }, { status: 400 });
  }

  const heading = normalizeNumber(request.nextUrl.searchParams.get("heading"), {
    min: 0,
    max: 360
  });
  const pitch = normalizeNumber(request.nextUrl.searchParams.get("pitch"), {
    min: -90,
    max: 90
  });
  const fov = normalizeNumber(request.nextUrl.searchParams.get("fov"), {
    min: 10,
    max: 120
  });

  const upstreamUrl = new URL(STREET_VIEW_ENDPOINT);
  upstreamUrl.searchParams.set("size", normalizeSize(request.nextUrl.searchParams.get("size")));
  upstreamUrl.searchParams.set("source", "default");
  upstreamUrl.searchParams.set("return_error_code", "true");
  upstreamUrl.searchParams.set("location", `${latitude},${longitude}`);

  if (heading !== null) {
    upstreamUrl.searchParams.set("heading", heading.toString());
  }

  if (pitch !== null) {
    upstreamUrl.searchParams.set("pitch", pitch.toString());
  }

  if (fov !== null) {
    upstreamUrl.searchParams.set("fov", fov.toString());
  }

  const upstreamResponse = await fetch(upstreamUrl, {
    headers: {
      "x-rapidapi-key": rapidApiKey,
      "x-rapidapi-host": RAPIDAPI_HOST
    },
    cache: "force-cache"
  });

  if (!upstreamResponse.ok) {
    return new NextResponse("Street View unavailable", {
      status: upstreamResponse.status,
      headers: {
        "Cache-Control": "public, max-age=300"
      }
    });
  }

  const contentType = upstreamResponse.headers.get("content-type") ?? "image/jpeg";
  const imageBuffer = await upstreamResponse.arrayBuffer();

  return new NextResponse(imageBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400"
    }
  });
}