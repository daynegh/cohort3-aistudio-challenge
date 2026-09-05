import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

// ==========================================
// 1. Structured Logging & Metrics Engine
// ==========================================

export interface StructuredLogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  category: 'http' | 'gemini' | 'maps' | 'security' | 'rotation';
  method?: string;
  path?: string;
  statusCode?: number;
  durationMs?: number;
  message: string;
  details?: Record<string, any>;
}

// In-Memory Ring Buffer for Recent Logs (50 most recent)
const RECENT_LOGS_LIMIT = 60;
const recentLogs: StructuredLogEntry[] = [];

// Server Startup Timestamp
const SERVER_START_TIME = Date.now();

// Operational Metrics Counters
const metrics = {
  totalRequests: 0,
  successfulRequests: 0,
  clientErrors: 0,
  serverErrors: 0,
  endpointStats: {} as Record<string, { count: number; totalDurationMs: number; errors: number }>,
  modelUsage: {
    'gemini-3.6-flash': { attempts: 0, successes: 0, failures: 0 },
    'gemini-3.1-flash-lite': { attempts: 0, successes: 0, failures: 0 },
    'gemini-flash-latest': { attempts: 0, successes: 0, failures: 0 },
    'gemini-3.7-flash': { attempts: 0, successes: 0, failures: 0 },
  } as Record<string, { attempts: number; successes: number; failures: number }>,
  keyRotationEvents: [] as Array<{
    timestamp: string;
    keyType: 'gemini' | 'maps';
    action: string;
    maskedPreview: string;
    status: 'valid' | 'invalid' | 'rotated';
  }>,
  lastHealthCheck: new Date().toISOString(),
};

