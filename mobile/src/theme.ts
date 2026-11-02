export const colors = {
  background: "#111311",   // pozadina ekrana
  surface: "#1B1E1A",      // kartice
  surfaceAlt: "#252923",   // dugmad/polja unutar kartica
  border: "#2E332C",
  divider: "#262A24",
  tabBar: "#171A16",
  textPrimary: "#F3F5F0",
  textSecondary: "#A3AA9F",

  primary: "#7CFF3D",      // lime - glavna akcentna boja (dugmici, progres, cekiranje)
  onPrimary: "#10200A",    // tekst/ikone na lime pozadini
  secondary: "#1BBE6D",    // tamnija zelena - sekundarni akcenti
  warning: "#FFB547",      // "sada je vreme" / ceka odgovor
  highlightBg: "#23301A",  // kartica "novo za tebe"
  highlightBorder: "#3C5A26",
  highlightText: "#B9C7AE",

  recipeAccent: "#7CFF3D",
  exerciseAccent: "#7CFF3D",
  danger: "#EF4444",
};

/** Nunito, ucitava se u app/_layout.tsx. Na Androidu fontWeight ne bira debljinu za custom font -> koristi ove nazive. */
export const fonts = {
  regular: "Nunito_500Medium",
  semibold: "Nunito_600SemiBold",
  bold: "Nunito_700Bold",
  extrabold: "Nunito_800ExtraBold",
  black: "Nunito_900Black",
};
