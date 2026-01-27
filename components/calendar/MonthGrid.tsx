"use client";
import Link from "next/link";
import dayjs from "dayjs";
import type { CalendarEntry } from "../../store/useRunStore";

export function MonthGrid({
  monthISO,
  entriesByDay,
  onEventClick,
  dayHref,
}: {
  monthISO: string;
  entriesByDay: Record<string, CalendarEntry[]>;
  onEventClick?: (e: CalendarEntry) => void;
  dayHref?: (dateISO: string) => string;
}) {
  const start = dayjs(monthISO).startOf("month");
  const end = dayjs(monthISO).endOf("month");
  const days: dayjs.Dayjs[] = [];
  let c = start.startOf("week");
  const last = end.endOf("week");
  while (c.isBefore(last) || c.isSame(last, "day")) {
    days.push(c);
    c = c.add(1, "day");
  }
  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d, idx) => {
        const key = d.format("YYYY-MM-DD");
        const entries = entriesByDay[key] || [];
        const faded = d.month() !== start.month();
        return (
          <div key={idx} className={`min-h-24 border rounded p-2 ${faded ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between">
              {dayHref ? (
                <Link href={dayHref(key)} className="text-xs text-gray-500 hover:underline">
                  {d.date()}
                </Link>
              ) : (
                <div className="text-xs text-gray-500">{d.date()}</div>
              )}
              {dayHref && entries.length ? (
                <Link href={dayHref(key)} className="text-[11px] text-gray-500 hover:underline">
                  Open
                </Link>
              ) : null}
            </div>
            <div className="space-y-1 mt-1">
              {entries.slice(0, 3).map((e) => (
                <button key={e.id} className="block w-full text-left px-1.5 py-1.5 mb-1 rounded-md bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all group" onClick={() => onEventClick?.(e)}>
                  {/* Event Badge (Minimalist) */}
                  {(e as any).original_data?.event?.name && (
                    <div className="mb-0.5 flex items-center gap-1.5 opacity-90">
                      <div className="w-1 h-1 rounded-full bg-orange-500 shrink-0" />
                      <span className="text-[9px] font-semibold text-gray-900 truncate">
                        {(e as any).original_data.event.name}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1 mb-0.5 opacity-50">
                    <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500 truncate max-w-[80px]">{e.channel.split(',')[0]}</span>
                    <span className="text-[8px] text-gray-400 font-medium ml-auto uppercase">{e.type.slice(0, 3)}</span>
                  </div>

                  <div className="text-[10px] leading-[1.1] text-gray-900 font-medium truncate group-hover:text-black">
                    {e.title}
                  </div>
                </button>
              ))}
              {entries.length > 3 && <div className="text-[11px] text-gray-500">+{entries.length - 3} more</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
