import type { WeatherCondition, WeatherSnapshot } from "../../domain/weather/types";

// ─── WMO Weather Code → WeatherCondition 映射 ───────────────────────────────
// https://open-meteo.com/en/docs#weathervariables
function wmoCodeToCondition(code: number, isNight: boolean): WeatherCondition {
  if (isNight) return "night";
  if (code === 0) return "sunny";
  if (code <= 3) return "cloudy";
  if (code <= 48) return "cloudy"; // fog / depositing rime fog
  if (code <= 67) return "rainy"; // drizzle + rain
  if (code <= 77) return "snow";  // snow / snow grains / ice crystals
  if (code <= 82) return "rainy"; // rain showers
  if (code <= 86) return "snow";  // snow showers
  return "storm";                  // 95-99 thunderstorm
}

function wmoCodeToDescription(code: number): string {
  if (code === 0) return "晴天";
  if (code <= 3) return "多云";
  if (code <= 48) return "雾";
  if (code <= 57) return "毛毛雨";
  if (code <= 67) return "小雨";
  if (code <= 77) return "下雪";
  if (code <= 82) return "阵雨";
  if (code <= 86) return "阵雪";
  return "雷暴";
}

// ─── 1. 浏览器 Geolocation ───────────────────────────────────────────────────
export function getCurrentPosition(): Promise<GeolocationCoordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("浏览器不支持 Geolocation API"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords),
      (err) => reject(new Error(`定位失败: ${err.message}`)),
      { timeout: 10000, maximumAge: 5 * 60 * 1000 } // 5 分钟缓存
    );
  });
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
    timezone: "auto",
    forecast_days: "1",
  });

  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Open-Meteo 请求失败: ${res.status}`);

  const data: OpenMeteoResponse = await res.json();
  const c = data.current;
  const isNight = c.is_day === 0;

  // 格式化 sunrise/sunset 为 HH:MM
  const fmtTime = (iso: string) => iso.slice(11, 16); // "2026-03-25T06:15" → "06:15"

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
    updatedAt: new Date().toISOString(),
  };
}

// ─── 3. Nominatim 反向地理编码 ───────────────────────────────────────────────
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

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "json",
    "accept-language": "zh-CN",
  });

  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?${params}`,
    { headers: { "User-Agent": "DailyApp/1.0" } }
  );
  if (!res.ok) throw new Error(`Nominatim 请求失败: ${res.status}`);

  const data: NominatimResponse = await res.json();
  // 优先取 city，其次 town/county/state
  return (
    data.address?.city ??
    data.address?.town ??
    data.address?.county ??
    data.address?.state ??
    "未知城市"
  );
}
