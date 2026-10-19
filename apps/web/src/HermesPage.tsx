import { useState, type ReactNode } from "react";
import guide from "../../../docs/hermes-agent.md?raw";

export function hermesAddresses(origin: string) {
  return {
    webhook: `${origin}/api/agent/messages`,
    documentation: `${origin}/hermes-doc`,
    openapi: `${origin}/api/agent/openapi.json`
  };
}

function Address({ label, value }: { label: string; value: string }) {
  const [feedback, setFeedback] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setFeedback("Adresse copiée");
    } catch {
      setFeedback("Sélectionne l’adresse ci-dessous pour la copier manuellement.");
    }
  }
  return <div className="hermes-address">
    <label>{label}<input aria-label={label} readOnly value={value} onFocus={(event) => event.target.select()} /></label>
    <button className="secondary-button" type="button" onClick={copy}>Copier</button>
    <span role="status">{feedback}</span>
  </div>;
}

export function HermesPage({ origin = window.location.origin }: { origin?: string }) {
  const addresses = hermesAddresses(origin);
  return <div className="hermes-layout">
    <section className="service-panel">
      <h2>Connecter Hermes</h2>
      <p>Appels locaux sans clé ni cookie. Les messages sont envoyés au groupe serveur choisi dans WhatsApp.</p>
      <Address label="Relais API générique · POST" value={`${origin}/api/agent/relay`} />
      <Address label="Webhook d’envoi · POST" value={addresses.webhook} />
      <Address label="Page de documentation" value={addresses.documentation} />
      <Address label="Contrat OpenAPI · JSON" value={addresses.openapi} />
      <Address label="Films et séries Plex · JSON" value={`${origin}/api/agent/media/catalogue`} />
      <Address label="Collections Plex · JSON" value={`${origin}/api/agent/media/collections`} />
      <Address label="Catalogue des lectures TMDB · JSON" value={`${origin}/api/agent/tmdb/catalogue`} />
      <a className="primary-button" href={addresses.documentation} target="_blank" rel="noreferrer">Ouvrir la documentation</a>
      <p>Si Hermes tourne sur une autre machine ou dans un conteneur, ouvre Whatsarr avec son adresse réseau et copie les liens depuis cette adresse. localhost désigne la machine de l’agent.</p>
    </section>
    <section className="service-panel">
      <h2>Ce que l’agent peut faire</h2>
      <ul>
        <li>Appeler les API natives Plex, Radarr, Sonarr, Seerr, Tautulli et TMDB avec les identifiants stockés dans Whatsarr, sans filtre Récap sur le relais.</li>
        <li>Envoyer un texte, ou une photo JPEG/PNG avec sa légende.</li>
        <li>Suivre l’état d’envoi d’un message.</li>
        <li>Lister et rechercher les films et séries présents dans les bibliothèques Plex activées pour le Récap.</li>
        <li>Consulter les derniers ajouts Plex et les derniers visionnages Tautulli.</li>
        <li>Consulter les collections Plex des bibliothèques Récap et leur contenu.</li>
        <li>Voir le suivi, les tags et les fichiers Radarr/Sonarr, ainsi que les demandes Seerr et leur demandeur.</li>
        <li>Ajouter directement un film Radarr ou une série Sonarr et vérifier séparément suivi, fichiers et présence Plex.</li>
        <li>Interroger TMDB : recherche, recommandations, titres similaires, tendances, détails, acteurs, images, vidéos et plateformes.</li>
      </ul>
      <p>Coche Récap pour les bibliothèques accessibles par les anciennes routes Plex. Le relais générique utilise les droits complets du service. Configure Plex, Tautulli, TMDB, Radarr, Sonarr et Seerr (Overseerr) dans Paramètres, puis connecte WhatsApp et sélectionne le groupe. Hermes rédige et planifie ses publications ; Whatsarr transmet les messages et fournit les lectures.</p>
    </section>
  </div>;
}

// Render the bundled guide as React text; no HTML from the document is executed.
function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\[[^\]]+\]\([^)]+\))/g).map((part, index) => {
    if (part.startsWith("`")) return <code key={index}>{part.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const href = link[2] === "hermes-agent.openapi.json" ? "/api/agent/openapi.json" : link[2];
      return <a key={index} href={href}>{link[1]}</a>;
    }
    return part;
  });
}

export function HermesDocumentation({ origin = window.location.origin }: { origin?: string }) {
  const content = guide.split("## Vérifications de développement")[0]
    .replaceAll("http://localhost:3000", origin)
    .replaceAll("http://IP_WHATSARR:3000", origin);
  const blocks = content.split(/(```[\s\S]*?```)/g).flatMap((part) =>
    part.startsWith("```") ? [part] : part.trim().split(/\n\s*\n/).filter(Boolean)
  );
  return <main className="hermes-doc">
    <a href="/">← Retour à Whatsarr</a>
    <p>Documentation locale · <a href="/api/agent/openapi.json">Contrat OpenAPI pour l’agent</a></p>
    <nav aria-label="Sommaire de la documentation"><a href="#section-0">Premiers appels</a>{blocks.filter((block) => block.startsWith("## ")).map((block) => <a key={block} href={`#section-${blocks.indexOf(block)}`}>{block.slice(3)}</a>)}</nav>
    {blocks.map((block, index) => {
      if (block.startsWith("```")) return <pre key={index}><code>{block.replace(/^```[^\n]*\n/, "").replace(/```$/, "").trimEnd()}</code></pre>;
      if (block.startsWith("## ")) return <h2 id={`section-${index}`} key={index}>{block.slice(3)}</h2>;
      if (block.startsWith("# ")) return <h1 id={`section-${index}`} key={index}>{block.slice(2)}</h1>;
      return <p key={index}>{inline(block)}</p>;
    })}
  </main>;
}
