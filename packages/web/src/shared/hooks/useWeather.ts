import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { WeatherSnapshot } from "../../domain/weather/types";
import {
  fetchWeatherByCoords,
} from "../services/weatherService";
import { getStoredSettings } from "../services/settingsService";
import i18n from "../../i18n";

export type WeatherStatus = "idle" | "locating" | "fetching" | "success" | "error" | "unconfigured";

export interface UseWeatherResult {
  weather: WeatherSnapshot;
  status: WeatherStatus;
  error: string | null;
  refresh: () => void;
  needsLocation: boolean;
}

export type WeatherQueryKey = [
  "weather",
  string,
  string | null,
  number | null,
  number | null,
];

export function buildWeatherQueryKey(
  lang: string,
  settings = getStoredSettings(),
): WeatherQueryKey {
  return [
    "weather",
    lang,
    settings.locationCity,
    settings.locationLatitude,
    settings.locationLongitude,
  ];
}

async function fetchWeather(): Promise<WeatherSnapshot> {
  console.log(`[fetchWeather] starting to fetch weather data`);

  const lang = i18n.language || "en";
  const isZh = lang.startsWith("zh");

  const settings = getStoredSettings();

  const hasLocation =
    settings.locationLatitude !== null &&
    settings.locationLongitude !== null &&
    settings.locationCity !== null;

  console.log(`[fetchWeather] hasLocation=${hasLocation}, locationCity=${settings.locationCity}`);

  let city: string;
  let snapshot;
  let lat: number;
  let lon: number;

  if (hasLocation) {
    city = settings.locationCity!;
    lat = settings.locationLatitude!;
    lon = settings.locationLongitude!;
    console.log(`[fetchWeather] using saved location: ${city}, lat=${lat}, lon=${lon}`);
  } else {
    lat = 31.2304;
    lon = 121.4737;
    city = isZh ? "上海" : "Shanghai";
    console.log(`[fetchWeather] using default location: ${city}`);
  }

  console.log(`[fetchWeather] coordinates: lat=${lat}, lon=${lon}`);

  try {
    snapshot = await fetchWeatherByCoords(lat, lon, city);
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
  const isZh = lang.startsWith("zh");
  const settings = getStoredSettings();
  const weatherQueryKey = buildWeatherQueryKey(lang, settings);

  const { data, status, error, isPending, isFetching, isSuccess } = useQuery({
    queryKey: weatherQueryKey,
    queryFn: fetchWeather,
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1,
    initialData: undefined,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: weatherQueryKey });
  }, [queryClient, weatherQueryKey]);

  const needsLocation =
    settings.locationLatitude === null ||
    settings.locationLongitude === null ||
    settings.locationCity === null;

  const defaultWeather: WeatherSnapshot = {
    condition: "cloudy",
    temperature: 20,
    feelsLike: 19,
    humidity: 65,
    windSpeed: 3.5,
    city: isZh ? "上海" : "Shanghai",
    description: isZh ? "home.weather.cloudy" : "home.weather.cloudy",
    sunrise: "06:00",
    sunset: "18:00",
    hourlyForecast: [],
    updatedAt: new Date().toISOString(),
  };

  const weather = data ?? defaultWeather;

  let mappedStatus: WeatherStatus;
  if (isPending) {
    mappedStatus = "locating";
  } else if (isFetching) {
    mappedStatus = "fetching";
  } else if (isSuccess) {
    mappedStatus = "success";
  } else if (status === "error") {
    mappedStatus = "error";
  } else if (needsLocation && !data) {
    mappedStatus = "unconfigured";
  } else {
    mappedStatus = "idle";
  }

  const errorMessage = error instanceof Error ? error.message : null;
  return {
    weather,
    status: mappedStatus,
    error: errorMessage,
    refresh,
    needsLocation,
  };
}
