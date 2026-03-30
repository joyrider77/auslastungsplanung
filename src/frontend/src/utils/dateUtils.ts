export const MONTHS_DE = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];
export const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
];

export function getISOWeekOfDate(date: Date): number {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    )
  );
}

export function getISOWeeksInYear(year: number): number {
  return getISOWeekOfDate(new Date(year, 11, 28));
}

export function getISOWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = (jan4.getDay() + 6) % 7;
  const week1Monday = new Date(jan4.getTime() - dayOfWeek * 86400000);
  return new Date(week1Monday.getTime() + (week - 1) * 7 * 86400000);
}

export function getMonthForWeek(year: number, week: number): number {
  const monday = getISOWeekMonday(year, week);
  const thursday = new Date(monday.getTime() + 3 * 86400000);
  return thursday.getMonth();
}

export function getWeeksGroupedByMonth(
  year: number,
): { month: number; weeks: number[] }[] {
  const numWeeks = getISOWeeksInYear(year);
  const monthMap = new Map<number, number[]>();
  for (let w = 1; w <= numWeeks; w++) {
    const month = getMonthForWeek(year, w);
    if (!monthMap.has(month)) monthMap.set(month, []);
    monthMap.get(month)!.push(w);
  }
  return Array.from(monthMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([month, weeks]) => ({ month, weeks }));
}
