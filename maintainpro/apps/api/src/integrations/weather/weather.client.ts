import { env } from "../../config/env";

export interface WeatherSnapshot {
  location: string;
  temperatureC: number;
  condition: string;
  humidity: number;
}

export const getCurrentWeather = async (location: string): Promise<WeatherSnapshot> => {
  const endpoint = `https://api.weatherapi.com/v1/current.json?key=${env.WEATHER_API_KEY}&q=${encodeURIComponent(location)}`;

  const response = await fetch(endpoint);
  const data = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    throw new Error(`Weather API error: ${JSON.stringify(data)}`);
  }

  const locationData = data.location as { name: string };
  const currentData = data.current as {
    temp_c: number;
    humidity: number;
    condition: { text: string };
  };

  return {
    location: locationData.name,
    temperatureC: currentData.temp_c,
    condition: currentData.condition.text,
    humidity: currentData.humidity
  };
};
