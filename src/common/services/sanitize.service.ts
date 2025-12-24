import { Injectable } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

@Injectable()
export class SanitizeService {
  /**
   * Sanitize HTML content to prevent XSS attacks
   * Allows safe HTML tags but removes dangerous scripts and attributes
   */
  sanitizeHtml(dirty: string): string {
    if (!dirty) return '';

    return sanitizeHtml(dirty, {
      allowedTags: [
        'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td',
      ],
      allowedAttributes: {
        'a': ['href', 'title'],
        'img': ['src', 'alt', 'width', 'height', 'title'],
        '*': ['class'],
      },
      allowedSchemes: ['http', 'https', 'mailto', 'tel'],
      allowedSchemesByTag: {
        img: ['http', 'https', 'data'],
      },
    });
  }

  /**
   * Sanitize plain text (removes all HTML)
   * Use for fields that should only contain text
   */
  sanitizeText(dirty: string): string {
    if (!dirty) return '';

    return sanitizeHtml(dirty, {
      allowedTags: [],
      allowedAttributes: {},
    });
  }

  /**
   * Sanitize for rich text editor content
   * More permissive but still safe
   */
  sanitizeRichText(dirty: string): string {
    if (!dirty) return '';

    return sanitizeHtml(dirty, {
      allowedTags: [
        'p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote', 'code', 'pre', 'a', 'img',
        'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span',
        'sub', 'sup', 'del', 'ins', 'mark',
      ],
      allowedAttributes: {
        'a': ['href', 'title', 'class', 'id'],
        'img': ['src', 'alt', 'width', 'height', 'title', 'class', 'id'],
        'div': ['class', 'id', 'style'],
        'span': ['class', 'id', 'style'],
        '*': ['class', 'id', 'data-*'],
      },
      allowedSchemes: ['http', 'https', 'mailto', 'tel'],
      allowedSchemesByTag: {
        img: ['http', 'https', 'data'],
      },
      allowedStyles: {
        '*': {
          'color': [/^#[0-9a-fA-F]{6}$/, /^rgb\(/, /^rgba\(/],
          'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
          'font-size': [/^\d+(?:px|em|rem|%)$/],
        },
      },
    });
  }
}

