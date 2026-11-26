/** True when running inside the Capacitor Android app rather than a browser. */
export const isNativeApp =
  typeof window !== "undefined" &&
  !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
