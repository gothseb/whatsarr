import { AgentError } from "./agent.types";
import { sensitiveName } from "./agent-relay.dto";

const hidden = "[REDACTED]";
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Only the hexadecimal digits of percent escapes are insensitive; the credential itself is not.
function percentPattern(value: string) {
  return value.split(/(%[a-f\d]{2})/gi).map(part => /^%[a-f\d]{2}$/i.test(part)
    ? "%" + [...part.slice(1)].map(char => /[a-f]/i.test(char) ? `[${char.toLowerCase()}${char.toUpperCase()}]` : char).join("")
    : escapeRegex(part)).join("");
}
function xmlPattern(secret: string) {
  const names: Record<string,string> = {"&":"amp", "<":"lt", ">":"gt", '"':"quot", "'":"apos"};
  return [...secret].map(char => {
    const code = char.codePointAt(0)!;
    const hex = [...code.toString(16)].map(digit => /[a-f]/i.test(digit) ? `[${digit}${digit.toUpperCase()}]` : digit).join("");
    return `(?:${escapeRegex(char)}|&#0*${code};|&#[xX]0*${hex};${names[char] ? `|&${names[char]};` : ""})`;
  }).join("");
}

export class RelayRedactor {
  redacted = false;
  private readonly variants: string[];
  private readonly patterns: RegExp[];
  constructor(secrets: string[]) {
    const known = [...new Set(secrets.filter(Boolean))];
    this.variants = [...new Set(known.flatMap(secret => [secret, encodeURIComponent(secret), encodeURI(secret), new URLSearchParams({v:secret}).toString().slice(2), encodeURIComponent(encodeURIComponent(secret)), JSON.stringify(secret).slice(1,-1), Buffer.from(secret).toString("base64")]))].sort((a,b)=>b.length-a.length);
    this.patterns = [...this.variants.map(value=>new RegExp(percentPattern(value),"g")), ...known.map(secret=>new RegExp(xmlPattern(secret),"g"))];
  }
  text(value: string): string {
    let output = value;
    for (const pattern of this.patterns) output = output.replace(pattern,hidden);
    // Upstream configuration endpoints can expose credentials unknown to Whatsarr too.
    output = output.replace(/(["']?(?:api[-_]?key|x-plex-token|password|passwd|authorization|client[-_]?secret|secret|cookie|set-cookie)["']?\s*[:=]\s*)(["'])(.*?)\2/gi, `$1$2${hidden}$2`)
      .replace(/((?:authorization|proxy-authorization|cookie|set-cookie)\s*[:=]\s*)(?!["'])([^\r\n<>"'&]+)/gi, `$1${hidden}`)
      .replace(/((?:api[-_]?key|x-plex-token|password|passwd|client[-_]?secret|secret)\s*[:=]\s*)(?!["'])([^\s&<>"']+)/gi, `$1${hidden}`)
      .replace(/(<(?:[\w.-]+:)?(?:api[-_]?key|password|secret|authorization)\b[^>]*>)[\s\S]*?(<\/[^>]+>)/gi, `$1${hidden}$2`);
    if (output !== value) this.redacted = true;
    return output;
  }
  json(value: unknown): unknown {
    if (typeof value === "string") return this.text(value);
    if (typeof value === "number" || typeof value === "boolean") return this.text(String(value)) === String(value) ? value : hidden;
    if (Array.isArray(value)) return value.map(item=>this.json(item));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key,item]) => {
      if (sensitiveName(key)) { this.redacted = true; return [key,hidden]; }
      return [this.text(key),this.json(item)];
    }));
    return value;
  }
  binary(value: Buffer) {
    const encoded = value.toString("latin1");
    if (this.variants.some(secret=>value.includes(Buffer.from(secret))) || this.patterns.some(pattern=>{pattern.lastIndex=0;return pattern.test(encoded);})) throw new AgentError(502,"RELAY_SECRET_IN_BINARY","La réponse binaire contient un identifiant et ne peut pas être transmise.");
  }
  headers(input: Headers): Record<string,string> {
    const result: Record<string,string> = {};
    input.forEach((value,key)=>{
      if (sensitiveName(key)) { this.redacted = true; return; }
      // Hop-by-hop and representation lengths/encodings do not describe the JSON envelope.
      if (/^(?:connection|content-length|transfer-encoding|content-encoding|keep-alive|te|trailer|upgrade|proxy-.*)$/i.test(key)) return;
      result[this.text(key)] = this.text(value);
    });
    return result;
  }
}
