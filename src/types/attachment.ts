export interface AttachmentEntity {
  bucket_name: string;
  file_key: string;
  original_file_name: string;
  content_type: string;
}

export interface AttachmentResponse {
  original_file_name: string;
  content_type: string;
  download_signed_url: string;
}
export interface NewAttachmentUploadSignedUrlPayload {
  file_name: string;
  file_type?: string;
  file_content_length: number;
  channel_uuid: string;
}

export interface NewAttachmentUploadSignedUrlResponse {
  upload_signed_url: string;
  download_signed_url: string;
  content_type: string;
  headers: Record<string, string>;
  bucket: string;
  file_key: string;
}

export interface GCSAttachmentPutSignedUrlGenResult {
  gcsFileKey: string;
  signedUrl: string;
  contentType: string;
  headers: Record<string, string>;
  bucket: string;
}
export interface ESAttachment {
  bucket_name: string;
  file_key: string;
  original_file_name: string;
  content_type: string;
}