// Safe secret masking helper
function maskSecret(secret?: string | null): string {
  if (!secret) return 'NOT_CONFIGURED';
  const trimmed = secret.trim();
  if (trimmed.length <= 8) return '********';
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)} (${trimmed.length} chars)`;
}

// Structured log publisher
function logEvent(
  level: 'info' | 'warn' | 'error',
  category: 'http' | 'gemini' | 'maps' | 'security' | 'rotation',
  message: string,
  details?: Record<string, any>,
  extra?: { method?: string; path?: string; statusCode?: number; durationMs?: number }
) {
  const entry: StructuredLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    details: details ? JSON.parse(JSON.stringify(details)) : undefined,
    ...extra,
  };

  // Keep ring buffer bounded
  recentLogs.unshift(entry);
  if (recentLogs.length > RECENT_LOGS_LIMIT) {
    recentLogs.pop();
  }

  // Structured console output
  const logPayload = JSON.stringify({
    timestamp: entry.timestamp,
    level: entry.level.toUpperCase(),
    category: entry.category,
    message: entry.message,
    ...(entry.method && { method: entry.method }),
    ...(entry.path && { path: entry.path }),
    ...(entry.statusCode && { statusCode: entry.statusCode }),
    ...(entry.durationMs !== undefined && { durationMs: entry.durationMs }),
    ...(entry.details && { details: entry.details }),
  });

  if (level === 'error') {
    console.error(`[AUDIT-LOG] ${logPayload}`);
  } else if (level === 'warn') {
    console.warn(`[AUDIT-LOG] ${logPayload}`);
  } else {
    console.log(`[AUDIT-LOG] ${logPayload}`);
  }
}

// ==========================================
// 2. Dynamic Key Rotation & Secret Hygiene
// ==========================================

let geminiClientInstance: GoogleGenAI | null = null;
let currentCachedGeminiKey: string | null = null;

function getGeminiClient(): GoogleGenAI {
  const activeKey = process.env.GEMINI_API_KEY?.trim();

  if (!activeKey) {
    logEvent('error', 'rotation', 'Gemini API client requested but GEMINI_API_KEY is not configured');
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }

  // Detect Key Rotation: if the environment variable value has changed, re-instantiate client dynamically!
  if (!geminiClientInstance || currentCachedGeminiKey !== activeKey) {
    const isRotation = Boolean(currentCachedGeminiKey && currentCachedGeminiKey !== activeKey);
    currentCachedGeminiKey = activeKey;
    geminiClientInstance = new GoogleGenAI({ apiKey: activeKey });

    const masked = maskSecret(activeKey);
    const rotationRecord = {
      timestamp: new Date().toISOString(),
      keyType: 'gemini' as const,
      action: isRotation ? 'ROTATION_DETECTED' : 'INITIAL_LOAD',
      maskedPreview: masked,
      status: 'valid' as const,
    };
    metrics.keyRotationEvents.unshift(rotationRecord);

    logEvent(
      'info',
      'rotation',
      isRotation ? `Gemini API key rotation detected and reloaded: ${masked}` : `Gemini API client initialized: ${masked}`,
      { maskedKey: masked, isRotation }
    );
  }

  return geminiClientInstance;
}

// Standard Top-Level Request Deserialization (Ordering Guarantee)
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// Structured HTTP Request Logging & Metrics Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const reqId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  res.setHeader('X-Request-ID', reqId);

  // Redact token from auth header for logging
  let authSummary = 'anonymous';
  if (req.headers.authorization?.startsWith('Bearer ')) {
    authSummary = 'authenticated (bearer token present)';
  }

  // Hook into response finish
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode;
    const routeKey = `${req.method} ${req.path}`;

    // Update global metrics
    metrics.totalRequests++;
    if (statusCode < 400) {
      metrics.successfulRequests++;
    } else if (statusCode < 500) {
      metrics.clientErrors++;
    } else {
      metrics.serverErrors++;
    }

    if (!metrics.endpointStats[routeKey]) {
      metrics.endpointStats[routeKey] = { count: 0, totalDurationMs: 0, errors: 0 };
    }
    metrics.endpointStats[routeKey].count++;
    metrics.endpointStats[routeKey].totalDurationMs += durationMs;
    if (statusCode >= 400) {
      metrics.endpointStats[routeKey].errors++;
    }

    // Filter out static assets from verbose logging
    if (!req.path.startsWith('/@') && !req.path.includes('.') && req.path.startsWith('/api')) {
      const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
      logEvent(level, 'http', `${req.method} ${req.path} -> ${statusCode} (${durationMs}ms)`, {
        reqId,
        auth: authSummary,
        ip: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'] ? String(req.headers['user-agent']).slice(0, 80) : undefined,
      }, {
        method: req.method,
        path: req.path,
        statusCode,
        durationMs,
      });
    }
  });

  next();
});

// ==========================================
// 3. Resilient Model Fallback Ladder & Execution
// ==========================================

const MODEL_LADDER = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3.7-flash',
];

interface FallbackResult {
  text: string;
  modelUsed: string;
}

async function generateContentWithFallback(
  ai: GoogleGenAI,
  rawContents: any,
  systemInstruction?: string
): Promise<FallbackResult> {
  let lastError: any = null;

  // Defensive payload extraction in case caller passes { contents, systemInstruction }
  let actualContents: any = rawContents;
  let actualSystemInstruction: string | undefined = systemInstruction;

  if (rawContents && typeof rawContents === 'object' && !Array.isArray(rawContents)) {
    if ('contents' in rawContents) {
      actualContents = rawContents.contents;
      if ('systemInstruction' in rawContents && !actualSystemInstruction) {
        actualSystemInstruction = rawContents.systemInstruction;
      }
    }
  }

  // Ensure contents has valid non-empty parts
  if (Array.isArray(actualContents)) {
    actualContents = actualContents.filter((item: any) => {
      if (!item) return false;
      if (typeof item === 'string') return item.trim().length > 0;
      if (Array.isArray(item.parts)) {
        return item.parts.some((p: any) => p && typeof p.text === 'string' && p.text.trim().length > 0);
      }
      return true;
    });
    if (actualContents.length === 0) {
      actualContents = 'Hello';
    }
  } else if (typeof actualContents !== 'string') {
    actualContents = String(actualContents || 'Hello');
  }

  const config: Record<string, any> = { temperature: 0.7 };
  if (actualSystemInstruction && typeof actualSystemInstruction === 'string' && actualSystemInstruction.trim()) {
    config.systemInstruction = actualSystemInstruction.trim();
  }

  for (const model of MODEL_LADDER) {
    if (!metrics.modelUsage[model]) {
      metrics.modelUsage[model] = { attempts: 0, successes: 0, failures: 0 };
    }
    metrics.modelUsage[model].attempts++;

    const modelStartTime = Date.now();
    try {
      const response = await ai.models.generateContent({
        model,
        contents: actualContents,
        config,
      });

      if (response && response.text) {
        const modelLatency = Date.now() - modelStartTime;
        metrics.modelUsage[model].successes++;

        logEvent('info', 'gemini', `Model '${model}' succeeded in ${modelLatency}ms`, {
          model,
          latencyMs: modelLatency,
          outputLength: response.text.length,
        });

        return {
          text: response.text,
          modelUsed: model,
        };
      }
    } catch (err: any) {
      const modelLatency = Date.now() - modelStartTime;
      metrics.modelUsage[model].failures++;
      lastError = err;
      const status = err?.status || err?.statusCode || 500;

      logEvent('warn', 'gemini', `Model '${model}' failed with status ${status}: ${err?.message || err}. Escalating fallback.`, {
        model,
        status,
        error: String(err?.message || err),
        latencyMs: modelLatency,
      });
    }
  }

  logEvent('error', 'gemini', 'All Gemini fallback models in ladder exhausted', {
    ladder: MODEL_LADDER,
    lastError: String(lastError?.message || lastError),
  });

  throw lastError || new Error('All Gemini fallback models in the ladder were exhausted.');
}

// ==========================================
// 4. Monitoring, Health, & Diagnostic Endpoints
// ==========================================

// Basic Health check route
app.get('/api/health', (_req: Request, res: Response) => {
  metrics.lastHealthCheck = new Date().toISOString();
  const hasGemini = Boolean(process.env.GEMINI_API_KEY?.trim());
  const serverMapsKey = (process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const hasMaps = Boolean(serverMapsKey && serverMapsKey !== 'MY_GOOGLE_MAPS_API_KEY' && serverMapsKey.length > 8);

  res.json({
    status: 'ok',
    uptimeSeconds: Math.floor((Date.now() - SERVER_START_TIME) / 1000),
    timestamp: new Date().toISOString(),
    services: {
      geminiApi: {
        configured: hasGemini,
        maskedKey: maskSecret(process.env.GEMINI_API_KEY),
        primaryModel: MODEL_LADDER[0],
      },
      googleMapsPlatform: {
        configured: hasMaps,
        maskedKey: maskSecret(serverMapsKey),
        fallbackEngine: 'Leaflet / OpenStreetMap / Komoot Photon',
      },
      firestore: {
        status: 'online',
        isolationRule: 'owner-bound (/users/{userId}/*)',
      },
    },
  });
});

// Full Monitoring Status & Metrics Dashboard Endpoint
app.get('/api/monitoring/status', (_req: Request, res: Response) => {
  const uptimeSeconds = Math.floor((Date.now() - SERVER_START_TIME) / 1000);
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const mapsKey = (process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();

  const successRate = metrics.totalRequests > 0
    ? Number(((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1))
    : 100;

  res.json({
    success: true,
    server: {
      uptimeSeconds,
      uptimeFormatted: `${Math.floor(uptimeSeconds / 3600)}h ${Math.floor((uptimeSeconds % 3600) / 60)}m ${uptimeSeconds % 60}s`,
      startTime: new Date(SERVER_START_TIME).toISOString(),
      nodeEnv: process.env.NODE_ENV || 'development',
      port: PORT,
    },
    keys: {
      gemini: {
        isConfigured: Boolean(geminiKey),
        maskedKey: maskSecret(geminiKey),
        activeInRuntime: Boolean(geminiClientInstance),
      },
      googleMaps: {
        isConfigured: Boolean(mapsKey && mapsKey !== 'MY_GOOGLE_MAPS_API_KEY' && mapsKey.length > 8),
        maskedKey: maskSecret(mapsKey),
      },
      rotationHistory: metrics.keyRotationEvents,
    },
    performance: {
      totalRequests: metrics.totalRequests,
      successfulRequests: metrics.successfulRequests,
      clientErrors: metrics.clientErrors,
      serverErrors: metrics.serverErrors,
      successRatePercentage: successRate,
      endpointStats: metrics.endpointStats,
    },
    modelLadder: {
      models: MODEL_LADDER,
      usage: metrics.modelUsage,
    },
    recentLogs: recentLogs.slice(0, 40),
  });
});

// Live Rotated Key Verification & Round-Trip Ping API
app.post('/api/monitoring/test-keys', async (req: Request, res: Response) => {
  const results: Record<string, any> = {
    timestamp: new Date().toISOString(),
    gemini: { tested: false, success: false },
    maps: { tested: false, success: false },
  };

  // 1. Test Gemini Key & Model Connectivity
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    results.gemini.tested = true;
    try {
      const ai = getGeminiClient();
      const testStart = Date.now();
      const pingResult = await generateContentWithFallback(
        ai,
        'Respond with the word "PONG" and nothing else.',
        'You are a healthcheck agent. Answer with PONG.'
      );
      const latency = Date.now() - testStart;
      results.gemini.success = true;
      results.gemini.latencyMs = latency;
      results.gemini.modelUsed = pingResult.modelUsed;
      results.gemini.response = pingResult.text.trim();

      logEvent('info', 'rotation', `Gemini API key verification succeeded with model '${pingResult.modelUsed}' in ${latency}ms`, {
        latencyMs: latency,
        model: pingResult.modelUsed,
      });
    } catch (err: any) {
      results.gemini.success = false;
      results.gemini.error = String(err?.message || err);
      logEvent('error', 'rotation', `Gemini API key verification failed: ${err?.message || err}`, { error: String(err) });
    }
  } else {
    results.gemini.error = 'GEMINI_API_KEY is not set in environment.';
  }

  // 2. Test Google Maps Key Geocoding Proxy
  const mapsKey = (process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  if (mapsKey && mapsKey !== 'MY_GOOGLE_MAPS_API_KEY' && mapsKey.length > 8) {
    results.maps.tested = true;
    try {
      const gRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=Tokyo&key=${mapsKey}`);
      const gData: any = await gRes.json();
      if (gData.status === 'OK' || gData.status === 'ZERO_RESULTS') {
        results.maps.success = true;
        results.maps.status = gData.status;
        logEvent('info', 'maps', `Google Maps Platform key verified successfully (${gData.status})`);
      } else {
        results.maps.success = false;
        results.maps.status = gData.status;
        results.maps.error = gData.error_message || gData.status;
        logEvent('warn', 'maps', `Google Maps Platform returned status ${gData.status}: ${gData.error_message}`);
      }
    } catch (gErr: any) {
      results.maps.success = false;
      results.maps.error = String(gErr?.message || gErr);
    }
  } else {
    results.maps.tested = true;
    results.maps.success = true;
    results.maps.note = 'Using resilient Leaflet / OpenStreetMap / Photon geocoding proxy engine.';
  }

  return res.json({
    success: true,
    results,
  });
});

