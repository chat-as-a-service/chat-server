import { type Server, type Socket } from 'socket.io';
import { type CustomSocket } from '../types/socket';
import { ChannelRepository } from '../repository/channel.repository';
import { AttachmentGcsRepository } from '../repository/attachment.gcs.repository';
import {
  NewAttachmentUploadSignedUrlPayload,
  NewAttachmentUploadSignedUrlResponse,
} from '../types/attachment';
import { CustomResponse } from '../types/common';

export default (io: Server, socket: Socket): void => {
  const customSocket = socket as CustomSocket;
  const generateAttachmentUploadSignedUrl = async (
    payload: NewAttachmentUploadSignedUrlPayload,
    ack: (
      response: CustomResponse<NewAttachmentUploadSignedUrlResponse>,
    ) => void,
  ): Promise<void> => {
    // reject file bigger than 10MB
    if (payload.file_content_length > 1024 * 1024 * 10) {
      console.warn(
        'File cannot be bigger than 10MB',
        payload.file_content_length,
      );
      ack({
        result: 'error',
        error_msg: 'File cannot be bigger than 10MB',
      });
      return;
    }
    const channel = await ChannelRepository.findOneBy({
      uuid: payload.channel_uuid,
    });
    if (channel == null) {
      console.warn('Channel not found', payload.channel_uuid);
      return;
    }
    const signedUploadUrl = await AttachmentGcsRepository.signUploadLink(
      customSocket.application_uuid,
      channel.uuid,
      customSocket.username,
      payload.file_name,
      payload.file_content_length,
      payload.file_type,
    );
    const signedDownloadUrl = await AttachmentGcsRepository.signDownloadLink(
      signedUploadUrl.gcsFileKey,
      payload.file_name,
    );
    ack({
      result: 'success',
      data: {
        upload_signed_url: signedUploadUrl.signedUrl,
        download_signed_url: signedDownloadUrl,
        content_type: signedUploadUrl.contentType,
        headers: signedUploadUrl.headers,
        bucket: signedUploadUrl.bucket,
        file_key: signedUploadUrl.gcsFileKey,
      },
    });
  };

  socket.on(
    'attachment:request-upload-signed-url',
    generateAttachmentUploadSignedUrl,
  );
};
