export const DESIGN_PREVIEW_VALUE = "protocol-board";

export function isProtocolDesignPreview() {
  return (
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("preview") ===
      DESIGN_PREVIEW_VALUE
  );
}

export function withDesignPreview(path: string) {
  if (!isProtocolDesignPreview()) return path;

  const separator = path.includes("?") ? "&" : "?";

  return `${path}${separator}preview=${DESIGN_PREVIEW_VALUE}`;
}
