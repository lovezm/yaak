import type { HttpUrlParameter } from "@yaakapp-internal/models";

export function buildUrlFromParameters(
  currentUrl: string,
  urlParameters: HttpUrlParameter[],
): string {
  const [withoutFragment, fragment = ""] = currentUrl.split(/#(.*)/s);
  const [baseUrl = ""] = (withoutFragment ?? "").split(/\?(.*)/s);

  let nextUrl = applyPathParameters(baseUrl, urlParameters);

  const query = new URLSearchParams();
  for (const parameter of urlParameters) {
    if (!parameter.enabled || parameter.name.trim() === "") {
      continue;
    }
    if (parameter.name.startsWith(":")) {
      continue;
    }
    query.append(parameter.name, parameter.value);
  }

  const queryString = query.toString();
  if (queryString) {
    nextUrl += `?${queryString}`;
  }

  if (fragment) {
    nextUrl += `#${fragment}`;
  }

  return nextUrl;
}

function applyPathParameters(currentUrl: string, parameters: HttpUrlParameter[]): string {
  let nextUrl = currentUrl;

  for (const parameter of parameters) {
    if (!parameter.enabled || !parameter.name.startsWith(":")) {
      continue;
    }

    nextUrl = nextUrl.split(parameter.name).join(encodeURIComponent(parameter.value));
  }

  return nextUrl;
}
