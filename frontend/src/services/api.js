const API_URL = "";

export async function apiRequest(
  path,
  options = {},
  accessToken = null
) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers || {}),
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...options,
      headers,
      credentials: "include",
    }
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const error = new Error(
      data?.message || "Request failed"
    );

    error.status = response.status;

    throw error;
  }

  return data;
}

export async function getMySessions(accessToken) {
  return apiRequest(
    "/api/sessions",
    {
      method: "GET",
    },
    accessToken
  );
}