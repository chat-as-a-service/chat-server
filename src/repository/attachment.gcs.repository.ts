import { googleCloudStorage } from '../infrastructure/gcs';
import { type GetSignedUrlConfig } from '@google-cloud/storage';
import { randomUUID } from 'crypto';
import { type GCSAttachmentPutSignedUrlGenResult } from '../types/attachment';

const bucketName = 'caas-attachments';
export const AttachmentGcsRepository = {
  async signUploadLink(
    appUuid: string,
    channelUuid: string,
    username: string,
    fileName: string,
    fileContentLength: number,
    fileType?: string,
  ): Promise<GCSAttachmentPutSignedUrlGenResult> {
    const fileKey = `application_uuid=${appUuid}/channel_uuid=${channelUuid}/${randomUUID()}`;
    const metadata = {
      metadata: {
        originalName: encodeURIComponent(fileName), // Encoding the filename
        username: encodeURIComponent(username),
      },
    };
    const extensionHeaders = {
      'x-goog-meta-original-name': metadata.metadata.originalName,
      'x-goog-meta-username': metadata.metadata.username,
      'x-goog-content-length-range': `0,${fileContentLength}`
    };
    const contentType = fileType ?? 'application/octet-stream';
    const options: GetSignedUrlConfig = {
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // URL valid for 15 minutes
      contentType,
      extensionHeaders,
    };

    try {
      const [url] = await googleCloudStorage
        .bucket(bucketName)
        .file(fileKey)
        .getSignedUrl(options);
      console.log('Generated upload signed URL:', url);
      return {
        gcsFileKey: fileKey,
        signedUrl: url,
        contentType,
        headers: extensionHeaders,
        bucket: bucketName,
      };
    } catch (error) {
      console.error('Error generating upload signed URL', error);
      throw error;
    }
  },

  async signDownloadLink(fileKey: string, originalFileName?: string) {
    const config: GetSignedUrlConfig = {
      action: 'read', // action "read" allows download
      expires: Date.now() + 8 * 60 * 60 * 1000, // expires in 8 hours
      responseDisposition:
        originalFileName == null
          ? 'attachment'
          : `attachment; filename=${originalFileName}`,
    };

    return (await googleCloudStorage
      .bucket(bucketName)
      .file(fileKey)
      .getSignedUrl(config))[0];
  },
};
