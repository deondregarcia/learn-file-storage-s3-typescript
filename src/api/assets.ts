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

  return "." + split[1];
};

export const getAssetDiskPath = (cfg: ApiConfig, assetPath: string) => {
  return path.join(cfg.assetsRoot, assetPath);
};

export const isUnsupportedType = (mediaType: string) => {
  return mediaType !== "image/png" && mediaType !== "image/jpeg";
};
