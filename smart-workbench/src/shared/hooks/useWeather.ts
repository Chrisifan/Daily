import { useState, useEffect } from "react";
import type { WeatherSnapshot } from "../../domain/weather/types";
import {
  getCurrentPosition,
  fetchWeatherByCoords,
  reverseGeocode,
} from "../services/weatherService";
import { mockWeather } from "../../storage/seeds/mockData";

export type WeatherStatus = "idle" | "locating" | "fetching" | "success" | "error";

export interface UseWeatherResult {
  weather: WeatherSnapshot;
  status: WeatherStatus;
  error: string | null;
  /** 手动重新获取 */
  refresh: () => void;
}

export function useWeather(): UseWeatherResult {
  const [weather, setWeather] = useState<WeatherSnapshot>(mockWeather);
  const [status, setStatus] = useState<WeatherStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Step 1: 获取定位
        setStatus("locating");
        const coords = await getCurrentPosition();
        if (cancelled) return;

        const { latitude: lat, longitude: lon } = coords;

        // Step 2: 并行请求天气 + 城市名
        setStatus("fetching");
        const [city, snapshot] = await Promise.all([
          reverseGeocode(lat, lon),
          // 先用占位城市，等 geocode 结果后再合并
          fetchWeatherByCoords(lat, lon, ""),
        ]);
        if (cancelled) return;

        setWeather({ ...snapshot, city });
        setStatus("success");
        setError(null);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "天气获取失败";
        console.warn("[useWeather]", msg);
        setError(msg);
        setStatus("error");
        // fallback 保持 mockWeather，不覆盖 state
      }
    }

    load();
    return () => { cancelled = true; };
  }, [tick]);

  const refresh = () => setTick((n) => n + 1);

  return { weather, status, error, refresh };
}
