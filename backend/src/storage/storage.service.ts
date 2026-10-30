import { Injectable, Module, ServiceUnavailableException } from '@nestjs/common';

const ALLOWED_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/** S3 presigned-upload helper. Env: S3_BUCKET, S3_REGION (default ap-south-1), S3_PUBLIC_BASE_URL (optional), AWS creds via default chain. */
@Injectable()
export class StorageService {
  private client: any = null;

  get configured() {
    return !!process.env.S3_BUCKET;
  }

  private async s3() {
    if (!this.configured) throw new ServiceUnavailableException('File storage is not configured');
    if (!this.client) {
      const { S3Client } = await import('@aws-sdk/client-s3');
      this.client = new S3Client({ region: process.env.S3_REGION ?? 'ap-south-1' });
    }
    return this.client;
  }

  isAllowedContentType(t: string) {
    return ALLOWED_CONTENT_TYPES.includes(t);
  }

  async presignUpload(key: string, contentType: string, expiresIn = 300) {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
    const client = await this.s3();
    const url = await getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, ContentType: contentType }),
      { expiresIn },
    );
    return { uploadUrl: url, key, method: 'PUT', headers: { 'Content-Type': contentType }, expiresIn };
  }

  async presignDownload(key: string, expiresIn = 300) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
    return getSignedUrl(await this.s3(), new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }), { expiresIn });
  }

  publicUrl(key: string) {
    const base = process.env.S3_PUBLIC_BASE_URL ?? `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION ?? 'ap-south-1'}.amazonaws.com`;
    return `${base.replace(/\/$/, '')}/${key}`;
  }
}

@Module({ providers: [StorageService], exports: [StorageService] })
export class StorageModule {}
