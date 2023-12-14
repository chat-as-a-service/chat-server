
export interface LinkPreviewKafkaPayload {
    message_id: number;
    link: string;
}

export interface LinkPreviewOgScrapedResult {
    title: string;
    description?: string;
    image?: string;
    imageType?: string;
    imageWidth?: number;
    imageHeight?: number;
    imageAlt?: string;
}
