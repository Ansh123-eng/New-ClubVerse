import dotenv from 'dotenv';
import axios from 'axios';

// Load .env from project root
dotenv.config({ path: './.env' });

const apiKey = process.env.OPENWEATHER_API_KEY || process.env.OPENWEATHERMAP_API_KEY;
console.log('OPENWEATHER_API_KEY present?', !!apiKey);

if (!apiKey) {
  console.error('No API key found in .env (OPENWEATHER_API_KEY or OPENWEATHERMAP_API_KEY)');
  process.exit(1);
}

async function fetchCity(city) {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    const res = await axios.get(url, { timeout: 10000 });
    console.log(`\n[${city}] Status:`, res.status);
    console.log(`[${city}] Name:`, res.data.name);
    console.log(`[${city}] Temp:`, res.data.main.temp);
    console.log(`[${city}] Condition:`, res.data.weather[0].description);
    console.log(`[${city}] Icon:`, res.data.weather[0].icon);
  } catch (err) {
    console.error(`\n[${city}] Request failed:`);
    if (err.response) {
      console.error('Response status:', err.response.status);
      console.error('Response data:', err.response.data);
    } else if (err.request) {
      console.error('No response received. Network/timeout?');
    } else {
      console.error('Error:', err.message);
    }
  }
}

(async () => {
  await fetchCity('Ludhiana,in');
  await fetchCity('Chandigarh,in');
})();
