const fallbackUrl = "http://localhost:3000";

export function getAppUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim() || fallbackUrl;
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

export function getDeploymentMode() {
  return process.env.FAIRPRICE_DEPLOYMENT_MODE === "production"
    ? "production"
    : "demo";
}
