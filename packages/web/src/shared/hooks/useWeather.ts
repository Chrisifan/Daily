import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { WeatherSnapshot } from "../../domain/weather/types";
import {
  fetchCurrentPosition,
  fetchWeatherByCoords,
  reverseGeocode,
} from "../services/weatherService";
import { mockWeather } from "../../storage/seeds/mockData";
import i18n from "../../i18n";

export type WeatherStatus = "idle" | "locating" | "fetching" | "success" | "error";

export interface UseWeatherResult {
  weather: WeatherSnapshot;
  status: WeatherStatus;
  error: string | null;
  refresh: () => void;
}

async function fetchWeather(): Promise<WeatherSnapshot> {
  console.log(`[fetchWeather] starting to fetch weather data`);

  const lang = i18n.language || "en";
  const isZh = lang.startsWith("zh");

  let coords;
  try {
    coords = await fetchCurrentPosition();
  } catch (err) {
    console.warn(`[fetchWeather] location failed, using default coordinates:`, err);
    coords = { latitude: 31.2304, longitude: 121.4737 };
  }

  const { latitude: lat, longitude: lon } = coords;
  console.log(`[fetchWeather] coordinates: lat=${lat}, lon=${lon}`);

  let city = isZh ? "上海" : "Shanghai";
  let snapshot;

  try {
    [city, snapshot] = await Promise.all([
      reverseGeocode(lat, lon, lang),
      fetchWeatherByCoords(lat, lon, city),
    ]);
  } catch (err) {
    console.warn(`[fetchWeather] weather/city fetch failed, using defaults:`, err);
    snapshot = {
      condition: "cloudy" as const,
      temperature: 20,
      feelsLike: 19,
      humidity: 65,
      windSpeed: 3.5,
      city,
      description: isZh ? "home.weather.cloudy" : "home.weather.cloudy",
      sunrise: "06:00",
      sunset: "18:00",
      hourlyForecast: [],
      updatedAt: new Date().toISOString(),
    };
  }

  console.log(`[fetchWeather] complete: city=${city}, weather=${snapshot.description}`);
  return { ...snapshot, city };
}

export function useWeather(): UseWeatherResult {
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const lang = i18n.language || "en";

  const { data, status, error, isPending, isFetching, isSuccess } = useQuery({
    queryKey: ["weather", lang],
    queryFn: fetchWeather,
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1,
    initialData: undefined,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["weather", lang] });
  }, [queryClient, lang]);

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
