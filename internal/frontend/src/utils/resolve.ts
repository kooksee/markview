export type LinkResolution =
  | { type: "external" }
  | { type: "hash" }
  | { type: "markdown"; hrefPath: string }
  | { type: "file"; rawUrl: string }
  | { type: "passthrough" };

function stripHashAndQuery(href: string): string {
  const hashIndex = href.indexOf("#");
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = withoutHash.indexOf("?");
  return queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
}

export function resolveLink(href: string | undefined, fileId: string): LinkResolution {
  if (!href || /^(https?:\/\/|mailto:|tel:)/i.test(href)) {
    return { type: "external" };
  }
  if (href.startsWith("#")) {
    return { type: "hash" };
  }
  const hrefPath = stripHashAndQuery(href);
  if (/\.mdx?$/i.test(hrefPath)) {
    return { type: "markdown", hrefPath };
  }
  const basename = hrefPath.split("/").pop() || "";
  if (basename.includes(".")) {
    return { type: "file", rawUrl: `/_/api/files/${fileId}/raw/${href}` };
  }
  return { type: "passthrough" };
}

export function resolveImageSrc(src: string | undefined, fileId: string): string | undefined {
  if (src && !src.startsWith("http://") && !src.startsWith("https://")) {
    return `/_/api/files/${fileId}/raw/${src}`;
  }
  return src;
}

export function extractLanguage(className: string | undefined): string | null {
  const match = /language-(\w+)/.exec(className || "");
  return match ? match[1] : null;
}
