const API_PREFIX = '/api'

async function request (path, options = {}) {
  const mergedHeaders = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }

  const response = await fetch(`${API_PREFIX}${path}`, {
    ...options,
    headers: mergedHeaders
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data?.ok === false) {
    const message = data?.message || `Request failed: ${response.status}`
    const error = new Error(message)
    error.status = response.status
    error.payload = data
    throw error
  }

  return data
}

export const api = {
  get: (path, options = {}) => request(path, options),
  post: (path, body, options = {}) => request(path, { ...options, method: 'POST', body: JSON.stringify(body || {}) }),
  patch: (path, body, options = {}) => request(path, { ...options, method: 'PATCH', body: JSON.stringify(body || {}) }),
  delete: (path, options = {}) => request(path, { ...options, method: 'DELETE' })
}
