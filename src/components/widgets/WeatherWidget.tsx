import React, { useState, useEffect } from 'react';
import { WidgetWrapper } from './WidgetWrapper';
import type { WeatherData } from '../../types';

interface GeocodingResult {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    admin1?: string;
  }>;
}

interface OpenMeteoResponse {
  current_weather: {
    temperature: number;
    weathercode: number;
    windspeed: number;
  };
  hourly?: {
    relativehumidity_2m: number[];
  };
  daily?: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
}

const STORAGE_KEY = 'weather_location';
const DEFAULT_LOCATION = 'Seoul';
const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export const WeatherWidget: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_LOCATION;
  });
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [inputLocation, setInputLocation] = useState(location);

  // Geocoding API: Convert city name to coordinates
  const geocodeLocation = async (cityName: string): Promise<{ lat: number; lon: number; displayName: string } | null> => {
    try {
      const response = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=1&language=en`
      );

      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }

      const data: GeocodingResult = await response.json();

      if (!data.results || data.results.length === 0) {
        throw new Error('Location not found');
      }

      const result = data.results[0];
      return {
        lat: result.latitude,
        lon: result.longitude,
        displayName: `${result.name}${result.admin1 ? ', ' + result.admin1 : ''}${result.country ? ', ' + result.country : ''}`
      };
    } catch (err) {
      console.error('Geocoding error:', err);
      return null;
    }
  };

  // Weather API: Fetch weather data
  const fetchWeather = async (lat: number, lon: number, displayName: string) => {
    try {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relativehumidity_2m&daily=temperature_2m_max,temperature_2m_min&temperature_unit=celsius&windspeed_unit=kmh&timezone=auto`
      );

      if (!response.ok) {
        throw new Error('Weather API request failed');
      }

      const data: OpenMeteoResponse = await response.json();

      const weatherData: WeatherData = {
        location: displayName,
        temperature: Math.round(data.current_weather.temperature),
        condition: getWeatherCondition(data.current_weather.weathercode),
        humidity: data.hourly?.relativehumidity_2m?.[0],
        windSpeed: Math.round(data.current_weather.windspeed),
        icon: getWeatherIcon(data.current_weather.weathercode),
        lastUpdated: new Date(),
      };

      setWeather(weatherData);
      setError(null);
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError('Failed to fetch weather data');
    } finally {
      setLoading(false);
    }
  };

  // Load weather data
  const loadWeather = async (cityName: string) => {
    setLoading(true);
    setError(null);

    const coords = await geocodeLocation(cityName);

    if (!coords) {
      setError('Location not found. Please try another city.');
      setLoading(false);
      return;
    }

    await fetchWeather(coords.lat, coords.lon, coords.displayName);
  };

  // Initial load and auto-refresh
  useEffect(() => {
    loadWeather(location);

    // Set up auto-refresh every 5 minutes
    const interval = setInterval(() => {
      loadWeather(location);
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [location]);

  // Handle location change
  const handleLocationSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputLocation.trim()) {
      const newLocation = inputLocation.trim();
      setLocation(newLocation);
      localStorage.setItem(STORAGE_KEY, newLocation);
      setIsEditingLocation(false);
    }
  };

  // Manual refresh
  const handleRefresh = () => {
    loadWeather(location);
  };

  // Convert WMO weather code to condition string
  const getWeatherCondition = (code: number): string => {
    if (code === 0) return 'Clear';
    if (code <= 3) return 'Partly Cloudy';
    if (code <= 48) return 'Foggy';
    if (code <= 57) return 'Drizzle';
    if (code <= 67) return 'Rainy';
    if (code <= 77) return 'Snowy';
    if (code <= 82) return 'Rain Showers';
    if (code <= 86) return 'Snow Showers';
    if (code <= 99) return 'Thunderstorm';
    return 'Unknown';
  };

  // Get weather emoji based on WMO code
  const getWeatherIcon = (code: number): string => {
    if (code === 0) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 48) return '🌫️';
    if (code <= 57) return '🌦️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 82) return '🌧️';
    if (code <= 86) return '🌨️';
    if (code <= 99) return '⛈️';
    return '🌤️';
  };

  return (
    <WidgetWrapper title="Weather" icon="🌡️">
      <div className="flex flex-col h-full">
        {/* Location header */}
        <div className="mb-3 sm:mb-4">
          {isEditingLocation ? (
            <form onSubmit={handleLocationSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={inputLocation}
                onChange={(e) => setInputLocation(e.target.value)}
                placeholder="Enter city name"
                className="flex-1 px-3 py-2 text-xs sm:text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors touch-manipulation min-h-[44px] sm:min-h-0"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingLocation(false);
                    setInputLocation(location);
                  }}
                  className="flex-1 sm:flex-none px-3 py-2 text-xs sm:text-sm bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400 dark:hover:bg-gray-600 transition-colors touch-manipulation min-h-[44px] sm:min-h-0"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="flex justify-between items-center">
              <button
                onClick={() => setIsEditingLocation(true)}
                className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors truncate touch-manipulation"
                title="Change location"
              >
                {weather?.location || location}
              </button>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="text-lg hover:rotate-180 transition-transform duration-500 disabled:opacity-50 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Refresh weather"
              >
                🔄
              </button>
            </div>
          )}
        </div>

        {/* Weather content */}
        <div className="flex-1 flex items-center justify-center">
          {loading && !weather && (
            <div className="text-center text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-2">🔄</div>
              <div className="text-sm">Loading weather...</div>
            </div>
          )}

          {error && (
            <div className="text-center text-red-500 dark:text-red-400">
              <div className="text-4xl mb-2">⚠️</div>
              <div className="text-sm">{error}</div>
              <button
                onClick={handleRefresh}
                className="mt-3 px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && weather && (
            <div className="text-center w-full px-2">
              {/* Weather icon */}
              <div className="text-5xl sm:text-7xl mb-3 sm:mb-4">{weather.icon}</div>

              {/* Temperature */}
              <div className="text-4xl sm:text-5xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                {weather.temperature}°C
              </div>

              {/* Condition */}
              <div className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-4 sm:mb-6">
                {weather.condition}
              </div>

              {/* Additional info */}
              <div className="grid grid-cols-2 gap-2 sm:gap-4 max-w-xs mx-auto">
                {weather.humidity !== undefined && (
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 sm:p-3">
                    <div className="text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs mb-1">
                      Humidity
                    </div>
                    <div className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100">
                      {weather.humidity}%
                    </div>
                  </div>
                )}
                {weather.windSpeed !== undefined && (
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-2 sm:p-3">
                    <div className="text-gray-500 dark:text-gray-400 text-[10px] sm:text-xs mb-1">
                      Wind
                    </div>
                    <div className="text-base sm:text-lg font-semibold text-gray-800 dark:text-gray-100">
                      {weather.windSpeed} km/h
                    </div>
                  </div>
                )}
              </div>

              {/* Last updated */}
              <div className="mt-3 sm:mt-4 text-[10px] sm:text-xs text-gray-400 dark:text-gray-500">
                Updated: {weather.lastUpdated.toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      </div>
    </WidgetWrapper>
  );
};
