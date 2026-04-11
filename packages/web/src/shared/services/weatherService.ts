import type { HourlyForecast, WeatherCondition, WeatherSnapshot } from "../../domain/weather/types";
import { getCurrentPosition, checkPermissions, requestPermissions } from "@tauri-apps/plugin-geolocation";

// ─── WMO Weather Code → WeatherCondition 映射 ───────────────────────────────────────
// https://open-meteo.com/en/docs#weathervariables
function wmoCodeToCondition(code: number, isNight: boolean): WeatherCondition {
  if (isNight) return "night";
  if (code === 0) return "sunny";
  if (code === 1 || code === 2) return "cloudy";
  if (code === 3) return "overcast";
  if (code <= 48) return "haze"; // fog / depositing rime fog
  if (code <= 67) return "rainy"; // drizzle + rain
  if (code <= 77) return "snow";  // snow / snow grains / ice crystals
  if (code <= 82) return "rainy"; // rain showers
  if (code <= 86) return "snow";  // snow showers
  return "thunderstorm";                  // 95-99 thunderstorm
}

function wmoCodeToDescription(code: number): string {
  if (code === 0) return "home.weather.sunny";
  if (code === 1 || code === 2) return "home.weather.cloudy";
  if (code === 3) return "home.weather.overcast";
  if (code <= 48) return "home.weather.haze";
  if (code <= 57) return "home.weather.rainy";
  if (code <= 67) return "home.weather.rainy";
  if (code <= 77) return "home.weather.snow";
  if (code <= 82) return "home.weather.rainy";
  if (code <= 86) return "home.weather.snow";
  return "home.weather.thunderstorm";
}

// ─── 1. Tauri Geolocation ───────────────────────────────────────────────────
export interface Coords {
  latitude: number;
  longitude: number;
}

async function ensureLocationPermission(): Promise<void> {
  console.log(`[ensureLocationPermission] checking location permission`);
  const perm = await checkPermissions();
  console.log(`[ensureLocationPermission] current permission:`, perm);

  if (perm.location === "prompt" || perm.location === "prompt-with-rationale") {
    console.log(`[ensureLocationPermission] requesting location permission...`);
    const result = await requestPermissions(["location"]);
    console.log(`[ensureLocationPermission] request result:`, result);
    if (result.location !== "granted") {
      throw new Error("Location permission denied. Please enable in system settings.");
    }
  } else if (perm.location === "denied") {
    throw new Error("Location permission denied. Please enable in system settings.");
  }
}

export async function fetchCurrentPosition(): Promise<Coords> {
  try {
    console.log(`[fetchCurrentPosition] 开始获取位置`);
    await ensureLocationPermission();
    const position = await getCurrentPosition();
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    console.log(`[fetchCurrentPosition] 原始数据: lat=${lat}, lon=${lon}, accuracy=${position.coords.accuracy}`);

    if (lat === 0 && lon === 0) {
      console.warn(`[fetchCurrentPosition] warning: got (0,0) coordinates, possibly location service not authorized`);
      throw new Error("Invalid coordinates received. Please check system location settings.");
    }

    console.log(`[fetchCurrentPosition] 成功: lat=${lat}, lon=${lon}`);
    return { latitude: lat, longitude: lon };
  } catch (err) {
    console.error(`[fetchCurrentPosition] 错误:`, err);
    const msg = err instanceof Error ? err.message : "定位失败";
    throw new Error(msg);
  }
}

// ─── 2. Open-Meteo 天气数据 ──────────────────────────────────────────────────
interface OpenMeteoResponse {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    weather_code: number;
    is_day: number;
  };
  daily: {
    sunrise: string[];
    sunset: string[];
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
  };
}

export async function fetchWeatherByCoords(
  lat: number,
  lon: number,
  city: string
): Promise<WeatherSnapshot> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
    daily: "sunrise,sunset",
    hourly: "temperature_2m,weather_code",
    forecast_hours: "6",
    timezone: "auto",
    forecast_days: "1",
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo 请求失败: ${res.status}`);

  const data: OpenMeteoResponse = await res.json();
  const c = data.current;
  const isNight = c.is_day === 0;

  const fmtTime = (iso: string) => iso.slice(11, 16);

  const hourlyForecast: HourlyForecast[] = data.hourly.time.slice(0, 6).map((time, i) => ({
    time: fmtTime(time),
    temperature: Math.round(data.hourly.temperature_2m[i]),
    condition: wmoCodeToCondition(data.hourly.weather_code[i], false),
    description: wmoCodeToDescription(data.hourly.weather_code[i]),
  }));

  return {
    condition: wmoCodeToCondition(c.weather_code, isNight),
    temperature: Math.round(c.temperature_2m),
    feelsLike: Math.round(c.apparent_temperature),
    humidity: c.relative_humidity_2m,
    windSpeed: c.wind_speed_10m,
    city,
    description: wmoCodeToDescription(c.weather_code),
    sunrise: data.daily.sunrise[0] ? fmtTime(data.daily.sunrise[0]) : "--:--",
    sunset: data.daily.sunset[0] ? fmtTime(data.daily.sunset[0]) : "--:--",
    hourlyForecast,
    updatedAt: new Date().toISOString(),
  };
}

// ─── 3. Nominatim Reverse Geocoding ────────────────────────────────────────
interface NominatimResponse {
  address?: {
    city?: string;
    town?: string;
    county?: string;
    state?: string;
    country?: string;
  };
  display_name?: string;
}

export async function reverseGeocode(lat: number, lon: number, lang: string = "en"): Promise<string> {
  const acceptLang = lang.startsWith("zh") ? "zh-CN,en" : "en,zh-CN";
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "json",
    "accept-language": acceptLang,
  });

  const url = `https://nominatim.openstreetmap.org/reverse?${params}`;
  console.log(`[reverseGeocode] request: ${url}`);

  try {
    const res = await fetch(url, { headers: { "User-Agent": "DailyApp/1.0" } });
    console.log(`[reverseGeocode] response status: ${res.status}`);

    if (!res.ok) {
      throw new Error(`Nominatim request failed: ${res.status}`);
    }

    const data: NominatimResponse = await res.json();
    console.log(`[reverseGeocode] parsed result:`, JSON.stringify(data.address));

    const city = data.address?.city
      ?? data.address?.town
      ?? data.address?.county
      ?? data.address?.state;

    console.log(`[reverseGeocode] parsed city: ${city ?? "Unknown"}`);
    return city ?? "Unknown";
  } catch (err) {
    console.error(`[reverseGeocode] error:`, err);
    throw err;
  }
}
