import { StyleSheet } from "react-native";
import { colors } from "../theme";

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 18,
};

export const typography = StyleSheet.create({
  title: { fontSize: 26, fontWeight: "800", color: colors.textPrimary },
  sectionLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 8, marginTop: 4 },
  body: { fontSize: 15, color: colors.textPrimary },
  bodySecondary: { fontSize: 13, color: colors.textSecondary },
  label: { fontSize: 14, color: colors.textSecondary, marginTop: 16, marginBottom: 8 },
});

export const common = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  screenPadding: { padding: spacing.lg, paddingTop: 60 },
  centered: { flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderRadius: radius.sm,
    padding: 14,
    fontSize: 15,
    marginBottom: spacing.sm,
  },

  primaryButton: {
    backgroundColor: colors.primary,
    padding: 16,
    borderRadius: radius.lg,
  },
  primaryButtonText: { color: "#141414", fontSize: 16, fontWeight: "700", textAlign: "center" },

  secondaryButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    borderRadius: radius.md,
  },
  secondaryButtonText: { color: colors.textPrimary, fontSize: 14, fontWeight: "700", textAlign: "center" },

  row: { flexDirection: "row", gap: spacing.sm },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  emptyText: { color: colors.textSecondary, textAlign: "center", marginTop: 60, fontSize: 14 },
  deleteText: { color: colors.danger, fontSize: 16, paddingHorizontal: 8 },

  badge: { backgroundColor: colors.surfaceAlt, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  badgeText: { fontSize: 12, color: colors.primary, fontWeight: "700" },
});