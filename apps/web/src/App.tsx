import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  CalendarDays,
  CheckCircle2,
  FileText,
  KeyRound,
  ListChecks,
  Loader2,
  LogOut,
  MessageCircle,
  QrCode,
  RefreshCw,
  Save,
  Server,
  Settings,
  Shield,
  TestTube2,
  TriangleAlert,
  Users
} from "lucide-react";
import type {
  ConnectionStatus,
  MediaServiceKey,
  PublicAppLiveStatus,
  PublicMessageTemplate,
  PublicMonthlyRecapLibrary,
  PublicMonthlyRecapSchedule,
  PublicMonthlyRecapStatus,
  PublicNotificationJob,
  PublicOperationalLog,
  PublicWhatsAppMember,
  PublicWhatsAppStatus,
  WhatsAppGroup
} from "@whatsarr/shared";
import {
  ServiceSettings,
  ServiceTestResult,
  connectWhatsApp,
  getAppLiveStatus,
  getAuthStatus,
  getMonthlyRecapLibraries,
  getMonthlyRecapSchedule,
  getMonthlyRecapStatus,
  getRecentWindow,
  getWhatsAppStatus,
  importWhatsAppMembers,
  listNotificationJobs,
  listOperationalLogs,
  listServices,
  listTemplates,
  listWhatsAppGroups,
  listWhatsAppMembers,
  login,
  logout,
  previewTemplate,
  processNotificationJobs,
  refreshWhatsAppGroups,
  retryNotificationJob,
  runMonthlyRecap,
  selectWhatsAppServerGroup,
  setupAdmin,
  testService,
  updateMonthlyRecapLibraries,
  updateMonthlyRecapSchedule,
  updateRecentWindow,
  updateService,
  updateTemplate
} from "./api";
import { MappingPage } from "./MappingPage";

const REQUIRED_URL_SERVICES = new Set<MediaServiceKey>([
  "plex",
  "tautulli",
  "overseerr",
  "radarr",
  "sonarr"
]);

const STATUS_LABELS: Record<ConnectionStatus, string> = {
  connected: "Connecte",
  authentication_error: "Erreur d'authentification",
  unreachable: "Inaccessible",
  not_configured: "Non configure"
};

const WHATSAPP_STATE_LABELS: Record<PublicWhatsAppStatus["state"], string> = {
  disconnected: "Deconnecte",
  initializing: "Initialisation",
  qr: "QR code pret",
  restoring: "Restauration",
  connected: "Connecte",
  failed: "Erreur"
};

type View = "dashboard" | "settings" | "whatsapp" | "mapping" | "templates" | "messages";

