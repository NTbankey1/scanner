import { parseSitemapXml } from '../resource-discovery/SitemapParser';
import { extractCssResources } from '../resource-discovery/CssParser';
import { extractJsResources } from '../resource-discovery/JavaScriptAnalyzer';
import { extractJsonLdFromHtml, extractUrlsFromJsonLd } from '../resource-discovery/JsonLdExtractor';

// Offscreen document: handles heavy parsing tasks without blocking service worker

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message.action) {
    case 'parse-sitemap':
      sendResponse(parseSitemapXml(message.xml));
      break;
    case 'parse-css':
      sendResponse(extractCssResources(message.cssText));
      break;
    case 'parse-js':
      sendResponse(extractJsResources(message.jsText, message.pageUrl));
      break;
    case 'parse-jsonld':
      const entities = extractJsonLdFromHtml(message.html);
      const urls = extractUrlsFromJsonLd(entities);
      sendResponse({ entities, urls });
      break;
    default:
      sendResponse(null);
  }
  return true; // Keep channel open for async response
});

export {};
