import { Router } from "express";

const router: Router = Router();

type Lang = "zh" | "en";

interface City {
  id: string;
  nameZh: string;
  nameEn: string;
  latitude: number;
  longitude: number;
  country: string;
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  type: string;
  class: string;
  addresstype?: string;
  address?: {
    city?: string;
    town?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
    country_code?: string;
  };
  countrycode?: string;
  name?: string;
}

const ONLINE_CITY_TYPES = new Set(["city", "town", "municipality"]);
const ONLINE_CITY_ADDRESS_TYPES = new Set(["city", "town", "municipality"]);

const FEATURED_CITIES: City[] = [
  { id: "beijing", nameZh: "北京", nameEn: "Beijing", latitude: 39.9042, longitude: 116.4074, country: "CN" },
  { id: "shanghai", nameZh: "上海", nameEn: "Shanghai", latitude: 31.2304, longitude: 121.4737, country: "CN" },
  { id: "guangzhou", nameZh: "广州", nameEn: "Guangzhou", latitude: 23.1291, longitude: 113.2644, country: "CN" },
  { id: "shenzhen", nameZh: "深圳", nameEn: "Shenzhen", latitude: 22.5431, longitude: 114.0579, country: "CN" },
  { id: "chengdu", nameZh: "成都", nameEn: "Chengdu", latitude: 30.5728, longitude: 104.0668, country: "CN" },
  { id: "hangzhou", nameZh: "杭州", nameEn: "Hangzhou", latitude: 30.2741, longitude: 120.1551, country: "CN" },
  { id: "hongkong", nameZh: "香港", nameEn: "Hong Kong", latitude: 22.3193, longitude: 114.1694, country: "CN" },
  { id: "macau", nameZh: "澳门", nameEn: "Macau", latitude: 22.1987, longitude: 113.5439, country: "CN" },
  { id: "taipei", nameZh: "台北", nameEn: "Taipei", latitude: 25.033, longitude: 121.5654, country: "CN" },
  { id: "tokyo", nameZh: "东京", nameEn: "Tokyo", latitude: 35.6762, longitude: 139.6503, country: "JP" },
  { id: "osaka", nameZh: "大阪", nameEn: "Osaka", latitude: 34.6937, longitude: 135.5023, country: "JP" },
  { id: "seoul", nameZh: "首尔", nameEn: "Seoul", latitude: 37.5665, longitude: 126.978, country: "KR" },
  { id: "singapore", nameZh: "新加坡", nameEn: "Singapore", latitude: 1.3521, longitude: 103.8198, country: "SG" },
  { id: "newyork", nameZh: "纽约", nameEn: "New York", latitude: 40.7128, longitude: -74.006, country: "US" },
  { id: "losangeles", nameZh: "洛杉矶", nameEn: "Los Angeles", latitude: 34.0522, longitude: -118.2437, country: "US" },
  { id: "sanfrancisco", nameZh: "旧金山", nameEn: "San Francisco", latitude: 37.7749, longitude: -122.4194, country: "US" },
  { id: "london", nameZh: "伦敦", nameEn: "London", latitude: 51.5074, longitude: -0.1278, country: "UK" },
  { id: "paris", nameZh: "巴黎", nameEn: "Paris", latitude: 48.8566, longitude: 2.3522, country: "FR" },
  { id: "berlin", nameZh: "柏林", nameEn: "Berlin", latitude: 52.52, longitude: 13.405, country: "DE" },
  { id: "sydney", nameZh: "悉尼", nameEn: "Sydney", latitude: -33.8688, longitude: 151.2093, country: "AU" },
];

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeZhCityName(value: string) {
  return value.trim().replace(/市$/, "");
}

function isGranularPlaceName(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return true;
  }

  return /(?:区|县|乡|镇|街道|村)$/.test(trimmed) || /\b(?:district|county)\b/i.test(trimmed);
}

function isChineseQuery(value: string) {
  return /[\u4e00-\u9fff]/.test(value);
}

function buildSearchQueries(query: string) {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const queries = [trimmed];
  if (isChineseQuery(trimmed) && !trimmed.endsWith("市")) {
    queries.push(`${trimmed}市`);
  }

  return queries;
}

