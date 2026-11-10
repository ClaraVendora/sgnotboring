// JSON calls from one service to another over the private network. Failures throw a
// ServiceError carrying the upstream status (503 when the service could not be reached),
// so routes can tell "a service is down" apart from their own errors.
export class ServiceError extends Error {}

export function createServiceClient(name, baseUrl, { timeoutMs = 10_000, fetchImpl = fetch } = {}) {
  const base = baseUrl.replace(/\/+$/, '')

  async function request(method, path, body) {
    let res
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        headers: body === undefined ? {} : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      })
    } catch (cause) {
      throw Object.assign(new ServiceError(`${name} service unreachable`, { cause }), { status: 503, service: name })
    }
    const text = await res.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      throw Object.assign(new ServiceError(`${name} service returned invalid JSON`), { status: 502, service: name })
    }
    if (!res.ok) {
      throw Object.assign(new ServiceError(`${name} service answered ${res.status}: ${data?.error ?? ''}`),
        { status: res.status, service: name })
    }
    return data
  }

  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
  }
}
