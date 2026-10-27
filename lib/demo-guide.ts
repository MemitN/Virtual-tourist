import type { Destination, LiveContext } from "@/lib/types";

/**
 * Offline stand-in for muse-spark-1.3, used only when DEMO_MODE=true and MODEL_API_KEY is unset.
 * It lets you exercise streaming, read-aloud, history and presence without a Meta key.
 */
function buildDemoReply(destination: Destination, context: LiveContext, question: string): string {
  const q = question.toLowerCase();
  const poi = destination.pois[Math.floor(question.length % Math.max(1, destination.pois.length))];
  const weatherLine =
    context.conditions === "Unknown"
      ? `It's ${context.localTime} in ${destination.name} right now.`
      : `It's ${context.localTime} in ${destination.name} and the weather is ${context.weather}.`;

  let body: string;
  if (/eat|food|hungry|dinner|lunch|breakfast|restaurant/.test(q)) {
    body = `For food, wander away from the busiest corners and follow the smell of something fresh. Ask the person behind the counter what they'd eat themselves; that answer is usually the best thing on the menu.`;
  } else if (/weather|rain|cold|hot|warm|wear|pack/.test(q)) {
    body = `Dress in layers and keep comfortable shoes on, because ${destination.name} rewards long walks. Check the sky again in an hour since conditions here can shift.`;
  } else if (/when|time|best|season|crowd/.test(q)) {
    body = `Early mornings are the quiet window: soft light, open streets and locals starting their day. Late afternoon is the second-best time for photos.`;
  } else {
    body = `${destination.tagline}. ${poi ? `A lovely place to begin is ${poi.label}: ${poi.description}` : ""}`;
  }

  return [
    `(Demo guide: add MODEL_API_KEY for real Meta AI answers.)`,
    ``,
    `${destination.guide.greeting} ${destination.guide.name} here. ${weatherLine} ${body}`,
    ``,
    `What kind of experience are you hoping for in ${destination.name}: something relaxed, adventurous, or full of local flavour?`,
  ].join("\n");
}

/** Streams the demo reply word by word so the UI behaves exactly like a real token stream. */
export function createDemoStream(
  destination: Destination,
  context: LiveContext,
  question: string,
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const words = buildDemoReply(destination, context, question).split(/(?<=\s)/);
  let index = 0;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (signal.aborted || index >= words.length) {
        controller.close();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 35));
      controller.enqueue(encoder.encode(words[index] ?? ""));
      index += 1;
    },
  });
}