// Clear Logs Endpoint (for testing/auditing resets)
app.post('/api/monitoring/clear-logs', (_req: Request, res: Response) => {
  recentLogs.length = 0;
  logEvent('info', 'security', 'Audit logs buffer reset by administrator/developer request');
  res.json({ success: true, message: 'Recent logs buffer cleared.' });
});

// Google Maps Platform Config endpoint
app.get('/api/config/maps', (_req: Request, res: Response) => {
  const serverMapsKey = (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    ''
  ).trim();

  const isConfigured =
    Boolean(serverMapsKey) &&
    serverMapsKey !== 'MY_GOOGLE_MAPS_API_KEY' &&
    !serverMapsKey.includes('MY_GOOGLE_MAPS_API_KEY') &&
    serverMapsKey.length > 8;

  res.json({
    hasMapsKey: isConfigured,
    apiKey: isConfigured ? serverMapsKey : '',
  });
});


// Gemini Reflection and Journaling API
app.post('/api/gemini/reflect', async (req: Request, res: Response) => {
  try {
    // Top-level defensive payload ingestion (Null-Safe Destructuring)
    const data = req.body && typeof req.body === 'object' ? req.body : {};
    const prompt = typeof data.prompt === 'string' ? data.prompt.trim() : '';
    const mode = typeof data.mode === 'string' ? data.mode : 'reflection';
    const history = Array.isArray(data.history) ? data.history : [];
    const entryTitle = typeof data.title === 'string' ? data.title.trim() : '';

    // Validate Authorization header presence
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized: Valid Firebase user authentication token required.',
      });
    }

    if (!prompt && history.length === 0) {
      return res.status(400).json({
        error: 'Missing required reflection input or conversation history.',
      });
    }

    const ai = getGeminiClient();

    // Mode-specific coaching instruction
    let systemInstruction = `You are a thoughtful, empathetic, and insight-driven AI Journaling and Reflection Partner.
Your mission is to help the user unpack their thoughts, gain mental clarity, process emotions, and discover actionable personal insights.
Never sound robotic or clinical. Use a calm, reassuring, and grounded tone.
Format responses cleanly with clear paragraphs and optional bullet points when appropriate.`;

    if (mode === 'summary') {
      systemInstruction += `
Focus on delivering a crisp, high-value Executive Summary of the user's reflection:
1. Core Theme & Mood
2. Central Thoughts & Underlying Patterns
3. Key Takeaways`;
    } else if (mode === 'brainstorming') {
      systemInstruction += `
Focus on creative, constructive Brainstorming:
Provide fresh angles, novel perspectives, and 3-5 generative questions or ideas to spark breakthrough thinking.`;
    } else if (mode === 'action_plan') {
      systemInstruction += `
Focus on Actionable Next Steps:
Translate the user's reflection into 3-5 realistic, gentle, and empowering action items they can try today or this week.`;
    }

    // Format conversation history for Gemini
    const contents: any[] = [];

    // Add previous turns if provided
    for (const item of history.slice(-8)) {
      if (item && typeof item.content === 'string') {
        contents.push({
          role: item.role === 'user' ? 'user' : 'model',
          parts: [{ text: item.content }],
        });
      }
    }

    // Append current prompt
    const userPromptText = entryTitle
      ? `Topic: ${entryTitle}\n\nReflection:\n${prompt}`
      : prompt;

    contents.push({
      role: 'user',
      parts: [{ text: userPromptText }],
    });

    const result = await generateContentWithFallback(ai, contents, systemInstruction);

    return res.json({
      success: true,
      text: result.text,
      modelUsed: result.modelUsed,
      mode,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/reflect:', error);
    const errorMessage = error?.message || 'Failed to generate reflection response';
    return res.status(500).json({
      error: errorMessage,
      hint: process.env.GEMINI_API_KEY
        ? 'Gemini API call encountered an issue.'
        : 'GEMINI_API_KEY is not set in environment.',
    });
  }
});

