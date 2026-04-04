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
    credentials: "include",
    headers: requestHeaders,
  }

  if (body !== undefined) {
    if (body instanceof FormData) {
      config.body = body
    } else {
      requestHeaders.set("Content-Type", "application/json")
      config.body = JSON.stringify(body)
    }
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
  getSession() {
    return request("/api/session")
  },
  getUiOptions() {
    return request("/api/ui/options")
  },
  getAvailability(system, uf, granularity) {
    return request("/api/ui/availability", {
      params: {
        system,
        uf,
        granularity,
      },
    })
  },
  getRuntime() {
    return request("/api/runtime")
  },
  getDatasets(diseaseSlug) {
    return request("/api/datasets", {
      params: {
        disease_slug: diseaseSlug,
      },
    })
  },
  getDatasetPreview(datasetId, limit = 10) {
    return request("/api/datasets/preview", {
      params: {
        dataset_id: datasetId,
        limit,
      },
    })
  },
  getExportHistory(diseaseSlug) {
    return request("/api/exports/history", {
      params: {
        disease_slug: diseaseSlug,
      },
    })
  },
  getResults(diseaseSlug) {
    return request("/api/results", {
      params: {
        disease_slug: diseaseSlug,
      },
    })
  },
  getResultDetail(forecastId) {
    return request(`/api/results/${encodeURIComponent(forecastId)}`)
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
