export interface City {
  id: string;
  nameZh: string;
  nameEn: string;
  latitude: number;
  longitude: number;
  country: string;
}

const LOCATION_API_BASE = `${import.meta.env.VITE_SERVICE_URL || "http://localhost:3001"}/api/location`;

export const FEATURED_CITIES: City[] = [
  { id: "beijing", nameZh: "北京", nameEn: "Beijing", latitude: 39.9042, longitude: 116.4074, country: "CN" },
  { id: "shanghai", nameZh: "上海", nameEn: "Shanghai", latitude: 31.2304, longitude: 121.4737, country: "CN" },
  { id: "guangzhou", nameZh: "广州", nameEn: "Guangzhou", latitude: 23.1291, longitude: 113.2644, country: "CN" },
  { id: "shenzhen", nameZh: "深圳", nameEn: "Shenzhen", latitude: 22.5431, longitude: 114.0579, country: "CN" },
  { id: "chengdu", nameZh: "成都", nameEn: "Chengdu", latitude: 30.5728, longitude: 104.0668, country: "CN" },
  { id: "hangzhou", nameZh: "杭州", nameEn: "Hangzhou", latitude: 30.2741, longitude: 120.1551, country: "CN" },
  { id: "hongkong", nameZh: "香港", nameEn: "Hong Kong", latitude: 22.3193, longitude: 114.1694, country: "CN" },
  { id: "macau", nameZh: "澳门", nameEn: "Macau", latitude: 22.1987, longitude: 113.5439, country: "CN" },
  { id: "taipei", nameZh: "台北", nameEn: "Taipei", latitude: 25.0330, longitude: 121.5654, country: "CN" },
  { id: "tokyo", nameZh: "东京", nameEn: "Tokyo", latitude: 35.6762, longitude: 139.6503, country: "JP" },
  { id: "singapore", nameZh: "新加坡", nameEn: "Singapore", latitude: 1.3521, longitude: 103.8198, country: "SG" },
  { id: "newyork", nameZh: "纽约", nameEn: "New York", latitude: 40.7128, longitude: -74.0060, country: "US" },
  { id: "london", nameZh: "伦敦", nameEn: "London", latitude: 51.5074, longitude: -0.1278, country: "UK" },
  { id: "paris", nameZh: "巴黎", nameEn: "Paris", latitude: 48.8566, longitude: 2.3522, country: "FR" },
  { id: "losangeles", nameZh: "洛杉矶", nameEn: "Los Angeles", latitude: 34.0522, longitude: -118.2437, country: "US" },
  { id: "sanfrancisco", nameZh: "旧金山", nameEn: "San Francisco", latitude: 37.7749, longitude: -122.4194, country: "US" },
  { id: "seoul", nameZh: "首尔", nameEn: "Seoul", latitude: 37.5665, longitude: 126.9780, country: "KR" },
  { id: "osaka", nameZh: "大阪", nameEn: "Osaka", latitude: 34.6937, longitude: 135.5023, country: "JP" },
  { id: "sydney", nameZh: "悉尼", nameEn: "Sydney", latitude: -33.8688, longitude: 151.2093, country: "AU" },
  { id: "berlin", nameZh: "柏林", nameEn: "Berlin", latitude: 52.5200, longitude: 13.4050, country: "DE" },
];

export function getCityById(id: string): City | undefined {
  return FEATURED_CITIES.find((c) => c.id === id);
}

export function searchCities(query: string, lang: "zh" | "en" = "zh"): City[] {
  if (!query.trim()) return FEATURED_CITIES;
  const q = query.trim().toLowerCase().replace(/\s+/g, "");

  const scored = FEATURED_CITIES.map((city) => {
    const zhName = city.nameZh.toLowerCase().replace(/\s+/g, "");
    const enName = city.nameEn.toLowerCase().replace(/\s+/g, "");
    const country = city.country.toLowerCase();
    const preferredName = (lang === "zh" ? city.nameZh : city.nameEn).toLowerCase().replace(/\s+/g, "");

    let score = -1;

    if (preferredName === q) score = 120;
    else if (zhName === q || enName === q) score = 110;
    else if (preferredName.startsWith(q)) score = 100;
    else if (zhName.startsWith(q) || enName.startsWith(q)) score = 90;
    else if (preferredName.includes(q)) score = 80;
    else if (zhName.includes(q) || enName.includes(q)) score = 70;
    else if (country.includes(q)) score = 40;

    return { city, score };
  })
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || a.city.nameEn.localeCompare(b.city.nameEn));

  return scored.map((item) => item.city).slice(0, 10);
}

interface SearchCitiesResponse {
  success: boolean;
  data?: City[];
}

export async function searchCitiesRemote(query: string, lang: "zh" | "en" = "zh"): Promise<City[]> {
  if (!query.trim()) {
    return FEATURED_CITIES.slice(0, 8);
  }

  const params = new URLSearchParams({
    q: query,
    lang,
  });

  try {
    const response = await fetch(`${LOCATION_API_BASE}/cities/search?${params}`);
    if (!response.ok) {
      throw new Error(`City search request failed: ${response.status}`);
    }

    const data = (await response.json()) as SearchCitiesResponse;
    if (data.success && Array.isArray(data.data) && data.data.length > 0) {
      return data.data;
    }
  } catch (error) {
    console.warn("[searchCitiesRemote] Falling back to local results:", error);
  }

  return searchCities(query, lang);
}
