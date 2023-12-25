import { type LinkPreviewOgScrapedResult } from '../types/link-preview';
import axios from 'axios';
import * as cheerio from 'cheerio';

export const LinkPreviewWebRepository = {
  async fetchOgTags(link: string): Promise<LinkPreviewOgScrapedResult> {
    // Fetching the HTML content of the page
    const { data } = await axios.get(link, {
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    const ogTags: LinkPreviewOgScrapedResult = {
      title: '',
    };

    // Selecting all meta tags with properties that start with 'og:'
    $('meta[property^="og:"]').each((i, elem) => {
      const property = $(elem).attr('property');
      const content = $(elem).attr('content');
      const key = property?.replace('og:', '');
      const value = content?.trim() ?? undefined;
      if (value == null || value === '') return;
      switch (key) {
        case 'title':
          ogTags.title = value;
          break;
        case 'description':
          ogTags.description = value;
          break;
        case 'image':
        case 'image:url':
        case 'image:secure_url':
          ogTags.image = value;
          break;
        case 'image:type':
          ogTags.imageType = value;
          break;
        case 'image:width':
          ogTags.imageWidth = Number(value);
          break;
        case 'image:height':
          ogTags.imageHeight = Number(value);
          break;
        case 'image:alt':
          ogTags.imageAlt = value;
          break;
      }
    });

    if (ogTags.title === '') {
      ogTags.title = $('title').text();
    }
    return ogTags;
  },
};
