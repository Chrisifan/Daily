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
  if (code === 0) return "晴天";
  if (code === 1 || code === 2) return "多云";
  if (code === 3) return "阴天";
  if (code <= 48) return "雾霾";
  if (code <= 57) return "毛毛雨";
  if (code <= 67) return "小雨";
  if (code <= 77) return "下雪";
  if (code <= 82) return "阵雨";
  if (code <= 86) return "阵雪";
  return "雷雨";
}

// ─── 1. Tauri Geolocation ───────────────────────────────────────────────────
export interface Coords {
  latitude: number;
  longitude: number;
}

async function ensureLocationPermission(): Promise<void> {
  console.log(`[ensureLocationPermission] 检查定位权限状态`);
  const perm = await checkPermissions();
  console.log(`[ensureLocationPermission] 当前权限:`, perm);

  if (perm.location === "prompt" || perm.location === "prompt-with-rationale") {
    console.log(`[ensureLocationPermission] 请求定位权限中...`);
    const result = await requestPermissions(["location"]);
    console.log(`[ensureLocationPermission] 请求结果:`, result);
    if (result.location !== "granted") {
      throw new Error("定位权限被拒绝，请在系统设置中授予定位权限");
    }
  } else if (perm.location === "denied") {
    throw new Error("定位权限被拒绝，请在系统设置中授予定位权限");
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
      console.warn(`[fetchCurrentPosition] 警告: 返回坐标为 (0,0)，可能是定位服务未授权或不可用`);
      throw new Error("定位服务返回无效坐标，请检查系统定位权限设置");
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

  const url = `https://nominatim.openstreetmap.org/reverse?${params}`;
  console.log(`[reverseGeocode] 请求: ${url}`);

  try {
    const res = await fetch(url, { headers: { "User-Agent": "DailyApp/1.0" } });
    console.log(`[reverseGeocode] 响应状态: ${res.status}`);

    if (!res.ok) {
      throw new Error(`Nominatim 请求失败: ${res.status}`);
    }

    const data: NominatimResponse = await res.json();
    console.log(`[reverseGeocode] 解析结果:`, JSON.stringify(data.address));

    const city = data.address?.city
      ?? data.address?.town
      ?? data.address?.county
      ?? data.address?.state;

    console.log(`[reverseGeocode] 解析城市: ${city ?? "未知城市"}`);
    return city ?? "未知城市";
  } catch (err) {
    console.error(`[reverseGeocode] 错误:`, err);
    throw err;
  }
}
