import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { WeatherSnapshot } from "../../domain/weather/types";
import {
  fetchCurrentPosition,
  fetchWeatherByCoords,
  reverseGeocode,
} from "../services/weatherService";
import { mockWeather } from "../../storage/seeds/mockData";

export type WeatherStatus = "idle" | "locating" | "fetching" | "success" | "error";

export interface UseWeatherResult {
  weather: WeatherSnapshot;
  status: WeatherStatus;
  error: string | null;
  refresh: () => void;
}

async function fetchWeather(): Promise<WeatherSnapshot> {
  console.log(`[fetchWeather] 开始获取天气数据`);

  let coords;
  try {
    coords = await fetchCurrentPosition();
  } catch (err) {
    console.warn(`[fetchWeather] 定位失败，使用默认坐标:`, err);
    coords = { latitude: 31.2304, longitude: 121.4737 };
  }

  const { latitude: lat, longitude: lon } = coords;
  console.log(`[fetchWeather] 坐标: lat=${lat}, lon=${lon}`);

  let city = "上海";
  let snapshot;

  try {
    [city, snapshot] = await Promise.all([
      reverseGeocode(lat, lon),
      fetchWeatherByCoords(lat, lon, city),
    ]);
  } catch (err) {
    console.warn(`[fetchWeather] 天气/城市获取失败，使用默认:`, err);
    snapshot = {
      condition: "cloudy" as const,
      temperature: 20,
      feelsLike: 19,
      humidity: 65,
      windSpeed: 3.5,
      city,
      description: "多云",
      sunrise: "06:00",
      sunset: "18:00",
      hourlyForecast: [],
      updatedAt: new Date().toISOString(),
    };
  }

  console.log(`[fetchWeather] 完成: city=${city}, weather=${snapshot.description}`);
  return { ...snapshot, city };
}

export function useWeather(): UseWeatherResult {
  const queryClient = useQueryClient();

  const { data, status, error, isPending, isFetching, isSuccess } = useQuery({
    queryKey: ["weather"],
    queryFn: fetchWeather,
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1,
    initialData: undefined,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["weather"] });
  }, [queryClient]);

  const weather = data ?? mockWeather;

  let mappedStatus: WeatherStatus;
  if (isPending) {
    mappedStatus = "locating";
  } else if (isFetching) {
    mappedStatus = "fetching";
  } else if (isSuccess) {
    mappedStatus = "success";
  } else if (status === "error") {
    mappedStatus = "error";
  } else {
    mappedStatus = "idle";
  }

  const errorMessage = error instanceof Error ? error.message : null;
  return {
    weather,
    status: mappedStatus,
    error: errorMessage,
    refresh,
  };
}