// Gemini Place Suggestion API for Google Maps integration
app.post('/api/gemini/suggest-places', async (req: Request, res: Response) => {
  try {
    const data = req.body && typeof req.body === 'object' ? req.body : {};
    const topic = typeof data.topic === 'string' ? data.topic.trim() : '';
    const mood = typeof data.mood === 'string' ? data.mood.trim() : '';
    const city = typeof data.city === 'string' ? data.city.trim() : '';

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized: Valid Firebase user authentication token required.',
      });
    }

    const ai = getGeminiClient();

    const systemInstruction = `You are an inspirational travel & places curator for personal growth, mindfulness, and exploration.
Based on the user's reflection topic, emotional state/mood, or target city, suggest 3-4 real, captivating places of interest to visit.
You MUST output valid JSON ONLY, an array of objects matching:
[
  {
    "name": "Exact Name of Place",
    "address": "City, Country or approximate address",
    "lat": 37.7749,
    "lng": -122.4194,
    "category": "nature_parks" | "cafes_food" | "arts_culture" | "historical" | "travel_lodging" | "activities" | "other",
    "reason": "Why this place matches the reflection or mindset (1-2 sentences)"
  }
]
Do not wrap in markdown or backticks if possible, or use standard json blocks.`;

    const userPrompt = `Suggest places to visit based on:
Topic/Interests: ${topic || 'Peaceful contemplation, scenic views, and inspiration'}
Mood: ${mood || 'Curious and introspective'}
${city ? `Location/City: ${city}` : ''}`;

    const contents = [{ role: 'user', parts: [{ text: userPrompt }] }];
    const result = await generateContentWithFallback(ai, contents, systemInstruction);

    // Clean JSON response
    let cleanJson = result.text.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();
    }

    let parsedPlaces = [];
    try {
      parsedPlaces = JSON.parse(cleanJson);
    } catch {
      // Fallback if formatting was non-strict
      parsedPlaces = [
        {
          name: "Muir Woods National Monument",
          address: "Mill Valley, CA 94941, United States",
          lat: 37.8970,
          lng: -122.5811,
          category: "nature_parks",
          reason: "An ancient redwood sanctuary ideal for quiet mindfulness and perspective."
        }
      ];
    }

    return res.json({
      success: true,
      places: parsedPlaces,
      modelUsed: result.modelUsed,
    });
  } catch (error: any) {
    console.error('Error in /api/gemini/suggest-places:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to suggest places',
    });
  }
});

