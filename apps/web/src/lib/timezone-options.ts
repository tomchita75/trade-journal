import { isTimeZone } from "./timezone";

let supportedZones: string[] | undefined;

/** Читаемые названия сохраняют регион, чтобы города с похожими названиями оставались различимы. */
export const timeZoneLabel = (zone: string): string =>
  zone.replaceAll("_", " ").replaceAll("/", " / ");

const searchKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_/\s]+/g, " ")
    .trim();

/**
 * Intl перечисляет основные пояса, но опускает UTC и многие допустимые алиасы. Сохраняем
 * сохранённые алиасы и предлагаем любое точное, допустимое имя, введённое в поиске, как selectable row.
 * Текст поиска сам по себе никогда не используется как настройка.
 */
export const timeZoneOptions = (current: string, query = ""): string[] => {
  if (!supportedZones) {
    try {
      supportedZones = Intl.supportedValuesOf("timeZone");
    } catch {
      // Старые браузеры всё ещё могут выбрать свой текущий пояс или искать полное допустимое имя.
      supportedZones = [];
    }
  }
  const zones = new Set(["UTC", ...supportedZones]);
  const candidate = query.trim().replaceAll(" ", "_");
  for (const zone of [current, candidate]) {
    if (!zone || !isTimeZone(zone)) continue;
    // Избегаем добавления второй строки для различий только в регистре при поиске.
    if (!Array.from(zones).some((existing) => existing.toLowerCase() === zone.toLowerCase()))
      zones.add(zone);
  }
  const words = searchKey(query).split(" ").filter(Boolean);
  return [...zones]
    .filter((zone) => words.every((word) => searchKey(zone).includes(word)))
    .sort((a, b) => (a === "UTC" ? -1 : b === "UTC" ? 1 : a.localeCompare(b)));
};