function scoreCity(city: City, query: string, lang: Lang) {
  const q = normalizeText(query);
  const zhName = normalizeText(city.nameZh);
  const enName = normalizeText(city.nameEn);
  const preferredName = lang === "zh" ? zhName : enName;
  const country = city.country.toLowerCase();

  if (preferredName === q) return 120;
  if (zhName === q || enName === q) return 110;
  if (preferredName.startsWith(q)) return 100;
  if (zhName.startsWith(q) || enName.startsWith(q)) return 90;
  if (preferredName.includes(q)) return 80;
  if (zhName.includes(q) || enName.includes(q)) return 70;
  if (country.includes(q)) return 40;
  return -1;
}

function searchFeaturedCities(query: string, lang: Lang) {
  if (!query.trim()) {
    return FEATURED_CITIES.slice(0, 8);
  }

  return FEATURED_CITIES
    .map((city) => ({ city, score: scoreCity(city, query, lang) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || a.city.nameEn.localeCompare(b.city.nameEn))
    .map((item) => item.city)
    .slice(0, 10);
}

function mapNominatimResult(item: NominatimResult, query: string, lang: Lang): City | null {
  if (!item.lat || !item.lon) {
    return null;
  }

  const address = item.address || {};
  const hasCityAddress = Boolean(address.city || address.town || address.municipality);
  const isAcceptedType =
    ONLINE_CITY_TYPES.has(item.type) ||
    ONLINE_CITY_ADDRESS_TYPES.has(item.addresstype ?? "") ||
    (item.class === "boundary" && item.type === "administrative" && hasCityAddress);

  if (!isAcceptedType) {
    return null;
  }

  const cityName =
    address.city ||
    address.town ||
    address.municipality ||
    item.name ||
    item.display_name?.split(",")[0] ||
    query;

  if (!cityName) {
    return null;
  }

  if (isGranularPlaceName(cityName)) {
    return null;
  }

  const enName = (item.display_name?.split(",")[0] || cityName).trim();
  const country = (address.country_code || item.countrycode || "").toUpperCase() || "XX";
  const zhName = normalizeZhCityName(cityName);

  return {
    id: `${item.lat.slice(0, 6)}_${item.lon.slice(0, 6)}_${normalizeText(enName)}`,
    nameZh: zhName,
    nameEn: enName,
    latitude: Number(item.lat),
    longitude: Number(item.lon),
    country,
  };
}

async function searchCitiesOnline(query: string, lang: Lang): Promise<City[]> {
  const mergedResults: City[] = [];

  for (const searchQuery of buildSearchQueries(query)) {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", searchQuery);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "10");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("accept-language", lang === "zh" ? "zh-CN,zh,en" : "en,zh-CN");

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Daily Smart Workbench Service/1.0",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim search failed: ${response.status}`);
    }

    const data = (await response.json()) as NominatimResult[];
    if (!Array.isArray(data)) {
      continue;
    }

    mergedResults.push(
      ...data
        .map((item) => mapNominatimResult(item, query, lang))
        .filter((city): city is City => city !== null),
    );
  }

  return mergeCities([], mergedResults);
}

function mergeCities(primary: City[], secondary: City[]) {
  const seen = new Set<string>();
  const merged: City[] = [];

  for (const city of [...primary, ...secondary]) {
    const key = `${normalizeText(city.nameEn)}_${city.country}_${city.latitude.toFixed(2)}_${city.longitude.toFixed(2)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(city);
  }

  return merged;
}

router.get("/cities/search", async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
  const lang: Lang = req.query.lang === "en" ? "en" : "zh";

  if (!query) {
    return res.json({
      success: true,
      data: FEATURED_CITIES.slice(0, 8),
      source: "local",
    });
  }

  const localResults = searchFeaturedCities(query, lang);

  try {
    const onlineResults = await searchCitiesOnline(query, lang);
    const data = mergeCities(localResults, onlineResults).slice(0, 10);
    return res.json({
      success: true,
      data: data.length > 0 ? data : localResults,
      source: onlineResults.length > 0 ? "hybrid" : "local",
    });
  } catch (error) {
    console.warn("[location/cities/search] Falling back to local results:", error);
    return res.json({
      success: true,
      data: localResults.length > 0 ? localResults : FEATURED_CITIES.slice(0, 8),
      source: "local",
    });
  }
});

export default router;
