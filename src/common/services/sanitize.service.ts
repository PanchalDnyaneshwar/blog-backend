import { Injectable } from '@nestjs/common';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

@Injectable()
export class SanitizeService {
  private DOMPurify: typeof DOMPurify;

  constructor() {
    // Create a JSDOM window for DOMPurify to work in Node.js
    const window = new JSDOM('').window;
    this.DOMPurify = (DOMPurify as any)(window as any);
  }

  /**
   * Sanitize HTML content to prevent XSS attacks
   * Allows safe HTML tags but removes dangerous scripts and attributes
   */
  sanitizeHtml(dirty: string): string {
    if (!dirty) return '';

    return this.DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
      ],
      ALLOWED_ATTR: [
        'href', 'title', 'alt', 'src', 'width', 'height', 'class',
      ],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      KEEP_CONTENT: true,
    });
  }

  /**
   * Sanitize plain text (removes all HTML)
   * Use for fields that should only contain text
   */
  sanitizeText(dirty: string): string {
    if (!dirty) return '';

    return this.DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: [],
      KEEP_CONTENT: true,
    });
  }

  /**
   * Sanitize for rich text editor content
   * More permissive but still safe
   */
  sanitizeRichText(dirty: string): string {
    if (!dirty) return '';

    return this.DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span',
        'sub', 'sup', 'del', 'ins', 'mark',
      ],
      ALLOWED_ATTR: [
        'href', 'title', 'alt', 'src', 'width', 'height', 'class', 'id',
        'style', 'data-*',
      ],
      ALLOW_DATA_ATTR: true,
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      KEEP_CONTENT: true,
    });
  }
}

