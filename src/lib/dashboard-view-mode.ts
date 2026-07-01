export const dashboardViewModeCookie = "swimsight-dashboard-view";

export const dashboardViewModes = ["swimmer", "coach"] as const;

export type DashboardViewMode = (typeof dashboardViewModes)[number];

export function isDashboardViewMode(value: unknown): value is DashboardViewMode {
  return dashboardViewModes.includes(value as DashboardViewMode);
}
