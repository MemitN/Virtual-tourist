import { z } from "zod";
import type { Destination, LiveContext } from "@/lib/types";

const openMeteoSchema = z.object({
  current: z.object({
    temperature_2m: z.number(),
    weather_code: z.number(),
  }),
});

/** WMO weather interpretation codes -> friendly text. */
function describeWeatherCode(code: number): string {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Foggy";
  if (code >= 51 && code <= 57) return "Drizzle";
  if (code >= 61 && code <= 67) return "Rain";
  if (code >= 71 && code <= 77) return "Snow";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code === 85 || code === 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Variable conditions";
}

/** e.g. "Tue 3:42 PM" in the destination's own timezone. */
export function formatLocalTime(timezone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(now);
  } catch {
    return now.toUTCString();
  }
}

export function getLocalHour(timezone: string, now: Date = new Date()): number {
  try {
    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now);
    const parsed = Number.parseInt(hour, 10);
    return Number.isNaN(parsed) ? now.getUTCHours() : parsed;
  } catch {
    return now.getUTCHours();
  }
}

export function getDayPart(timezone: string, now: Date = new Date()): string {
  const h = getLocalHour(timezone, now);
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

export async function fetchWeather(
  lat: number,
  lng: number,
  timezone: string,
): Promise<{ temp: number; conditions: string }> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lng));
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set("timezone", timezone);

  const response = await fetch(url, {
    signal: AbortSignal.timeout(4000),
    next: { revalidate: 60 },
  });
  if (!response.ok) throw new Error(`Open-Meteo responded ${response.status}`);

  const parsed = openMeteoSchema.parse(await response.json());
  return {
    temp: Math.round(parsed.current.temperature_2m),
    conditions: describeWeatherCode(parsed.current.weather_code),
  };
}

/** Never throws: if Open-Meteo is down the guide and UI still work with local time only. */
export async function getLiveContext(destination: Destination): Promise<LiveContext> {
  const localTime = formatLocalTime(destination.timezone);
  try {
    const { temp, conditions } = await fetchWeather(
      destination.lat,
      destination.lng,
      destination.timezone,
    );
    return { localTime, weather: `${conditions}, ${temp}°C`, temp, conditions };
  } catch {
    return {
      localTime,
      weather: "Weather unavailable",
      temp: 0,
      conditions: "Unknown",
    };
  }
}
