import {
  addDays,
  dateForWeekday,
  daysBetween,
  formatDanDatum,
  formatDatumKratko,
  formatDugiDatum,
  getTodayDate,
  weekDays,
  weekdayIndex,
} from "../src/utils/date";

afterEach(() => jest.useRealTimers());

test("danas je lokalni datum YYYY-MM-DD, ne UTC", () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 10, 9, 0, 30)); // pon 9. 11. u 00:30
  expect(getTodayDate()).toBe("2026-11-09");
});

test("formatiranje datuma", () => {
  expect(formatDanDatum("2026-11-09")).toBe("Ponedeljak, 9. 11.");
  expect(formatDanDatum("2026-11-15")).toBe("Nedelja, 15. 11.");
  expect(formatDatumKratko("2026-01-05")).toBe("5. 1.");
  expect(formatDugiDatum("2026-11-02")).toBe("Ponedeljak, 2. novembar");
});

test("pomeranje datuma preko kraja meseca i godine", () => {
  expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
});

test("razlika dana i preko promene na zimsko/letnje računanje vremena", () => {
  expect(daysBetween("2026-11-01", "2026-11-15")).toBe(14);
  expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2); // 29. 3. pomeranje sata
  expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2); // 25. 10.
  expect(daysBetween("2026-11-15", "2026-11-01")).toBe(-14);
});

test("nedelja uvek počinje ponedeljkom", () => {
  const dani = weekDays("2026-11-15"); // nedelja
  expect(dani).toHaveLength(7);
  expect(dani[0]).toEqual({ datum: "2026-11-09", kratko: "Pon", broj: 9, ime: "Ponedeljak" });
  expect(dani[6].datum).toBe("2026-11-15");
  expect(weekDays("2026-11-09")[0].datum).toBe("2026-11-09");
});

test("naziv dana sa i bez kvačica", () => {
  expect(weekdayIndex("Četvrtak")).toBe(3);
  expect(weekdayIndex("cetvrtak")).toBe(3);
  expect(weekdayIndex(" NEDELJA ")).toBe(6);
  expect(weekdayIndex("praznik")).toBe(-1);
});

test("datum za dan u tekućoj nedelji", () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 10, 11, 12)); // sreda 11. 11.
  expect(dateForWeekday("Ponedeljak")).toBe("2026-11-09");
  expect(dateForWeekday("Sreda")).toBe("2026-11-11");
  expect(dateForWeekday("Nedelja")).toBe("2026-11-15");
  expect(dateForWeekday("x")).toBeNull();
});
