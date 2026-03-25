export type WeatherCondition = "sunny" | "cloudy" | "rainy" | "snow" | "storm" | "night";

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
