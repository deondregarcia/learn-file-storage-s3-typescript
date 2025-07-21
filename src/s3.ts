import { file, type S3File } from "bun";
import { createTempPath } from "./api/assets";
import type { ApiConfig } from "./config";
import { getVideoAspectRatio } from "./api/videos";

export const myUploadToS3 = async (cfg: ApiConfig, filePath: string) => {
  const s3file: S3File = cfg.s3Client.file(filePath, { bucket: cfg.s3Bucket });
  const bunFile = Bun.file(filePath);

  const startTime = process.hrtime.bigint();
  await s3file.write(bunFile, { type: bunFile.type });
  const endTime = process.hrtime.bigint();

  await bunFile.delete();

  // console.log(`Upload took ${Number(endTime - startTime) / 1000} milliseconds`);
};
