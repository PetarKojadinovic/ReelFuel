export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (new URL(path).hostname === "expo-share-intent") {
      return "/";
    }
    return path;
  } catch {
    return "/";
  }
}