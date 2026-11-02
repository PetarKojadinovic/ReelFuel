/**
 * Male zajedničke komponente novog dizajna (2026-11).
 * Ikone: Ionicons iz @expo/vector-icons (JS + font, ne traži novi build).
 */
import { ReactNode } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { colors, fonts } from "../theme";
import { common, typography } from "../styles/common";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

export function Icon({ name, size = 22, color = colors.textPrimary }: { name: IconName; size?: number; color?: string }) {
  return <Ionicons name={name} size={size} color={color} />;
}

/** Naslov ekrana taba ("Hrana", "Trening"...) sa opcionim podnaslovom iznad. */
export function ScreenTitle({ title, eyebrow }: { title: string; eyebrow?: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      {eyebrow ? <Text style={[typography.bodySecondary, { fontFamily: fonts.bold }]}>{eyebrow}</Text> : null}
      <Text style={typography.title}>{title}</Text>
    </View>
  );
}

/** Segmentirani prekidač: Jelovnik / Recepti / Kupovina. */
export function Segment<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={common.segment}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <TouchableOpacity
            key={o.value}
            style={[common.segmentBtn, active && common.segmentBtnActive]}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[common.segmentText, active && common.segmentTextActive]}>{o.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Traka sa 7 dana (Pon 2 … Ned 8). `tacka` = da li dan ima trening / nešto. */
export function DayStrip({
  days,
  selected,
  today,
  onSelect,
  tacka,
}: {
  days: { datum: string; kratko: string; broj: number }[];
  selected: string;
  today: string;
  onSelect: (datum: string) => void;
  tacka?: (datum: string) => boolean | undefined;
}) {
  return (
    <View style={styles.dayStrip}>
      {days.map((d) => {
        const sel = d.datum === selected;
        const isToday = d.datum === today;
        const dot = tacka?.(d.datum);
        return (
          <TouchableOpacity
            key={d.datum}
            style={[styles.dayBtn, sel && styles.dayBtnSel, !sel && isToday && styles.dayBtnToday]}
            onPress={() => onSelect(d.datum)}
            accessibilityLabel={`${d.kratko} ${d.broj}${isToday ? ", danas" : ""}`}
          >
            <Text style={[styles.dayKratko, sel && { color: colors.onPrimary }]}>{d.kratko}</Text>
            <Text style={[styles.dayBroj, sel && { color: colors.onPrimary }]}>{d.broj}</Text>
            {tacka && (
              <View
                style={[
                  styles.dot,
                  { backgroundColor: dot ? (sel ? colors.onPrimary : colors.primary) : sel ? "transparent" : colors.border },
                ]}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Red u listi podešavanja: ikona, naslov, desno vrednost ili strelica. */
export function ListRow({
  icon,
  title,
  value,
  valueColor,
  onPress,
  last,
}: {
  icon: IconName;
  title: string;
  value?: string;
  valueColor?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.listRow, !last && styles.listRowBorder]} onPress={onPress} disabled={!onPress}>
      <Icon name={icon} size={22} />
      <Text style={styles.listRowTitle}>{title}</Text>
      {value ? <Text style={[styles.listRowValue, valueColor ? { color: valueColor } : null]}>{value}</Text> : null}
      {onPress && <Icon name="chevron-forward" size={18} color={colors.textSecondary} />}
    </TouchableOpacity>
  );
}

/** Kartica-obaveštenje "novo za tebe" (zeleni okvir) sa brojem i strelicom. */
export function HighlightCard({
  broj,
  title,
  subtitle,
  onPress,
}: {
  broj?: number | string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={[common.highlightCard, styles.highlightRow]} onPress={onPress} disabled={!onPress}>
      {broj != null && (
        <View style={styles.highlightBroj}>
          <Text style={{ color: colors.onPrimary, fontFamily: fonts.black, fontSize: 16 }}>{broj}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={typography.bodyStrong}>{title}</Text>
        {subtitle ? <Text style={[typography.bodySecondary, { color: colors.highlightText }]}>{subtitle}</Text> : null}
      </View>
      {onPress && <Icon name="chevron-forward" size={20} color={colors.highlightText} />}
    </TouchableOpacity>
  );
}

/** Prazno stanje sa jednim jasnim dugmetom. */
export function EmptyState({
  icon,
  title,
  text,
  action,
  onAction,
  busy,
  style,
}: {
  icon: IconName;
  title: string;
  text?: string;
  action?: string;
  onAction?: () => void;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[common.card, styles.empty, style]}>
      <Icon name={icon} size={36} color={colors.primary} />
      <Text style={[typography.heading, { textAlign: "center" }]}>{title}</Text>
      {text ? <Text style={[typography.bodySecondary, { textAlign: "center" }]}>{text}</Text> : null}
      {action && onAction && (
        <TouchableOpacity style={[common.primaryButton, { alignSelf: "stretch", marginTop: 6 }]} onPress={onAction} disabled={busy}>
          <Text style={common.primaryButtonText}>{busy ? "Radim..." : action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Mala pomoć: kartica sa zaglavljem levo i sadržajem. */
export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[common.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  dayStrip: { flexDirection: "row", gap: 6, marginBottom: 16 },
  dayBtn: {
    flex: 1,
    minHeight: 64,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingVertical: 6,
  },
  dayBtnSel: { backgroundColor: colors.primary },
  dayBtnToday: { borderWidth: 2, borderColor: colors.primary },
  dayKratko: { fontSize: 12, fontFamily: fonts.extrabold, color: colors.textSecondary },
  dayBroj: { fontSize: 18, fontFamily: fonts.black, color: colors.textPrimary },
  dot: { width: 7, height: 7, borderRadius: 4, marginTop: 2 },
  listRow: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16 },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  listRowTitle: { flex: 1, fontSize: 16, fontFamily: fonts.extrabold, color: colors.textPrimary },
  listRowValue: { fontSize: 14, fontFamily: fonts.bold, color: colors.textSecondary },
  highlightRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  highlightBroj: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  empty: { alignItems: "center", gap: 8, paddingVertical: 24 },
});
