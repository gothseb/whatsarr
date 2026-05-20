import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Link2,
  Loader2,
  RefreshCw,
  Trash2,
  UserRound,
  Users
} from "lucide-react";
import type { PublicMappingState, PublicPlexUser } from "@whatsarr/shared";
import {
  createUserContactMapping,
  deleteUserContactMapping,
  getMappingState,
  importPlexUsers
} from "./api";

export function MappingPage() {
  const [state, setState] = useState<PublicMappingState | null>(null);
  const [selectedPlexUserId, setSelectedPlexUserId] = useState("");
  const [selectedWhatsAppId, setSelectedWhatsAppId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadState();
  }, []);

  useEffect(() => {
    if (!state) {
      return;
    }

    setSelectedPlexUserId((current) => current || state.plexUsers[0]?.plexUserId || "");
    setSelectedWhatsAppId(
      (current) => current || state.whatsappContacts[0]?.whatsappId || ""
    );
  }, [state]);

  const selectedPlexUser = useMemo(
    () => state?.plexUsers.find((user) => user.plexUserId === selectedPlexUserId),
    [selectedPlexUserId, state?.plexUsers]
  );

  const availableContacts = useMemo(() => {
    const linkedIds = new Set(
      selectedPlexUser?.linkedContacts.map((contact) => contact.whatsappId) ?? []
    );
    return (
      state?.whatsappContacts.filter((contact) => !linkedIds.has(contact.whatsappId)) ?? []
    );
  }, [selectedPlexUser, state?.whatsappContacts]);

  async function loadState() {
    setLoading(true);
    setError(null);
    try {
      setState(await getMappingState());
    } catch (err) {
      setError(readError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleImportPlexUsers() {
    setBusy(true);
    setError(null);
    try {
      setState(await importPlexUsers());
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateMapping() {
    if (!selectedPlexUserId || !selectedWhatsAppId) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await createUserContactMapping(selectedPlexUserId, selectedWhatsAppId);
      setState(await getMappingState());
      setSelectedWhatsAppId("");
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteMapping(id: string) {
    setBusy(true);
    setError(null);
    try {
      await deleteUserContactMapping(id);
      setState(await getMappingState());
    } catch (err) {
      setError(readError(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading || !state) {
    return (
      <main className="loading-screen inline">
        <Loader2 className="spin" size={24} />
      </main>
    );
  }

  return (
    <div className="mapping-layout">
      <section className="mapping-main">
        {state.nonNotifiableCount > 0 ? (
          <div className="notice warning">
            <AlertTriangle size={18} />
            <span>{state.nonNotifiableCount} utilisateur(s) Plex non notifiable(s)</span>
          </div>
        ) : null}

        {error ? <div className="notice error">{error}</div> : null}

        <article className="service-panel">
          <header>
            <div>
              <h2>Utilisateurs Plex</h2>
              <p>{state.plexUsers.length} utilisateur(s) importe(s)</p>
            </div>
            <UserRound size={20} />
          </header>

          <div className="button-row left">
            <button
              className="primary-button"
              type="button"
              onClick={handleImportPlexUsers}
              disabled={busy}
            >
              {busy ? <Loader2 className="spin" size={17} /> : <RefreshCw size={17} />}
              Importer utilisateurs
            </button>
            <button className="secondary-button" type="button" onClick={loadState} disabled={busy}>
              <RefreshCw size={17} />
              Rafraichir
            </button>
          </div>

          <div className="mapping-user-list">
            {state.plexUsers.map((user) => (
              <PlexUserRow
                busy={busy}
                key={user.plexUserId}
                selected={user.plexUserId === selectedPlexUserId}
                user={user}
                onDeleteMapping={handleDeleteMapping}
                onSelect={() => setSelectedPlexUserId(user.plexUserId)}
              />
            ))}
          </div>
        </article>
      </section>

      <aside className="mapping-side">
        <article className="service-panel">
          <header>
            <div>
              <h2>Associer</h2>
              <p>{selectedPlexUser?.displayName ?? "Aucun utilisateur Plex"}</p>
            </div>
            <Link2 size={20} />
          </header>

          <div className="mapping-form">
            <label>
              Utilisateur Plex
              <select
                value={selectedPlexUserId}
                onChange={(event) => setSelectedPlexUserId(event.target.value)}
              >
                {state.plexUsers.map((user) => (
                  <option key={user.plexUserId} value={user.plexUserId}>
                    {user.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Contact WhatsApp
              <select
                value={selectedWhatsAppId}
                onChange={(event) => setSelectedWhatsAppId(event.target.value)}
              >
                <option value="">Selectionner un contact</option>
                {availableContacts.map((contact) => (
                  <option key={contact.whatsappId} value={contact.whatsappId}>
                    {contact.displayName}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="primary-button full-width"
              type="button"
              onClick={handleCreateMapping}
              disabled={busy || !selectedPlexUserId || !selectedWhatsAppId}
            >
              {busy ? <Loader2 className="spin" size={17} /> : <Link2 size={17} />}
              Associer
            </button>
          </div>
        </article>

        <article className="service-panel">
          <header>
            <div>
              <h2>Contacts WhatsApp</h2>
              <p>{state.whatsappContacts.length} contact(s) importe(s)</p>
            </div>
            <Users size={20} />
          </header>

          <div className="contact-list">
            {state.whatsappContacts.map((contact) => (
              <div className="contact-row" key={contact.whatsappId}>
                <strong>{contact.displayName}</strong>
                <span>{contact.mappingStatus === "lie" ? "Lie" : "Non lie"}</span>
                {!contact.isInServerGroup ? <em>Hors groupe</em> : null}
              </div>
            ))}
          </div>
        </article>
      </aside>
    </div>
  );
}

function PlexUserRow({
  busy,
  selected,
  user,
  onDeleteMapping,
  onSelect
}: {
  busy: boolean;
  selected: boolean;
  user: PublicPlexUser;
  onDeleteMapping: (id: string) => Promise<void>;
  onSelect: () => void;
}) {
  return (
    <div className={`mapping-user-row ${selected ? "selected" : ""}`}>
      <button className="mapping-user-main" type="button" onClick={onSelect}>
        <span>
          <strong>{user.displayName}</strong>
          <small>{user.plexUserId}</small>
        </span>
        <em className={user.mappingStatus === "lie" ? "linked" : "missing"}>
          {user.mappingStatus === "lie" ? "Lie" : "Non notifiable"}
        </em>
      </button>

      <div className="linked-contact-list">
        {user.linkedContacts.map((contact) => (
          <span className="linked-contact" key={contact.id}>
            {contact.displayName}
            {!contact.isInServerGroup ? <em>hors groupe</em> : null}
            <button
              className="mini-icon-button"
              type="button"
              onClick={() => onDeleteMapping(contact.id)}
              disabled={busy}
              title="Supprimer le mapping"
            >
              <Trash2 size={14} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function readError(err: unknown) {
  return err instanceof Error ? err.message : "Erreur inattendue.";
}
