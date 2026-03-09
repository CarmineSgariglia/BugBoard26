export function resolveMediaUrl(pathOrUrl?: string): string {
  if (!pathOrUrl) return "";
  const backendOrigin =
    import.meta.env.VITE_BACKEND_PUBLIC_ORIGIN ??
    `${window.location.protocol}//${window.location.hostname}:8000`;

  if (pathOrUrl.startsWith("http://backend:8000")) {
    return `${backendOrigin}${pathOrUrl.slice("http://backend:8000".length)}`;
  }
  if (pathOrUrl.startsWith("https://backend:8000")) {
    return `${backendOrigin}${pathOrUrl.slice("https://backend:8000".length)}`;
  }
  if (pathOrUrl.startsWith("/media")) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith("media")) {
    return `/${pathOrUrl}`;
  }
  return pathOrUrl;
}
