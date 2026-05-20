import type {
  ConnectionStatus,
  MediaServiceKey,
  PublicMappingState,
  PublicMessageTemplate,
  PublicAppLiveStatus,
  PublicMonthlyRecapLibrary,
  PublicMonthlyRecapSchedule,
  PublicMonthlyRecapStatus,
  PublicNotificationJob,
  PublicOperationalLog,
  PublicServerGroup,
  PublicUserContactMapping,
  PublicWhatsAppMember,
  PublicWhatsAppStatus,
  WhatsAppGroup
} from "@whatsarr/shared";

export interface AuthStatus {
  isSetupComplete: boolean;
  isAuthenticated: boolean;
}

export interface ServiceSettings {
  serviceKey: MediaServiceKey;
  label: string;
  baseUrl: string | null;
  hasApiKey: boolean;
  hasUsername: boolean;
  hasPassword: boolean;
  updatedAt: string | null;
}

export interface ServiceTestResult {
  serviceKey: MediaServiceKey;
  status: ConnectionStatus;
  message: string;
}

export interface UpdateServicePayload {
  baseUrl?: string;
  apiKey?: string;
  username?: string;
  password?: string;
}

export async function getAuthStatus() {
  return request<AuthStatus>("/api/auth/status");
}

export async function setupAdmin(password: string) {
  return request<{ ok: true }>("/api/auth/setup", {
    method: "POST",
    body: JSON.stringify({ password })
  });
}

export async function login(password: string) {
  return request<{ ok: true }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ password })
  });
}

export async function logout() {
  return request<{ ok: true }>("/api/auth/logout", { method: "POST" });
}

export async function listServices() {
  return request<ServiceSettings[]>("/api/settings/services");
}

export async function updateService(
  serviceKey: MediaServiceKey,
  payload: UpdateServicePayload
) {
  return request<ServiceSettings>(`/api/settings/services/${serviceKey}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function testService(serviceKey: MediaServiceKey) {
  return request<ServiceTestResult>(`/api/settings/services/${serviceKey}/test`, {
    method: "POST"
  });
}

export async function getWhatsAppStatus() {
  return request<PublicWhatsAppStatus>("/api/whatsapp/status");
}

export async function connectWhatsApp(replaceExistingSession = false) {
  return request<PublicWhatsAppStatus>("/api/whatsapp/connect", {
    method: "POST",
    body: JSON.stringify({ replaceExistingSession })
  });
}

export async function listWhatsAppGroups() {
  return request<WhatsAppGroup[]>("/api/whatsapp/groups");
}

export async function refreshWhatsAppGroups() {
  return request<WhatsAppGroup[]>("/api/whatsapp/groups/refresh", {
    method: "POST"
  });
}

export async function selectWhatsAppServerGroup(
  group: Pick<WhatsAppGroup, "id" | "name">,
  confirmReplace = false
) {
  return request<PublicServerGroup>("/api/whatsapp/server-group", {
    method: "PUT",
    body: JSON.stringify({
      groupId: group.id,
      name: group.name,
      confirmReplace
    })
  });
}

export async function listWhatsAppMembers() {
  return request<PublicWhatsAppMember[]>("/api/whatsapp/members");
}

export async function importWhatsAppMembers() {
  return request<PublicWhatsAppMember[]>("/api/whatsapp/members/import", {
    method: "POST"
  });
}

export async function getMappingState() {
  return request<PublicMappingState>("/api/mapping");
}

export async function importPlexUsers() {
  return request<PublicMappingState>("/api/mapping/plex-users/import", {
    method: "POST"
  });
}

export async function createUserContactMapping(plexUserId: string, whatsappId: string) {
  return request<PublicUserContactMapping>("/api/mapping/links", {
    method: "POST",
    body: JSON.stringify({ plexUserId, whatsappId })
  });
}

export async function deleteUserContactMapping(id: string) {
  return request<PublicUserContactMapping>(`/api/mapping/links/${id}`, {
    method: "DELETE"
  });
}

export async function listTemplates() {
  return request<PublicMessageTemplate[]>("/api/templates");
}

export async function updateTemplate(type: string, body: string) {
  return request<PublicMessageTemplate>(`/api/templates/${type}`, {
    method: "PUT",
    body: JSON.stringify({ body })
  });
}

export async function previewTemplate(
  type: string,
  body: string,
  variables?: Record<string, string>
) {
  return request<{ rendered: string }>(`/api/templates/${type}/preview`, {
    method: "POST",
    body: JSON.stringify({ body, variables })
  });
}

export async function getRecentWindow() {
  return request<{ months: number }>("/api/media/recent-window");
}

export async function updateRecentWindow(months: number) {
  return request<{ months: number }>("/api/media/recent-window", {
    method: "PUT",
    body: JSON.stringify({ months })
  });
}

export async function listNotificationJobs() {
  return request<PublicNotificationJob[]>("/api/notifications/jobs");
}

export async function processNotificationJobs() {
  return request<{ ok: true }>("/api/notifications/jobs/process", { method: "POST" });
}

export async function retryNotificationJob(id: string) {
  return request<PublicNotificationJob>(`/api/notifications/jobs/${id}/retry`, {
    method: "POST"
  });
}

export async function listOperationalLogs() {
  return request<PublicOperationalLog[]>("/api/notifications/logs");
}

export async function getMonthlyRecapLibraries() {
  return request<{ items: PublicMonthlyRecapLibrary[] }>("/api/monthly-recap/libraries");
}

export async function updateMonthlyRecapLibraries(includedLibraryKeys: string[]) {
  return request<{ items: PublicMonthlyRecapLibrary[] }>("/api/monthly-recap/libraries", {
    method: "PUT",
    body: JSON.stringify({ includedLibraryKeys })
  });
}

export async function getMonthlyRecapStatus() {
  return request<PublicMonthlyRecapStatus | null>("/api/monthly-recap/status");
}

export async function getMonthlyRecapSchedule() {
  return request<PublicMonthlyRecapSchedule>("/api/monthly-recap/schedule");
}

export async function updateMonthlyRecapSchedule(
  dayOfMonth: number,
  time: string
) {
  return request<PublicMonthlyRecapSchedule>("/api/monthly-recap/schedule", {
    method: "PUT",
    body: JSON.stringify({ dayOfMonth, time })
  });
}

export async function runMonthlyRecap(referenceDate?: string) {
  return request<PublicMonthlyRecapStatus | null>("/api/monthly-recap/run", {
    method: "POST",
    body: JSON.stringify({ referenceDate })
  });
}

export async function getAppLiveStatus() {
  return request<PublicAppLiveStatus>("/api/status");
}

async function request<T>(url: string, options: RequestInit = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? "Erreur API inattendue.");
  }

  return response.json() as Promise<T>;
}
