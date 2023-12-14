import puppeteer from 'puppeteer-extra';
import { type LinkPreviewOgScrapedResult } from '../types/link-preview';

export const LinkPreviewWebRepository = {
  async fetchOgTags(link: string): Promise<LinkPreviewOgScrapedResult> {
    const browser = await puppeteer.launch({
      headless: 'new',
    });
    const page = await browser.newPage();
    await page.goto(link, {
      waitUntil: 'domcontentloaded',
    });

    const ogTags = await page.evaluate(async () => {
      const ogTags: LinkPreviewOgScrapedResult = {
        title: '',
      };
      document.querySelectorAll('meta').forEach((meta: HTMLMetaElement) => {
        const property = meta.getAttribute('property');
        if (property?.includes('og:') === true) {
          const key = property.replace('og:', '');
          const value = meta.getAttribute('content')?.trim() ?? undefined;
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
        }
      });
      return ogTags;
    });
    if (ogTags.title === '') {
      ogTags.title = await page.title();
    }
    await browser.close();
    return ogTags;
  },
};
