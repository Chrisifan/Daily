import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Search, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Ref } from "react";
import type { DailySettings } from "../services/settingsService";
import { searchCities, searchCitiesRemote, FEATURED_CITIES, type City } from "../../domain/weather/cities";
import { useAnchoredOverlay } from "./useAnchoredOverlay";
import { DropdownContent } from "./DropdownContent";
import { createRoutineTimeOptions, formatRoutineTimeLabel } from "../utils/routineTime";

interface CitySelectorProps {
  value: DailySettings;
  onChange: (patch: Partial<DailySettings>) => void;
}

interface TimeSelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  displayFormat: "HH:mm" | "hh:mm A";
  treatMidnightAsEndOfDay?: boolean;
}

function getCityFromSettings(settings: DailySettings) {
  if (!settings.locationCity) {
    return null;
  }

  const city = FEATURED_CITIES.find((item) => item.nameZh === settings.locationCity || item.nameEn === settings.locationCity);
  if (city) {
    return city;
  }

  return {
    id: `stored_${settings.locationCity}`,
    nameZh: settings.locationCity,
    nameEn: settings.locationCity,
    latitude: settings.locationLatitude ?? 0,
    longitude: settings.locationLongitude ?? 0,
    country: "",
  };
}

export function CitySelector({ value, onChange }: CitySelectorProps) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith("zh");
  const [selectedCity, setSelectedCity] = useState<City | null>(() => getCityFromSettings(value));
  const selectedDisplayName = selectedCity ? (isZh ? selectedCity.nameZh : selectedCity.nameEn) : "";
  const [query, setQuery] = useState(selectedDisplayName);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<City[]>([]);
  const normalizedSelectedName = selectedDisplayName.trim().toLowerCase().replace(/\s+/g, "");
  const normalizedQuery = query.trim().toLowerCase().replace(/\s+/g, "");
  const overlayOpen = open && normalizedQuery.length > 0 && (normalizedQuery !== normalizedSelectedName || !selectedCity) && results.length > 0;
  const {
    anchorRef,
    contentRef,
    style: dropdownStyle,
  } = useAnchoredOverlay({
    open: overlayOpen,
    gap: 4,
    matchTriggerWidth: "equal",
    strategy: "fixed",
  });

  const handleSelect = useCallback((city: City) => {
    setSelectedCity(city);
    setOpen(false);
    setQuery(isZh ? city.nameZh : city.nameEn);
    setResults([]);
    onChange({
      locationCity: isZh ? city.nameZh : city.nameEn,
      locationLatitude: city.latitude,
      locationLongitude: city.longitude,
    });
  }, [isZh, onChange]);

  useEffect(() => {
    const nextSelectedCity = getCityFromSettings(value);
    setSelectedCity(nextSelectedCity);
    if (!open) {
      const nextDisplayName = nextSelectedCity ? (isZh ? nextSelectedCity.nameZh : nextSelectedCity.nameEn) : "";
      setQuery(nextDisplayName);
    }
  }, [isZh, open, value]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const lang = isZh ? "zh" : "en";
    setResults(searchCities(query, lang).slice(0, 8));
  }, [isZh, query]);

  useEffect(() => {
    if (!query.trim()) {
      return;
    }

    const lang = isZh ? "zh" : "en";
    const timeoutId = window.setTimeout(() => {
      searchCitiesRemote(query, lang)
        .then((remoteResults) => {
          setResults(remoteResults.slice(0, 10));
        })
        .catch(() => {
          // Keep local results when remote search is unavailable.
        });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isZh, query]);

  useEffect(() => {
    if (!open) {
      setQuery(selectedDisplayName);
      setResults([]);
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target) || contentRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
      setQuery(selectedDisplayName);
      setResults([]);
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [anchorRef, contentRef, open, selectedDisplayName]);

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div
        style={{
          width: "100%",
          borderRadius: 12,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "0 12px",
          minHeight: 42,
        }}
      >
        <Search className="w-4 h-4" style={{ opacity: 0.5, flexShrink: 0 }} />
        <input
          ref={anchorRef as Ref<HTMLInputElement>}
          type="text"
          value={query}
          onFocus={(event) => {
            setOpen(true);
            event.currentTarget.select();
          }}
          onChange={(event) => {
            setOpen(true);
            setQuery(event.target.value);
          }}
          placeholder={t("settings.searchCity")}
          style={{
            width: "100%",
            padding: "10px 0",
            border: "none",
            background: "transparent",
            color: "var(--color-text)",
            fontSize: 13,
            outline: "none",
          }}
        />
      </div>

      {overlayOpen && typeof document !== "undefined" && createPortal(
        <div
          ref={contentRef as Ref<HTMLDivElement>}
          data-settings-city-overlay="true"
          style={{
            padding: 4,
            borderRadius: 12,
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.14)",
            zIndex: 120,
            overflow: "auto",
            ...dropdownStyle,
          }}
        >
          {results.map((city) => {
            const isSelected = selectedCity?.id === city.id;
            const name = isZh ? city.nameZh : city.nameEn;
            return (
              <div
                key={city.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelect(city)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    handleSelect(city);
                  }
                }}
                style={{
                  padding: "9px 10px",
                  borderRadius: 8,
                  background: isSelected ? "var(--color-primary)" : "transparent",
                  color: isSelected ? "white" : "var(--color-text)",
                  fontSize: 13,
                  cursor: "pointer",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  outline: "none",
                }}
              >
                <span>{name}</span>
                <span style={{ fontSize: 11, opacity: 0.7 }}>{city.country}</span>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </div>
  );
}

export function TimeSelectField({
  value,
  onChange,
  displayFormat,
  treatMidnightAsEndOfDay = false,
}: TimeSelectFieldProps) {
  const options = createRoutineTimeOptions();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="w-full rounded-xl border px-3 py-2.5 text-left transition-colors"
          style={{
            borderColor: "var(--color-border)",
            backgroundColor: "var(--color-surface)",
            color: "var(--color-text)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="tabular-nums">
              {formatRoutineTimeLabel(value, displayFormat, treatMidnightAsEndOfDay)}
            </span>
            <ChevronDown className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
          </div>
        </button>
      </DropdownMenu.Trigger>

      <DropdownContent className="max-h-72 overflow-y-auto rounded-2xl border bg-[var(--color-surface)] p-1 shadow-xl">
        {options.map((option) => {
          const selected = option === value;
          return (
            <DropdownMenu.Item
              key={option}
              onSelect={() => onChange(option)}
              className="rounded-xl px-3 py-2 text-sm outline-none transition-colors"
              style={{
                backgroundColor: selected ? "color-mix(in srgb, var(--color-primary) 12%, transparent)" : "transparent",
                color: selected ? "var(--color-primary)" : "var(--color-text)",
                fontWeight: selected ? 600 : 500,
              }}
            >
              <span className="tabular-nums">
                {formatRoutineTimeLabel(option, displayFormat, treatMidnightAsEndOfDay)}
              </span>
            </DropdownMenu.Item>
          );
        })}
      </DropdownContent>
    </DropdownMenu.Root>
  );
}
