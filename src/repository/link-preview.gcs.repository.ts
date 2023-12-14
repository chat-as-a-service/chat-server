import axios from 'axios';
import { googleCloudStorage } from '../infrastructure/gcs';

const bucketName = 'caas-link-preview-images';
export const LinkPreviewGcsRepository = {

    async uploadPreviewImage(imageUrl: string, link: string): Promise<string|undefined> {
        const gcsFileName = encodeURIComponent(link);
        const imageGetResponse = await axios.get(imageUrl, { responseType: 'stream' })


        const bucket = googleCloudStorage.bucket(bucketName);
        const file = bucket.file(gcsFileName);

        return await new Promise((resolve, reject) => {
            imageGetResponse.data.pipe(file.createWriteStream({
                metadata: {
                    contentType: imageGetResponse.headers['content-type'],
                    cacheControl: 'public, max-age=31536000'
                }
            }))
                .on('error', reject)
                .on('finish', async () => {
                    await file.makePublic().then(() => {
                        resolve(`https://storage.googleapis.com/${bucketName}/${encodeURIComponent(gcsFileName)}`);
                    });
                });
        });
    }
};