export function App() {
  const [auth, setAuth] = useState({
    isSetupComplete: false,
    isAuthenticated: false,
    isAuthDisabled: false
  });
  const [services, setServices] = useState<ServiceSettings[]>([]);
  const [view, setView] = useState<View>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const status = await getAuthStatus();
      setAuth(status);
      if (status.isAuthenticated) {
        setServices(await listServices());
      }
    } catch (err) {
      setError(readError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    if (auth.isAuthDisabled) {
      return;
    }

    await logout();
    setAuth({ isSetupComplete: true, isAuthenticated: false, isAuthDisabled: false });
    setServices([]);
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (!auth.isAuthenticated) {
    return (
      <AuthScreen
        mode={auth.isSetupComplete ? "login" : "setup"}
        error={error}
        onAuthenticated={refresh}
      />
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">W</div>
          <div>
            <strong>Whatsarr</strong>
            <span>Administration locale</span>
          </div>
        </div>
        <nav className="nav-list">
          <button
            className={`nav-item ${view === "dashboard" ? "active" : ""}`}
            type="button"
            onClick={() => setView("dashboard")}
          >
            <Activity size={18} />
            Dashboard
          </button>
          <button
            className={`nav-item ${view === "settings" ? "active" : ""}`}
            type="button"
            onClick={() => setView("settings")}
          >
            <Settings size={18} />
            Parametres
          </button>
          <button
            className={`nav-item ${view === "whatsapp" ? "active" : ""}`}
            type="button"
            onClick={() => setView("whatsapp")}
          >
            <MessageCircle size={18} />
            WhatsApp
          </button>
          <button
            className={`nav-item ${view === "mapping" ? "active" : ""}`}
            type="button"
            onClick={() => setView("mapping")}
          >
            <Users size={18} />
            Mapping
          </button>
          <button
            className={`nav-item ${view === "templates" ? "active" : ""}`}
            type="button"
            onClick={() => setView("templates")}
          >
            <FileText size={18} />
            Templates
          </button>
          <button
            className={`nav-item ${view === "messages" ? "active" : ""}`}
            type="button"
            onClick={() => setView("messages")}
          >
            <ListChecks size={18} />
            Messages
          </button>
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h1>{viewTitle(view)}</h1>
            <p>
              {view === "settings"
                ? "Plex, Tautulli, Overseerr, Radarr, Sonarr et TMDB"
                : viewDescription(view)}
            </p>
          </div>
          {!auth.isAuthDisabled ? (
            <button className="icon-button" type="button" onClick={handleLogout} title="Deconnexion">
              <LogOut size={18} />
            </button>
          ) : null}
        </header>

        {error ? <div className="notice error">{error}</div> : null}

        {view === "dashboard" ? (
          <DashboardPage />
        ) : view === "settings" ? (
          <SettingsPage
            services={services}
            onSaved={(updated) =>
              setServices((current) =>
                current.map((item) =>
                  item.serviceKey === updated.serviceKey ? updated : item
                )
              )
            }
          />
        ) : view === "whatsapp" ? (
          <WhatsAppPage />
        ) : view === "mapping" ? (
          <MappingPage />
        ) : view === "templates" ? (
          <TemplatesPage />
        ) : (
          <MessagesPage />
        )}
      </section>
    </main>
  );
}

function viewTitle(view: View) {
  if (view === "dashboard") {
    return "Dashboard";
  }
  if (view === "settings") {
    return "Parametres services";
  }
  if (view === "whatsapp") {
    return "WhatsApp";
  }
  if (view === "mapping") {
    return "Mapping";
  }
  if (view === "templates") {
    return "Templates";
  }
  return "Messages automatiques";
}

function viewDescription(view: View) {
  if (view === "dashboard") {
    return "Statuts live, recap mensuel et integrations";
  }
  if (view === "whatsapp") {
    return "Connexion, groupe serveur et contacts importes";
  }
  if (view === "mapping") {
    return "Utilisateurs Plex, contacts WhatsApp et associations";
  }
  if (view === "templates") {
    return "Textes automatiques, variables et filtre de nouveaute";
  }
  return "Outbox, statuts d'envoi et erreurs operationnelles";
}

function DashboardPage() {
  const [liveStatus, setLiveStatus] = useState<PublicAppLiveStatus | null>(null);
  const [libraries, setLibraries] = useState<PublicMonthlyRecapLibrary[]>([]);
  const [recapStatus, setRecapStatus] = useState<PublicMonthlyRecapStatus | null>(null);
  const [recapSchedule, setRecapSchedule] = useState<PublicMonthlyRecapSchedule>({
    dayOfMonth: 1,
    time: "09:00"
  });
  const [sseState, setSseState] = useState<"connecting" | "connected" | "degraded">(
    "connecting"
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();

    const events = new EventSource("/api/status/events", {
      withCredentials: true
    });
    events.onmessage = (event) => {
      setLiveStatus(JSON.parse(event.data) as PublicAppLiveStatus);
      setSseState("connected");
    };
    events.onerror = () => {
      setSseState("degraded");
      void loadStatusFallback();
    };

    return () => events.close();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [status, libraryResult, monthlyStatus, schedule] = await Promise.all([
        getAppLiveStatus(),
        getMonthlyRecapLibraries(),
        getMonthlyRecapStatus(),
        getMonthlyRecapSchedule()
      ]);
      setLiveStatus(status);
      setLibraries(libraryResult.items);
      setRecapStatus(monthlyStatus);
      setRecapSchedule(schedule);
    } catch (err) {
      setError(readError(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadStatusFallback() {
    try {
      setLiveStatus(await getAppLiveStatus());
    } catch {
      setSseState("degraded");
    }
  }

  async function toggleRecapLibrary(plexKey: string) {
    setBusy(true);
    setError(null);
    try {
      const includedLibraryKeys = libraries
        .filter((library) =>
          library.plexKey === plexKey ? !library.recapIncluded : library.recapIncluded
        )
        .map((library) => library.plexKey);
      const notificationLibraryKeys = libraries
        .filter((library) => library.notificationIncluded)
        .map((library) => library.plexKey);
      const updated = await updateMonthlyRecapLibraries(
        includedLibraryKeys,
        notificationLibraryKeys
      );
      setLibraries(updated.items);
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleNotificationLibrary(plexKey: string) {
    setBusy(true);
    setError(null);
    try {
      const includedLibraryKeys = libraries
        .filter((library) => library.recapIncluded)
        .map((library) => library.plexKey);
      const notificationLibraryKeys = libraries
        .filter((library) =>
          library.plexKey === plexKey
            ? !library.notificationIncluded
            : library.notificationIncluded
        )
        .map((library) => library.plexKey);
      const updated = await updateMonthlyRecapLibraries(
        includedLibraryKeys,
        notificationLibraryKeys
      );
      setLibraries(updated.items);
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  }

  async function triggerRecap() {
    setBusy(true);
    setError(null);
    try {
      setRecapStatus(await runMonthlyRecap());
      setLiveStatus(await getAppLiveStatus());
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveRecapSchedule() {
    setBusy(true);
    setError(null);
    try {
      setRecapSchedule(
        await updateMonthlyRecapSchedule(recapSchedule.dayOfMonth, recapSchedule.time)
      );
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <LoadingScreen inline />;
  }

  const rankingByLibrary = groupRankingByLibrary(recapStatus?.ranking ?? []);

  return (
    <div className="dashboard-layout">
      {error ? <div className="notice error">{error}</div> : null}
      <section className="dashboard-main">
        <article className="service-panel">
          <header>
            <div>
              <h2>Statuts live</h2>
              <p>{sseState === "connected" ? "Flux SSE actif" : "Fallback REST actif"}</p>
            </div>
            <Activity size={20} />
          </header>
          <div className="status-grid">
            <StatusTile
              label="WhatsApp"
              value={liveStatus ? WHATSAPP_STATE_LABELS[liveStatus.whatsApp.state] : "-"}
              tone={liveStatus?.whatsApp.state === "connected" ? "ok" : "warn"}
            />
            <StatusTile
              label="Integrations"
              value={`${liveStatus?.integrations.filter((item) => item.configured).length ?? 0}/${liveStatus?.integrations.length ?? 0}`}
              tone="neutral"
            />
            <StatusTile
              label="Jobs recents"
              value={String(liveStatus?.jobs.length ?? 0)}
              tone="neutral"
            />
            <StatusTile
              label="SSE"
              value={sseState === "degraded" ? "Degrade" : "Connecte"}
              tone={sseState === "degraded" ? "warn" : "ok"}
            />
          </div>
        </article>

        <article className="service-panel">
          <header>
            <div>
              <h2>Bibliotheques</h2>
              <p>
                {libraries.filter((library) => library.recapIncluded).length} recap,
                {" "}
                {libraries.filter((library) => library.notificationIncluded).length} messages
              </p>
            </div>
            <Server size={20} />
          </header>
          <div className="library-list">
            {libraries.map((library) => (
              <div
                className={`library-row ${library.recapIncluded ? "selected" : ""}`}
                key={library.plexKey}
              >
                <span>
                  <strong>{library.title}</strong>
                  <small>{library.type ?? "Bibliotheque Plex"} - {library.plexKey}</small>
                </span>
                <div className="library-actions">
                  <button
                    className={`mini-toggle ${library.recapIncluded ? "active" : ""}`}
                    disabled={busy}
                    onClick={() => toggleRecapLibrary(library.plexKey)}
                    type="button"
                  >
                    Recap
                  </button>
                  <button
                    className={`mini-toggle ${library.notificationIncluded ? "active" : ""}`}
                    disabled={busy}
                    onClick={() => toggleNotificationLibrary(library.plexKey)}
                    type="button"
                  >
                    Messages
                  </button>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>

      <aside className="dashboard-side">
        <article className="service-panel">
          <header>
            <div>
              <h2>Recap mensuel</h2>
              <p>{recapStatus?.month ?? "Aucun calcul"}</p>
            </div>
            <CalendarDays size={20} />
          </header>
          {recapStatus ? (
            <div className="recap-status">
              <strong className={`job-status ${recapStatus.status}`}>{recapStatus.status}</strong>
              <span>{recapReasonLabel(recapStatus.reason)}</span>
              <small>Calcule le {new Date(recapStatus.calculatedAt).toLocaleString()}</small>
              {recapStatus.sentAt ? (
                <small>Envoye le {new Date(recapStatus.sentAt).toLocaleString()}</small>
              ) : null}
            </div>
          ) : (
            <div className="recap-status">
              <span>Aucun recap tente.</span>
            </div>
          )}
          <div className="schedule-form">
            <label>
              Jour
              <input
                max={31}
                min={1}
                type="number"
                value={recapSchedule.dayOfMonth}
                onChange={(event) =>
                  setRecapSchedule((current) => ({
                    ...current,
                    dayOfMonth: Number(event.target.value)
                  }))
                }
              />
            </label>
            <label>
              Heure
              <input
                type="time"
                value={recapSchedule.time}
                onChange={(event) =>
                  setRecapSchedule((current) => ({
                    ...current,
                    time: event.target.value
                  }))
                }
              />
            </label>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={saveRecapSchedule}
              type="button"
            >
              <Save size={17} />
              Sauver
            </button>
          </div>
          <button className="primary-button full-width" disabled={busy} onClick={triggerRecap} type="button">
            {busy ? <Loader2 className="spin" size={17} /> : <Bell size={17} />}
            Calculer sans envoyer
          </button>
        </article>

        <article className="service-panel">
          <header>
            <div>
              <h2>Classement</h2>
              <p>{recapStatus?.ranking.length ?? 0} entree(s)</p>
            </div>
            <ListChecks size={20} />
          </header>
          <div className="ranking-list">
            {rankingByLibrary.length ? rankingByLibrary.map((group) => (
              <div className="ranking-group" key={group.libraryKey}>
                <div className="ranking-group-title">
                  <strong>{group.libraryTitle}</strong>
                  <small>{group.entries.length} entree(s)</small>
                </div>
                {group.entries.map((entry, index) => (
                  <div className="ranking-row compact" key={entry.key}>
                    <strong>{index + 1}. {entry.title}</strong>
                    <span>{entry.distinctUserCount} utilisateur(s)</span>
                    <small>{entry.mediaType === "movie" ? "Film" : "Serie"} - {entry.rawPlayCount} lecture(s)</small>
                  </div>
                ))}
              </div>
            )) : (
              <div className="ranking-row">
                <strong>Aucun classement disponible</strong>
                <span>{recapStatus ? recapReasonLabel(recapStatus.reason) : "Lancez un calcul"}</span>
              </div>
            )}
          </div>
        </article>
      </aside>
    </div>
  );
}

function groupRankingByLibrary(entries: PublicMonthlyRecapStatus["ranking"]) {
  const groups = new Map<
    string,
    {
      libraryKey: string;
      libraryTitle: string;
      entries: PublicMonthlyRecapStatus["ranking"];
    }
  >();

  for (const entry of entries) {
    const libraryKey = entry.libraryKey ?? "all";
    const libraryTitle = entry.libraryTitle ?? "Bibliotheques";
    const group = groups.get(libraryKey) ?? {
      libraryKey,
      libraryTitle,
      entries: []
    };
    group.entries.push(entry);
    groups.set(entry.libraryKey, group);
  }

  return Array.from(groups.values());
}

function StatusTile({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "neutral";
}) {
  return (
    <div className={`status-tile ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function recapReasonLabel(reason: string | null) {
  if (reason === "no_libraries") {
    return "Aucune bibliotheque selectionnee";
  }
  if (reason === "no_views") {
    return "Aucune vue sur la periode";
  }
  if (reason === "missing_server_group") {
    return "Groupe serveur manquant";
  }
  if (reason === "duplicate_month") {
    return "Doublon evite";
  }
  if (reason === "stats_source_unavailable") {
    return "Source de statistiques indisponible";
  }
  if (reason === "manual_preview") {
    return "Classement calcule sans envoi";
  }
  return reason ?? "Pret";
}

function SettingsPage({
  services,
  onSaved
}: {
  services: ServiceSettings[];
  onSaved: (service: ServiceSettings) => void;
}) {
  return (
    <>
      <div className="service-grid">
        {services.map((service) => (
          <ServicePanel key={service.serviceKey} service={service} onSaved={onSaved} />
        ))}
      </div>
      <article className="service-panel tmdb-attribution">
        <strong>Attribution TMDB</strong>
        <span>
          Whatsarr utilise TMDB pour enrichir les titres, affiches, synopsis, dates et
          notes lorsque la cle TMDB est configuree.
        </span>
      </article>
    </>
  );
}

function TemplatesPage() {
  const [templates, setTemplates] = useState<PublicMessageTemplate[]>([]);
  const [recentMonths, setRecentMonths] = useState(6);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [loadedTemplates, recentWindow] = await Promise.all([
        listTemplates(),
        getRecentWindow()
      ]);
      setTemplates(loadedTemplates);
      setRecentMonths(recentWindow.months);
    } catch (err) {
      setError(readError(err));
    } finally {
      setLoading(false);
    }
  }

  async function saveRecentWindow() {
    setError(null);
    try {
      const updated = await updateRecentWindow(recentMonths);
      setRecentMonths(updated.months);
    } catch (err) {
      setError(readError(err));
    }
  }

  if (loading) {
    return <LoadingScreen inline />;
  }

  return (
    <div className="templates-layout">
      {error ? <div className="notice error">{error}</div> : null}
      <article className="service-panel template-settings">
        <header>
          <div>
            <h2>Filtre nouveautes</h2>
            <p>Fenetre par defaut : 6 mois</p>
          </div>
          <Bell size={20} />
        </header>
        <div className="inline-setting">
          <label>
            Mois
            <input
              max={60}
              min={1}
              type="number"
              value={recentMonths}
              onChange={(event) => setRecentMonths(Number(event.target.value))}
            />
          </label>
          <button className="primary-button" type="button" onClick={saveRecentWindow}>
            <Save size={17} />
            Sauver
          </button>
        </div>
      </article>

      <div className="service-grid">
        {templates.map((template) => (
          <TemplatePanel
            key={template.type}
            template={template}
            onSaved={(updated) =>
              setTemplates((current) =>
                current.map((item) => (item.type === updated.type ? updated : item))
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

function TemplatePanel({
  template,
  onSaved
}: {
  template: PublicMessageTemplate;
  onSaved: (template: PublicMessageTemplate) => void;
}) {
  const [body, setBody] = useState(template.body);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePreview() {
    setBusy(true);
    setError(null);
    try {
      setPreview((await previewTemplate(template.type, body)).rendered);
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      onSaved(await updateTemplate(template.type, body));
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="service-panel template-panel">
      <header>
        <div>
          <h2>{template.label}</h2>
          <p>{template.variables.length} variable(s) autorisee(s)</p>
        </div>
        <FileText size={20} />
      </header>
      <textarea value={body} onChange={(event) => setBody(event.target.value)} />
      <div className="variable-list">
        {template.variables.map((variable) => (
          <span key={variable}>{`{{${variable}}}`}</span>
        ))}
      </div>
      {error ? <div className="notice error">{error}</div> : null}
      {preview ? <pre className="template-preview">{preview}</pre> : null}
      <div className="button-row">
        <button className="secondary-button" type="button" onClick={handlePreview} disabled={busy}>
          {busy ? <Loader2 className="spin" size={17} /> : <TestTube2 size={17} />}
          Apercu
        </button>
        <button className="primary-button" type="button" onClick={handleSave} disabled={busy}>
          {busy ? <Loader2 className="spin" size={17} /> : <Save size={17} />}
          Sauver
        </button>
      </div>
    </article>
  );
}

function MessagesPage() {
  const [jobs, setJobs] = useState<PublicNotificationJob[]>([]);
  const [logs, setLogs] = useState<PublicOperationalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [loadedJobs, loadedLogs] = await Promise.all([
        listNotificationJobs(),
        listOperationalLogs()
      ]);
      setJobs(loadedJobs);
      setLogs(loadedLogs);
    } catch (err) {
      setError(readError(err));
    } finally {
      setLoading(false);
    }
  }

  async function processJobs() {
    setBusy(true);
    setError(null);
    try {
      await processNotificationJobs();
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  }

  async function retryJob(id: string) {
    setBusy(true);
    setError(null);
    try {
      await retryNotificationJob(id);
      await load();
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <LoadingScreen inline />;
  }

  return (
    <div className="messages-layout">
      {error ? <div className="notice error">{error}</div> : null}
      <section className="messages-main">
        <article className="service-panel">
          <header>
            <div>
              <h2>Outbox</h2>
              <p>{jobs.length} job(s) recent(s)</p>
            </div>
            <ListChecks size={20} />
          </header>
          <div className="button-row left">
            <button className="secondary-button" type="button" onClick={load} disabled={busy}>
              <RefreshCw size={17} />
              Rafraichir
            </button>
            <button className="primary-button" type="button" onClick={processJobs} disabled={busy}>
              {busy ? <Loader2 className="spin" size={17} /> : <Bell size={17} />}
              Traiter
            </button>
          </div>
          <div className="job-list">
            {jobs.map((job) => (
              <div className="job-row" key={job.id}>
                <span>
                  <strong>{job.type}</strong>
                  <small>
                    {job.targetType} - {job.targetId}
                  </small>
                </span>
                <em className={`job-status ${job.status}`}>{job.status}</em>
                <small>{new Date(job.updatedAt).toLocaleString()}</small>
                {job.lastError ? <p>{job.lastError}</p> : null}
                {job.status === "failed" ? (
                  <button className="secondary-button" type="button" onClick={() => retryJob(job.id)}>
                    <RefreshCw size={17} />
                    Relancer
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      </section>

      <aside className="messages-side">
        <article className="service-panel">
          <header>
            <div>
              <h2>Logs</h2>
              <p>{logs.length} evenement(s)</p>
            </div>
            <FileText size={20} />
          </header>
          <div className="log-list">
            {logs.map((log) => (
              <div className={`log-row ${log.level}`} key={log.id}>
                <strong>{log.event}</strong>
                <span>{log.reason ?? log.level}</span>
                <p>{log.message}</p>
                <small>{log.requestId ?? "Sans requestId"}</small>
              </div>
            ))}
          </div>
        </article>
      </aside>
    </div>
  );
}

function WhatsAppPage() {
  const [status, setStatus] = useState<PublicWhatsAppStatus | null>(null);
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [members, setMembers] = useState<PublicWhatsAppMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadInitialState();

    const events = new EventSource("/api/whatsapp/events", {
      withCredentials: true
    });

    events.onmessage = (event) => {
      setStatus(JSON.parse(event.data) as PublicWhatsAppStatus);
    };
    events.onerror = () => {
      setError("Le flux live WhatsApp est indisponible.");
    };

    return () => events.close();
  }, []);

  useEffect(() => {
    if (status?.state === "connected") {
      void loadGroups();
    }
  }, [status?.state]);

  async function loadInitialState() {
    setLoading(true);
    setError(null);
    try {
      const current = await getWhatsAppStatus();
      setStatus(current);
      setMembers(await listWhatsAppMembers());
      if (current.state === "connected") {
        setGroups(await listWhatsAppGroups());
      }
    } catch (err) {
      setError(readError(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadGroups() {
    try {
      setGroups(await listWhatsAppGroups());
    } catch (err) {
      setError(readError(err));
    }
  }

  async function handleConnect() {
    setBusy(true);
    setError(null);
    try {
      setStatus(await connectWhatsApp(false));
    } catch (err) {
      const message = readError(err);
      if (
        message.includes("Une seule session") &&
        window.confirm("Remplacer la session WhatsApp locale existante ?")
      ) {
        setStatus(await connectWhatsApp(true));
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRecreateConnection() {
    setBusy(true);
    setError(null);
    try {
      setStatus(await connectWhatsApp(true));
      setGroups([]);
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshGroups() {
    setBusy(true);
    setError(null);
    try {
      setGroups(await refreshWhatsAppGroups());
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleSelectGroup(group: WhatsAppGroup) {
    setBusy(true);
    setError(null);
    try {
      const selectedGroup = await selectWhatsAppServerGroup(group, false);
      setStatus((current) => (current ? { ...current, selectedGroup } : current));
    } catch (err) {
      const message = readError(err);
      if (
        message.includes("Groupe serveur") &&
        window.confirm("Remplacer le Groupe serveur WhatsApp ?")
      ) {
        const selectedGroup = await selectWhatsAppServerGroup(group, true);
        setStatus((current) => (current ? { ...current, selectedGroup } : current));
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleImportMembers() {
    setBusy(true);
    setError(null);
    try {
      setMembers(await importWhatsAppMembers());
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !status) {
    return <LoadingScreen inline />;
  }

  const connected = status.state === "connected";
  const canRecreateConnection = !connected && status.hasLocalSession;

  return (
    <div className="whatsapp-layout">
      <section className="whatsapp-main">
        <article className="service-panel status-card">
          <header>
            <div>
              <h2>Session WhatsApp</h2>
              <p>{status.message}</p>
            </div>
            <MessageCircle size={21} />
          </header>

          <div className={`whatsapp-state ${status.state}`}>
            <span>{WHATSAPP_STATE_LABELS[status.state]}</span>
            <small>
              {status.hasLocalSession
                ? "Session locale detectee"
                : "Aucune session locale"}
            </small>
          </div>

          {status.qrCodeDataUrl ? (
            <div className="qr-panel">
              <img src={status.qrCodeDataUrl} alt="QR code WhatsApp" />
            </div>
          ) : null}

          {error ? <div className="notice error">{error}</div> : null}

          <div className="button-row left">
            {canRecreateConnection ? (
              <button
                className="primary-button"
                type="button"
                onClick={handleRecreateConnection}
                disabled={busy}
              >
                {busy ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
                Recreer la connexion
              </button>
            ) : (
              <button className="primary-button" type="button" onClick={handleConnect} disabled={busy}>
                {busy ? <Loader2 className="spin" size={17} /> : <QrCode size={17} />}
                {connected ? "Remplacer" : "Connecter"}
              </button>
            )}
          </div>
        </article>

        <article className="service-panel">
          <header>
            <div>
              <h2>Groupes WhatsApp</h2>
              <p>
                {connected
                  ? `${groups.length} groupe(s) disponible(s)`
                  : "Connexion WhatsApp requise"}
              </p>
            </div>
            <Server size={20} />
          </header>

          <div className="button-row left">
            <button
              className="secondary-button"
              type="button"
              onClick={handleRefreshGroups}
              disabled={!connected || busy}
            >
              {busy ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
              Rafraichir
            </button>
          </div>

          <div className="table-list">
            {groups.map((group) => {
              const selected = status.selectedGroup?.groupId === group.id;
              return (
                <button
                  className={`group-row ${selected ? "selected" : ""}`}
                  key={group.id}
                  type="button"
                  onClick={() => handleSelectGroup(group)}
                  disabled={busy}
                >
                  <span>
                    <strong>{group.name}</strong>
                    <small>{group.id}</small>
                  </span>
                  <em>{group.participantCount}</em>
                </button>
              );
            })}
          </div>
        </article>
      </section>

      <aside className="whatsapp-side">
        <article className="service-panel">
          <header>
            <div>
              <h2>Groupe serveur</h2>
              <p>{status.selectedGroup?.name ?? "Aucun groupe selectionne"}</p>
            </div>
            <CheckCircle2 size={20} />
          </header>
          <div className="selected-group-id">
            {status.selectedGroup?.groupId ?? "WHATSAPP_GROUP_NOT_SELECTED"}
          </div>
        </article>

        <article className="service-panel">
          <header>
            <div>
              <h2>Membres</h2>
              <p>{members.length} contact(s) importes</p>
            </div>
            <Users size={20} />
          </header>

          <button
            className="primary-button full-width"
            type="button"
            onClick={handleImportMembers}
            disabled={!connected || !status.selectedGroup || busy}
          >
            {busy ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
            Importer
          </button>

          <div className="member-list">
            {members.map((member) => (
              <div className="member-row" key={member.whatsappId}>
                <strong>{member.displayName}</strong>
                <span>{member.mappingStatus === "non_lie" ? "Non lie" : member.mappingStatus}</span>
              </div>
            ))}
          </div>
        </article>
      </aside>
    </div>
  );
}

function AuthScreen({
  mode,
  error,
  onAuthenticated
}: {
  mode: "setup" | "login";
  error: string | null;
  onAuthenticated: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(error);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      if (mode === "setup") {
        await setupAdmin(password);
      } else {
        await login(password);
      }
      await onAuthenticated();
    } catch (err) {
      setFormError(readError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="auth-panel" onSubmit={handleSubmit}>
        <div className="auth-icon">
          {mode === "setup" ? <Shield size={26} /> : <KeyRound size={26} />}
        </div>
        <h1>{mode === "setup" ? "Creer l'acces admin" : "Connexion admin"}</h1>
        <label>
          Mot de passe
          <input
            autoFocus
            minLength={12}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {formError ? <div className="notice error">{formError}</div> : null}
        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="spin" size={18} /> : <Shield size={18} />}
          {mode === "setup" ? "Creer" : "Se connecter"}
        </button>
      </form>
    </main>
  );
}

function ServicePanel({
  service,
  onSaved
}: {
  service: ServiceSettings;
  onSaved: (service: ServiceSettings) => void;
}) {
  const [baseUrl, setBaseUrl] = useState(service.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ServiceTestResult | null>(null);

  const needsUrl = REQUIRED_URL_SERVICES.has(service.serviceKey);
  const isValid = useMemo(() => {
    if (needsUrl && !baseUrl.trim()) {
      return false;
    }
    return service.hasApiKey || apiKey.trim().length > 0;
  }, [apiKey, baseUrl, needsUrl, service.hasApiKey]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const updated = await updateService(service.serviceKey, {
        baseUrl: needsUrl ? baseUrl.trim() : undefined,
        apiKey: apiKey.trim() || undefined
      });
      setApiKey("");
      onSaved(updated);
    } catch (err) {
      setError(readError(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    try {
      setTestResult(await testService(service.serviceKey));
    } catch (err) {
      setError(readError(err));
    } finally {
      setTesting(false);
    }
  }

  return (
    <article className="service-panel">
      <header>
        <div>
          <h2>{service.label}</h2>
          <p>{service.hasApiKey ? "Secret sauvegarde et masque" : "Cle API requise"}</p>
        </div>
        <Server size={20} />
      </header>

      <form className="service-form" onSubmit={handleSave}>
        {needsUrl ? (
          <label>
            URL
            <input
              placeholder="http://service:port"
              type="url"
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              required
            />
          </label>
        ) : null}

        <label>
          Cle API
          <input
            placeholder={service.hasApiKey ? "Remplacer la cle masquee" : "Coller la cle API"}
            type="password"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            required={!service.hasApiKey}
          />
        </label>

        {error ? <div className="notice error">{error}</div> : null}
        {testResult ? <StatusPill result={testResult} /> : null}

        <div className="button-row">
          <button className="secondary-button" type="button" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 className="spin" size={17} /> : <TestTube2 size={17} />}
            Tester
          </button>
          <button className="primary-button" type="submit" disabled={saving || !isValid}>
            {saving ? <Loader2 className="spin" size={17} /> : <Save size={17} />}
            Sauver
          </button>
        </div>
      </form>
    </article>
  );
}

function StatusPill({ result }: { result: ServiceTestResult }) {
  const ok = result.status === "connected";
  return (
    <div className={`status-pill ${result.status}`}>
      {ok ? <CheckCircle2 size={17} /> : <TriangleAlert size={17} />}
      <span>{STATUS_LABELS[result.status]}</span>
      <small>{result.message}</small>
    </div>
  );
}

function LoadingScreen({ inline = false }: { inline?: boolean }) {
  return (
    <main className={inline ? "loading-screen inline" : "loading-screen"}>
      <Loader2 className="spin" size={24} />
    </main>
  );
}

function readError(err: unknown) {
  return err instanceof Error ? err.message : "Erreur inattendue.";
}
