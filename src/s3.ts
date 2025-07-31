import { file, type S3File } from "bun";
import { createTempPath } from "./api/assets";
import type { ApiConfig } from "./config";
import { getVideoAspectRatio } from "./api/videos";

export const myUploadToS3 = async (
  cfg: ApiConfig,
  filePath: string,
  key: string
) => {
  const s3file: S3File = cfg.s3Client.file(key, { bucket: cfg.s3Bucket });
  const bunFile = Bun.file(filePath);

  await s3file.write(bunFile, { type: bunFile.type });
};
