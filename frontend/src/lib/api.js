const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "")

async function request(path, options = {}) {
  const { body, headers, params, ...rest } = options
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin)

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value))
      }
    })
  }

  const requestHeaders = new Headers(headers ?? {})
  const config = {
    ...rest,
    headers: requestHeaders,
  }

  if (body !== undefined) {
    requestHeaders.set("Content-Type", "application/json")
    config.body = JSON.stringify(body)
  }

  const response = await fetch(url.toString(), config)

  if (!response.ok) {
    let detail = "Nao foi possivel concluir a requisicao."

    try {
      const payload = await response.json()
      detail = payload.detail ?? payload.message ?? detail
    } catch {
      detail = await response.text()
    }

    throw new Error(detail)
  }

  return response.json()
}

export const api = {
  getUiOptions() {
    return request("/api/ui/options")
  },
  getRuntime() {
    return request("/api/runtime")
  },
  getDatasets() {
    return request("/api/datasets")
  },
  getDatasetPreview(fileId, limit = 10) {
    return request("/api/datasets/preview", {
      params: {
        file_id: fileId,
        limit,
      },
    })
  },
  getExportHistory() {
    return request("/api/exports/history")
  },
  getResults() {
    return request("/api/results")
  },
  getResultDetail(resultFile) {
    return request(`/api/results/${encodeURIComponent(resultFile)}`)
  },
  exportFromDatasus(payload) {
    return request("/api/export", {
      method: "POST",
      body: payload,
    })
  },
  predict(payload) {
    return request("/api/predict", {
      method: "POST",
      body: payload,
    })
  },
}
