export type WeatherCondition = "sunny" | "cloudy" | "overcast" | "rainy" | "thunderstorm" | "haze" | "snow" | "night";

export interface HourlyForecast {
  time: string; // "HH:MM" format
  temperature: number;
  condition: WeatherCondition;
  description: string;
}

export interface WeatherSnapshot {
  condition: WeatherCondition;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  city: string;
  description: string;
  sunrise: string;
  sunset: string;
  hourlyForecast: HourlyForecast[];
  updatedAt: string;
}

export interface WeatherTheme {
  condition: WeatherCondition;
  backgroundGradient: string;
  particleColor: string;
  particleCount: number;
  glassOpacity: number;
  textColor: string;
  accentColor: string;
}
