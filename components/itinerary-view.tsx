import type { Itinerary } from "@/lib/trip";

/** Day-by-day plan. Shared by the planner and the saved-trips page. */
export function ItineraryDays({ itinerary }: { itinerary: Itinerary }) {
  return (
    <>
      <ol className="space-y-4">
        {itinerary.days.map((day) => (
          <li key={day.day} className="panel break-inside-avoid p-5 sm:p-6">
            <h3 className="text-lg font-bold">
              Day {day.day}
              {day.theme && <span className="font-normal text-muted-foreground"> · {day.theme}</span>}
            </h3>
            <ul className="mt-3 space-y-4 border-l-2 border-primary/30 pl-4">
              {day.items.map((item, index) => (
                <li key={`${item.title}-${index}`}>
                  <p className="text-sm font-semibold text-primary">{item.time}</p>
                  <p className="font-semibold">{item.title}</p>
                  {item.details && <p className="text-sm text-muted-foreground">{item.details}</p>}
                  {item.tip && <p className="mt-1 text-sm">💡 {item.tip}</p>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {itinerary.budgetNote && <p className="mt-3 text-sm text-muted-foreground">{itinerary.budgetNote}</p>}
    </>
  );
}
