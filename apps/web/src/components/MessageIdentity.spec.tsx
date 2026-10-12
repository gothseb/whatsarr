import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageIdentity, LogCorrelation } from "./MessageIdentity";
import type { PublicNotificationJob } from "@whatsarr/shared";
describe("Hermes identifiers in Messages",()=>{
 it("renders source, long ids and correlation as escaped text",()=>{
  const id="<script>"+"x".repeat(128);const html=renderToStaticMarkup(<MessageIdentity job={{source:"hermes",messageId:id,id:"job",targetType:"group",targetId:"group",requestId:"origin"} as PublicNotificationJob}/>);
  expect(html).toContain("Hermes");expect(html).toContain("&lt;script&gt;");expect(html).not.toContain("<script>");expect(html).toContain("origin");expect(html).toContain("Job : job");
 });
 it("keeps legacy labels and hides unrelated context",()=>{
  const html=renderToStaticMarkup(<MessageIdentity job={{type:"monthly_recap",targetType:"group",targetId:"old"} as PublicNotificationJob}/>);expect(html).toContain("monthly_recap");expect(html).not.toContain("Requête initiale");
  expect(renderToStaticMarkup(<LogCorrelation context={{source:"legacy",secret:"hidden"}}/>)).toBe("");
 });
 it("shows only authorized log fields",()=>{
  const html=renderToStaticMarkup(<LogCorrelation context={{source:"hermes",jobId:"j",messageId:"m",originRequestId:"r",imageUrl:"secret",payload:"private",apiKey:"key"}}/>);
  expect(html).toContain("Hermes");expect(html).toContain("Requête initiale : r");expect(html).not.toMatch(/secret|private|key/);
 });
});
