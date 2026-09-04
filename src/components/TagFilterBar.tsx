import { PRIMARY_LEVEL_TAGS, SCIENCE_TOPIC_TAGS, MATH_TOPIC_TAGS } from "../data/lessonContent";
import { cn } from "./ui/utils";

export interface TagSelection {
  level: string[];
  science: string[];
  math: string[];
}

const CATEGORY_STYLES = {
  level: {
    label: "Primary Level",
    chip: "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
    active: "bg-amber-500 border-amber-500 text-white",
  },
  science: {
    label: "Science Topics",
    chip: "border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
    active: "bg-emerald-500 border-emerald-500 text-white",
  },
  math: {
    label: "Mathematics Topics",
    chip: "border-sky-300 text-sky-700 bg-sky-50 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30",
    active: "bg-sky-500 border-sky-500 text-white",
  },
} as const;

function toggle(list: string[], tag: string) {
  return list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag];
}

export function TagFilterBar({
  selection,
  onChange,
}: {
  selection: TagSelection;
  onChange: (s: TagSelection) => void;
}) {
  const groups: { key: keyof TagSelection; tags: string[] }[] = [
    { key: "level", tags: PRIMARY_LEVEL_TAGS },
    { key: "science", tags: SCIENCE_TOPIC_TAGS },
    { key: "math", tags: MATH_TOPIC_TAGS },
  ];

  return (
    <div className="space-y-3">
      {groups.map(({ key, tags }) => {
        const style = CATEGORY_STYLES[key];
        return (
          <div key={key} className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-full sm:w-auto sm:min-w-[130px]">
              {style.label}
            </span>
            {tags.map((tag) => {
              const active = selection[key].includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => onChange({ ...selection, [key]: toggle(selection[key], tag) })}
                  className={cn(
                    "text-xs font-bold px-3 py-1.5 rounded-full border transition-all",
                    active ? style.active : style.chip,
                  )}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function hasAnySelection(s: TagSelection) {
  return s.level.length > 0 || s.science.length > 0 || s.math.length > 0;
}

export function EMPTY_SELECTION(): TagSelection {
  return { level: [], science: [], math: [] };
}