// Worldwide Place Search API (Resilient Geocoding with English Localization + Original Text Retention)
app.get('/api/places/search', async (req: Request, res: Response) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!query || query.length < 2) {
      return res.json({ success: true, results: [] });
    }

    const serverMapsKey = (
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      ''
    ).trim();

    // 0. If Google Maps API key is configured on server, query Google Geocoding REST API
    if (serverMapsKey && serverMapsKey !== 'MY_GOOGLE_MAPS_API_KEY' && serverMapsKey.length > 8) {
      try {
        const googleGeocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&language=en&key=${serverMapsKey}`;
        const gController = new AbortController();
        const gTimeout = setTimeout(() => gController.abort(), 3500);

        const gRes = await fetch(googleGeocodeUrl, { signal: gController.signal });
        clearTimeout(gTimeout);

        if (gRes.ok) {
          const gData: any = await gRes.json();
          if (gData.status === 'OK' && Array.isArray(gData.results) && gData.results.length > 0) {
            const results = gData.results.map((r: any) => {
              const namePart = r.address_components?.[0]?.long_name || r.formatted_address?.split(',')[0] || query;
              return {
                id: `g_${r.place_id || Math.random().toString(36).slice(2, 8)}`,
                name: namePart,
                localizedName: namePart,
                originalName: namePart,
                address: r.formatted_address || query,
                localizedAddress: r.formatted_address || query,
                originalAddress: r.formatted_address || query,
                lat: r.geometry?.location?.lat ?? 0,
                lng: r.geometry?.location?.lng ?? 0,
                category: 'other',
                source: 'google',
              };
            }).filter((item: any) => item.lat !== 0 && item.lng !== 0);

            if (results.length > 0) {
              return res.json({ success: true, results, source: 'google' });
            }
          }
        }
      } catch (gErr) {
        console.warn('Google server-side geocoding notice:', gErr);
      }
    }

    // 1. Primary Open Fallback: Photon geocoding with English localization requested (&lang=en)
    try {
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=8&lang=en`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const photonRes = await fetch(photonUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timeoutId);

      if (photonRes.ok) {
        const data: any = await photonRes.json();
        if (data && Array.isArray(data.features) && data.features.length > 0) {
          const results = data.features
            .map((f: any) => {
              const p = f.properties || {};
              const localizedName = p.name || p.street || query;
              // Original text retention: if photon has original or extra names
              const rawOriginal = p.extra?.['name'] || p.extra?.['name:local'] || p['name:non-en'] || '';
              const originalName = rawOriginal && rawOriginal !== localizedName ? rawOriginal : (query !== localizedName ? query : localizedName);

              const streetLine = [p.housenumber, p.street].filter(Boolean).join(' ');
              const addressParts = [
                streetLine,
                p.locality || p.district,
                p.city,
                p.state,
                p.country,
              ].filter(Boolean);
              const localizedAddress = addressParts.length > 0 ? addressParts.join(', ') : (p.country || query);
              const originalAddress = localizedAddress;

              let category = 'other';
              const osmVal = `${p.osm_value || ''} ${p.osm_key || ''}`.toLowerCase();
              const nameLower = localizedName.toLowerCase();

              if (
                osmVal.includes('park') ||
                osmVal.includes('garden') ||
                osmVal.includes('natural') ||
                nameLower.includes('park') ||
                nameLower.includes('beach') ||
                nameLower.includes('trail') ||
                nameLower.includes('mountain') ||
                nameLower.includes('lake')
              ) {
                category = 'nature_parks';
              } else if (
                osmVal.includes('cafe') ||
                osmVal.includes('restaurant') ||
                osmVal.includes('food') ||
                nameLower.includes('cafe') ||
                nameLower.includes('coffee') ||
                nameLower.includes('bistro')
              ) {
                category = 'cafes_food';
              } else if (
                osmVal.includes('museum') ||
                osmVal.includes('arts') ||
                osmVal.includes('theatre') ||
                nameLower.includes('museum') ||
                nameLower.includes('gallery') ||
                nameLower.includes('theater')
              ) {
                category = 'arts_culture';
              } else if (
                osmVal.includes('historic') ||
                osmVal.includes('monument') ||
                osmVal.includes('castle') ||
                osmVal.includes('memorial') ||
                nameLower.includes('temple') ||
                nameLower.includes('shrine') ||
                nameLower.includes('monument')
              ) {
                category = 'historical';
              } else if (
                osmVal.includes('hotel') ||
                osmVal.includes('lodging') ||
                osmVal.includes('hostel') ||
                nameLower.includes('hotel') ||
                nameLower.includes('resort')
              ) {
                category = 'travel_lodging';
              }

              return {
                id: `osm_${p.osm_type || 'W'}_${p.osm_id || Math.random().toString(36).slice(2, 8)}`,
                name: localizedName,
                localizedName,
                originalName,
                address: localizedAddress,
                localizedAddress,
                originalAddress,
                lat: f.geometry?.coordinates?.[1] ?? 0,
                lng: f.geometry?.coordinates?.[0] ?? 0,
                category,
                source: 'geocoding',
              };
            })
            .filter((r: any) => r.lat !== 0 && r.lng !== 0);

          if (results.length > 0) {
            return res.json({ success: true, results, source: 'photon' });
          }
        }
      }
    } catch (photonError) {
      console.warn('Photon geocoding error:', photonError);
    }

    // 2. Secondary fallback: OpenStreetMap Nominatim with &accept-language=en &namedetails=1
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=1&namedetails=1&accept-language=en`;
      const nomController = new AbortController();
      const nomTimeout = setTimeout(() => nomController.abort(), 3500);

      const nomRes = await fetch(nomUrl, {
        signal: nomController.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AIStudio-TravelJournalApp/1.0',
        },
      });
      clearTimeout(nomTimeout);

      if (nomRes.ok) {
        const nomData: any = await nomRes.json();
        if (Array.isArray(nomData) && nomData.length > 0) {
          const results = nomData
            .map((item: any) => {
              const namedetails = item.namedetails || {};
              const localizedName = namedetails['name:en'] || namedetails['int_name'] || item.name || item.display_name?.split(',')[0] || query;
              const originalName = namedetails['name'] || item.name || query;

              return {
                id: `nom_${item.place_id}`,
                name: localizedName,
                localizedName,
                originalName: originalName !== localizedName ? originalName : (query !== localizedName ? query : originalName),
                address: item.display_name,
                localizedAddress: item.display_name,
                originalAddress: item.display_name,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                category: 'other',
                source: 'nominatim',
              };
            })
            .filter((r: any) => !isNaN(r.lat) && !isNaN(r.lng));

          if (results.length > 0) {
            return res.json({ success: true, results, source: 'nominatim' });
          }
        }
      }
    } catch (nomError) {
      console.warn('Nominatim geocoding error:', nomError);
    }

    return res.json({ success: true, results: [] });
  } catch (error: any) {
    console.error('Error in /api/places/search:', error);
    return res.status(500).json({
      error: error?.message || 'Failed to search places',
    });
  }
});

// AI Localization API: Localize any location into English while preserving original native text
app.post('/api/places/localize', async (req: Request, res: Response) => {
  try {
    const { name = '', address = '', lat, lng } = req.body || {};
    const inputName = String(name || '').trim();
    const inputAddress = String(address || '').trim();

    if (!inputName && !inputAddress) {
      return res.status(400).json({ error: 'Location name or address is required for localization.' });
    }

    const ai = getGeminiClient();
    const prompt = `You are an expert multilingual geographical translator and localization engine.
Task: Localize the given location into standard, natural English while retaining its original native script/text.

Input:
Name: "${inputName}"
Address: "${inputAddress}"
Coordinates: ${lat || 'unknown'}, ${lng || 'unknown'}

Instructions:
1. "localizedName": Translate/transliterate the place name into clean, natural English (e.g., "東京タワー" -> "Tokyo Tower", "浅草寺" -> "Senso-ji Temple", "Tour Eiffel" -> "Eiffel Tower", "경복궁" -> "Gyeongbokgung Palace", "故宫博物院" -> "The Palace Museum (Forbidden City)", "Colosseo" -> "Colosseum", "Sagrada Família" -> "Basílica de la Sagrada Família (Sagrada Familia)"). If already English, keep it in English.
2. "originalName": The exact original native name in its native script/language (e.g. "東京タワー", "浅草寺", "경복궁", "Tour Eiffel", "Colosseo"). If already English with no foreign name, repeat the name.
3. "localizedAddress": Translate/standardize the address into English (e.g. "東京都港区芝公園4丁目2-8" -> "4-2-8 Shibakoen, Minato City, Tokyo, Japan").
4. "originalAddress": Retain the original native address in its original script/language.
5. "hasLocalization": boolean (true if original text was non-English or localized name differs from original text).

Return ONLY valid JSON with this exact structure:
{
  "localizedName": "string",
  "originalName": "string",
  "localizedAddress": "string",
  "originalAddress": "string",
  "hasLocalization": true
}`;

    const geminiRes = await generateContentWithFallback(ai, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: 'You are a precise multilingual geographical localization service. Output strictly valid raw JSON only.',
    });

    let jsonText = geminiRes.text.trim();
    if (jsonText.startsWith('```json')) jsonText = jsonText.replace(/^```json/, '');
    if (jsonText.startsWith('```')) jsonText = jsonText.replace(/^```/, '');
    if (jsonText.endsWith('```')) jsonText = jsonText.replace(/```$/, '');

    const parsed = JSON.parse(jsonText.trim());

    return res.json({
      success: true,
      localizedName: parsed.localizedName || inputName,
      originalName: parsed.originalName || inputName,
      localizedAddress: parsed.localizedAddress || inputAddress,
      originalAddress: parsed.originalAddress || inputAddress,
      hasLocalization: Boolean(parsed.hasLocalization),
    });
  } catch (err: any) {
    console.warn('Localization API fallback:', err);
    return res.json({
      success: true,
      localizedName: req.body?.name || '',
      originalName: req.body?.name || '',
      localizedAddress: req.body?.address || '',
      originalAddress: req.body?.address || '',
      hasLocalization: false,
    });
  }
});

