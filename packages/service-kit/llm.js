import { GoogleGenAI } from '@google/genai'

// Gemini via Google AI Studio. Free-tier rate limits are per Google Cloud project (not per
// key), so give local, staging and production their own AI Studio project and key.
const apiKey = process.env.GEMINI_API_KEY
export const MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite'
// Tried once when MODEL is overloaded or times out (5xx). Also free tier, with its own quota.
// Set GEMINI_FALLBACK_MODEL to the same value as GEMINI_MODEL to disable.
export const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite'

if (!apiKey) {
  console.warn('[llm] GEMINI_API_KEY is not set — /ask and the enrich job will not work')
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null

// Gemini answered 429: per-minute or per-day quota used up. Callers back off or stop.
export class RateLimitError extends Error {}

async function generate(model, { system, input, schema, temperature, timeoutMs }) {
  try {
    return await ai.models.generateContent({
      model,
      contents: input,
      config: {
        systemInstruction: system,
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
        temperature,
        httpOptions: { timeout: timeoutMs },
      },
    })
  } catch (err) {
    if (err.status === 429) throw new RateLimitError(err.message)
    throw err
  }
}

// One structured-output call. `schema` is plain JSON Schema (enum, minItems/maxItems work);
// returns the parsed object. The SDK also sends `timeoutMs` to Gemini as the server-side
// deadline (X-Server-Timeout), so a too-short value comes back as a 504, not a client abort.
export async function generateJson({ system, input, schema, temperature = 0.2, timeoutMs = 30_000 }) {
  if (!ai) throw new Error('GEMINI_API_KEY is not set')

  const request = { system, input, schema, temperature, timeoutMs }
  let res
  try {
    res = await generate(MODEL, request)
  } catch (err) {
    if (!(err.status >= 500) || FALLBACK_MODEL === MODEL) throw err
    console.warn(`[llm] ${MODEL} returned ${err.status}, retrying on ${FALLBACK_MODEL}`)
    res = await generate(FALLBACK_MODEL, request)
  }

  try {
    return JSON.parse(res.text)
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${String(res.text).slice(0, 200)}`)
  }
}
