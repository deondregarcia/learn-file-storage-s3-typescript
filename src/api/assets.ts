import { existsSync, mkdirSync } from "fs";
import path from "path";

import type { ApiConfig } from "../config";

export function ensureAssetsDir(cfg: ApiConfig) {
  if (!existsSync(cfg.assetsRoot)) {
    mkdirSync(cfg.assetsRoot, { recursive: true });
  }
}

export const mediaTypeToExt = (mediaType: string) => {
  const split = mediaType.split("/");
  if (split.length !== 2) {
    return ".bin";
  }

  return split[1];
};

export const createTempPath = (videoKey: string) => {
  return path.join("/tmp", videoKey);
};

export const isUnsupportedType = (mediaType: string) => {
  return mediaType !== "image/png" && mediaType !== "image/jpeg";
};
