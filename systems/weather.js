const TYPES = ['clear', 'overcast', 'rain', 'fog', 'storm'];
function random(seed) {
  let n = Math.imul((seed | 0) ^ 0x9e3779b9, 0x85ebca6b);
  n = Math.imul(n ^ n >>> 13, 0xc2b2ae35);
  return ((n ^ n >>> 16) >>> 0) / 4294967296;
}

/** Five in-game minutes per real second; weather fronts last six game hours. */
export function updateWeather(state, dt) {
  if (state.paused || state.dead || !Number.isFinite(dt) || dt <= 0) return;
  const previousTime = Number.isFinite(state.time) ? state.time : 540;
  const previousPeriod = (Math.max(1, state.day || 1) - 1) * 4 + Math.floor(previousTime / 360);
  const total = Math.max(0, previousTime + dt * 5);
  state.day = Math.max(1, state.day || 1) + Math.floor(total / 1440);
  state.time = total % 1440;
  const weather = state.weather ||= { type: 'overcast', intensity: 0.25, temperature: 16 };
  const period = (state.day - 1) * 4 + Math.floor(state.time / 360);
  if (!Number.isFinite(weather.period)) weather.period = previousPeriod;
  if (period !== weather.period) {
    weather.period = period;
    const roll = random((state.seed || 74219) + period * 131);
    weather.type = roll < 0.29 ? 'clear' : roll < 0.64 ? 'overcast' : roll < 0.85 ? 'rain' : roll < 0.95 ? 'fog' : 'storm';
  }
  if (!TYPES.includes(weather.type)) weather.type = 'overcast';
  const variation = random((state.seed || 74219) + period * 83 + 912);
  const targets = { clear: 0.05, overcast: 0.25 + variation * 0.22, rain: 0.42 + variation * 0.42,
    fog: 0.38 + variation * 0.4, storm: 0.8 + variation * 0.2 };
  const mix = 1 - Math.exp(-dt / 7);
  const intensity = Number.isFinite(weather.intensity) ? weather.intensity : targets[weather.type];
  weather.intensity = Math.max(0, Math.min(1, intensity + (targets[weather.type] - intensity) * mix));
  const daytime = Math.sin((state.time / 1440 - 0.28) * Math.PI * 2);
  const temperature = 15 + daytime * 6 - (weather.type === 'rain' || weather.type === 'storm' ? 3 : 0);
  weather.temperature = (Number.isFinite(weather.temperature) ? weather.temperature : temperature) +
    (temperature - (Number.isFinite(weather.temperature) ? weather.temperature : temperature)) * mix;
  weather.daylight = Math.max(0.12, Math.min(1, (Math.sin((state.time / 1440 - 0.25) * Math.PI * 2) + 0.25) * 1.05));
  weather.wind = 0.2 + variation * (weather.type === 'storm' ? 0.8 : 0.4);
}
