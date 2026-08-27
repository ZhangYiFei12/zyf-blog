import type { ExperienceItem } from "@/data/experience";

export default function ExperienceTimeline({
  items,
}: {
  items: ExperienceItem[];
}) {
  return (
    <div className="relative">
      {/* 时间线竖线 */}
      <div className="absolute left-4 top-2 bottom-2 w-px bg-line" />

      <div className="space-y-10">
        {items.map((item, i) => (
          <div
            key={i}
            className="relative pl-12 animate-fade-up"
            style={{ animationDelay: `${i * 150}ms` }}
          >
            {/* 时间线节点 */}
            <div className="absolute left-2.5 top-1.5 w-[9px] h-[9px] rounded-full bg-accent ring-4 ring-bg z-10" />

            <span className="inline-block font-mono text-xs text-accent-dim mb-1.5 tracking-wider">
              {item.period}
            </span>
            <h3 className="text-lg font-semibold text-fg">
              {item.title}
              <span className="text-muted font-normal"> @ {item.org}</span>
            </h3>
            <ul className="mt-2 space-y-1.5">
              {item.description.map((d, di) => (
                <li
                  key={di}
                  className="text-sm text-muted leading-relaxed pl-3 relative before:absolute before:left-0 before:top-[0.6em] before:w-1.5 before:h-px before:bg-line2"
                >
                  {d}
                </li>
              ))}
            </ul>
            {item.tags && (
              <div className="flex flex-wrap gap-2 mt-3">
                {item.tags.map((t) => (
                  <span
                    key={t}
                    className="font-mono text-[11px] px-2.5 py-1 rounded-full border border-line text-muted tracking-wide"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}