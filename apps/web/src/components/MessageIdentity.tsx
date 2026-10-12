import type { PublicNotificationJob } from "@whatsarr/shared";

export function MessageIdentity({ job }: { job: PublicNotificationJob }) {
  return <>
    <strong>{job.source === "hermes" ? "Hermes" : job.type}</strong>
    <small>{job.targetType} - {job.targetId}</small>
    {job.source === "hermes" ? <>
      <small>Job : {job.id}</small>
      <small>Message : {job.messageId}</small>
      <small>Requête initiale : {job.requestId ?? "indisponible"}</small>
    </> : null}
  </>;
}

export function LogCorrelation({ context }: { context: unknown }) {
  if (!context || typeof context !== "object" || Array.isArray(context)) return null;
  const fields = context as Record<string, unknown>;
  if (fields.source !== "hermes") return null;
  return <>
    <small>Hermes</small>
    {([ ["jobId", "Job"], ["messageId", "Message"], ["originRequestId", "Requête initiale"] ] as const).map(([key,label]) =>
      typeof fields[key] === "string" ? <small key={key}>{label} : {fields[key] as string}</small> : null
    )}
  </>;
}
