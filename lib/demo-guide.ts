import type { Destination, LiveContext } from "@/lib/types";

const known = (v: string): boolean => Boolean(v) && !/^ask your guide/i.test(v);

/**
 * Offline guide built from the destination's own data. Used when no AI key is configured or the
 * AI provider can't be reached, so the chat never dead-ends. It is always labelled as offline.
 */
export function buildOfflineReply(destination: Destination, context: LiveContext, question: string, note?: string): string {
  const q = question.toLowerCase();
  const { name, pois, guide } = destination;
  const poiList = pois.slice(0, 4).map((p) => p.label).join(", ");
  const firstPoi = pois[Math.abs(question.length) % Math.max(1, pois.length)];
  const weather =
    context.conditions === "Unknown"
      ? `It's ${context.localTime} in ${name} right now.`
      : `It's ${context.localTime} in ${name} and the weather is ${context.weather}.`;

  let body: string;
  if (/eat|food|hungry|dinner|lunch|breakfast|restaurant|dish|drink|cafe|coffee/.test(q)) {
    body = `For food, wander away from the busiest corners and follow the smell of something fresh. Ask the person behind the counter what they'd eat themselves; that is usually the best thing on the menu. Try one local specialty rather than a safe choice.`;
  } else if (/weather|rain|cold|hot|warm|wear|pack|bring|umbrella/.test(q)) {
    body = `Right now: ${context.weather === "Unknown" ? "I can't see the weather" : context.weather}. Dress in layers, wear comfortable shoes, and keep a light rain layer in your bag. The Trip Toolkit has a packing list built from the live weather.`;
  } else if (/when|season|crowd|month|best time/.test(q)) {
    body = known(destination.bestTime)
      ? `The best time to visit is ${destination.bestTime}. Whatever the season, early mornings are the quiet window, with soft light and open streets.`
      : `Early mornings are the quiet window: soft light, open streets and locals starting their day. Late afternoon is the second-best time for photos.`;
  } else if (/money|currency|cost|price|cheap|budget|pay|cash|atm/.test(q)) {
    body = known(destination.currency)
      ? `The currency is ${destination.currency}. Carry a little cash for small shops and markets, and check current exchange rates before you go.`
      : `Check the local currency and carry a little cash for markets. Exchange rates change daily, so confirm them before you travel.`;
  } else if (/language|speak|phrase|say|hello|thank|translate/.test(q)) {
    body = known(destination.language)
      ? `People here speak ${destination.language}. A greeting like "${guide.greeting}" goes a long way. The Trip Toolkit has a phrasebook with read-aloud for essential phrases.`
      : `A friendly greeting like "${guide.greeting}" goes a long way. The Trip Toolkit has a phrasebook with read-aloud for essential phrases.`;
  } else if (/plan|itinerar|day|days|schedule|trip|weekend/.test(q)) {
    body = `Open the Trip Toolkit on this destination page to build a day-by-day itinerary around your interests and pace. As a starting point${poiList ? `, ${poiList} are all worth your time` : ", start somewhere central and let the day unfold"}.`;
  } else if (/see|visit|do|sight|landmark|attraction|famous|must/.test(q)) {
    body = poiList
      ? `Don't miss ${poiList}. ${firstPoi ? `${firstPoi.label}: ${firstPoi.description}` : ""}`
      : `${destination.tagline.replace(/[.!]+$/, "")}. Start somewhere central and follow what catches your eye.`;
  } else if (/safe|safety|danger|scam|emergency/.test(q)) {
    body = `Stay aware of your belongings in crowded places, use licensed transport, keep digital copies of your documents, and save the local emergency number before you go. Check your government's travel advice for current guidance.`;
  } else {
    body = `${destination.tagline.replace(/[.!]+$/, "")}. ${firstPoi ? `A lovely place to begin is ${firstPoi.label}: ${firstPoi.description}` : ""}`;
  }

  return [
    note ?? "(Offline guide: connect an AI key for full Muse answers.)",
    "",
    `${guide.greeting} ${guide.name} here. ${weather} ${body}`.replace(/\s+/g, " ").trim(),
    "",
    `What kind of experience are you hoping for in ${name}: something relaxed, adventurous, or full of local flavour?`,
  ].join("\n");
}

/** Streams the offline reply word by word so the UI behaves exactly like a real token stream. */
export function createDemoStream(
  destination: Destination,
  context: LiveContext,
  question: string,
  signal: AbortSignal,
  note?: string,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const words = buildOfflineReply(destination, context, question, note).split(/(?<=\s)/);
  let index = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (signal.aborted || index >= words.length) {
        controller.close();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
      controller.enqueue(encoder.encode(words[index] ?? ""));
      index += 1;
    },
  });
}