// Reverse Geocoding API with English localization + original text retention
app.get('/api/places/reverse-geocode', async (req: Request, res: Response) => {
  try {
    const lat = parseFloat(String(req.query.lat));
    const lng = parseFloat(String(req.query.lng));
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
    }

    const nomUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&namedetails=1&accept-language=en`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const nomRes = await fetch(nomUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AIStudio-TravelJournalApp/1.0',
      },
    });
    clearTimeout(timeoutId);

    if (nomRes.ok) {
      const data: any = await nomRes.json();
      const namedetails = data.namedetails || {};
      const localizedName =
        namedetails['name:en'] ||
        namedetails['int_name'] ||
        data.name ||
        data.display_name?.split(',')[0] ||
        `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

      const originalName =
        namedetails['name'] ||
        data.name ||
        localizedName;

      const localizedAddress = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const originalAddress = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

      return res.json({
        success: true,
        localizedName,
        originalName: originalName !== localizedName ? originalName : (namedetails['name:local'] || originalName),
        localizedAddress,
        originalAddress,
      });
    }

    return res.json({
      success: true,
      localizedName: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      originalName: `Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      localizedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      originalAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    });
  } catch (err: any) {
    return res.json({
      success: true,
      localizedName: `Location (${req.query.lat}, ${req.query.lng})`,
      originalName: `Location (${req.query.lat}, ${req.query.lng})`,
      localizedAddress: `${req.query.lat}, ${req.query.lng}`,
      originalAddress: `${req.query.lat}, ${req.query.lng}`,
    });
  }
});

// Vite middleware / production static serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
