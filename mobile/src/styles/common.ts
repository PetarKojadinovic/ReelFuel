import { StyleSheet } from "react-native";
import { colors, fonts } from "../theme";

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 12,
  md: 14,
  lg: 18,
  xl: 22,
};

export const typography = StyleSheet.create({
  title: { fontSize: 30, fontFamily: fonts.black, color: colors.textPrimary, letterSpacing: -0.5 },
  heading: { fontSize: 18, fontFamily: fonts.black, color: colors.textPrimary },
  sectionLabel: { fontSize: 18, fontFamily: fonts.black, color: colors.textPrimary, marginBottom: 10, marginTop: 8 },
  body: { fontSize: 15, fontFamily: fonts.regular, color: colors.textPrimary },
  bodyStrong: { fontSize: 16, fontFamily: fonts.extrabold, color: colors.textPrimary },
  bodySecondary: { fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary },
  label: { fontSize: 14, fontFamily: fonts.bold, color: colors.textSecondary, marginTop: 16, marginBottom: 8 },
  // Mala oznaka iznad naziva: "DORUČAK · 8:00"
  eyebrow: { fontSize: 12, fontFamily: fonts.extrabold, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.5 },
  // Stavka u listi (sastojci, koraci)
  listItem: { fontSize: 15, fontFamily: fonts.regular, color: colors.textPrimary, lineHeight: 22, marginBottom: 6 },
  // Sitna napomena na dnu ekrana
  note: { fontSize: 12, fontFamily: fonts.regular, color: colors.textSecondary, lineHeight: 18 },
  // Veliki broj (kcal, 5/7...)
  bigNumber: { fontSize: 34, fontFamily: fonts.black, color: colors.primary },
});

export const common = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  screenPadding: { padding: spacing.lg, paddingTop: 56, paddingBottom: 40 },
  // Ekran van tabova (ima zaglavlje iz Stack-a, pa ne treba veliki razmak gore)
  stackPadding: { padding: spacing.lg, paddingBottom: 40 },
  centered: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: 10,
  },
  highlightCard: {
    backgroundColor: colors.highlightBg,
    borderWidth: 1,
    borderColor: colors.highlightBorder,
    borderRadius: radius.lg,
    padding: 14,
    marginBottom: 10,
  },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    borderRadius: radius.md,
    padding: 14,
    fontSize: 16,
    fontFamily: fonts.bold,
    marginBottom: spacing.sm,
  },

  primaryButton: {
    backgroundColor: colors.primary,
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    justifyContent: "center",
  },
  primaryButtonText: { color: colors.onPrimary, fontSize: 16, fontFamily: fonts.black, textAlign: "center" },

  secondaryButton: {
    backgroundColor: colors.surfaceAlt,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    justifyContent: "center",
  },
  secondaryButtonText: { color: colors.textPrimary, fontSize: 15, fontFamily: fonts.extrabold, textAlign: "center" },

  outlineButton: {
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  outlineButtonText: { color: colors.textPrimary, fontSize: 15, fontFamily: fonts.extrabold, textAlign: "center" },

  row: { flexDirection: "row", gap: spacing.sm },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  emptyText: { color: colors.textSecondary, textAlign: "center", marginTop: 40, fontSize: 15, fontFamily: fonts.regular },
  deleteText: { color: colors.danger, fontSize: 16, paddingHorizontal: 8, fontFamily: fonts.bold },

  badge: { backgroundColor: colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 12, color: colors.primary, fontFamily: fonts.extrabold },

  // Prekidač sa 2-3 opcije (npr. "Ova nedelja / Sledeća nedelja")
  tabRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  tabBtn: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabBtnText: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.textSecondary },
  tabBtnTextActive: { color: colors.onPrimary },

  // Segmentirani prekidač unutar taba (Jelovnik / Recepti / Kupovina)
  segment: { flexDirection: "row", backgroundColor: colors.surface, borderRadius: 16, padding: 4, gap: 4, marginBottom: 16 },
  segmentBtn: { flex: 1, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  segmentBtnActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 15, fontFamily: fonts.extrabold, color: colors.textSecondary },
  segmentTextActive: { color: colors.onPrimary, fontFamily: fonts.black },

  // Krug za status (pojedeno / čeka)
  checkCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },

  // Mala dugmad za izbor (porcija, 50 g, 100 g...)
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontFamily: fonts.extrabold, color: colors.textSecondary },
  chipTextActive: { color: colors.onPrimary },

  // Kartica koja se bira (jedna od više opcija)
  option: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  optionActive: { borderColor: colors.primary },
});
