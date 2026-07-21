import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Кастомные шкалы Kollektiv, о которых tailwind-merge не знает из коробки:
// - type scale (text-display/h2/…) — иначе принимает их за text-ЦВЕТ и
//   вырезает при слиянии с text-foreground и подобными;
// - сдвиговые тени (shadow-soft/hard/overlay/card/tooltip) — иначе не
//   конфликтуют с другими shadow-* и переопределение тени не срабатывает
//   (например SIGNAL-тень палитры поверх shadow-overlay у DialogContent).
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display",
            "h2",
            "body",
            "small",
            "num-lg",
            "num",
            "label",
            "micro",
          ],
        },
      ],
      shadow: [{ shadow: ["soft", "hard", "overlay", "card", "tooltip"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Русская плюрализация: forms = [1, 2–4, 5+] («ПОЗИЦИЯ», «ПОЗИЦИИ», «ПОЗИЦИЙ»).
// Живёт в theme-lib кита — приезжает всем потребителям (не заводим отдельный
// registry-файл ради трёх строк). Нужен §51 SearchInput («N СОВПАДЕНИЙ»).
export function pluralRu(n: number, forms: [string, string, string]): string {
  const t = n % 100
  const o = n % 10
  if (t >= 11 && t <= 14) return forms[2]
  if (o === 1) return forms[0]
  if (o >= 2 && o <= 4) return forms[1]
  return forms[2]
}
