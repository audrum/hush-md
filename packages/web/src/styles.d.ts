// Vite turns a CSS import into a side effect that injects the stylesheet, but
// TypeScript has no declaration for it unless "vite/client" is added to the
// compiler's `types`, which this project keeps to just node on purpose.
// Declaring the single shape actually used is smaller than pulling in the
// whole client namespace, and it keeps `tsc --noEmit` a clean signal.
declare module "*.css";
