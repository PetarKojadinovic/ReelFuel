import { Redirect } from "expo-router";

// Mesto za dugme "+" u donjem meniju. Samo dugme otvara /dodaj (vidi (tabs)/_layout.tsx);
// ako neko ipak dođe na ovu rutu, vrati ga na Danas.
export default function PlusPlaceholder() {
  return <Redirect href="/" />;
}
