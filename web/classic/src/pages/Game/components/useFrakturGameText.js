import { useEffect } from 'react';

const FRAKTUR_UPPER = Array.from('𝔄𝔅ℭ𝔇𝔈𝔉𝔊ℌℑ𝔍𝔎𝔏𝔐𝔑𝔒𝔓𝔔ℜ𝔖𝔗𝔘𝔙𝔚𝔛𝔜ℨ');
const FRAKTUR_LOWER = Array.from('𝔞𝔟𝔠𝔡𝔢𝔣𝔤𝔥𝔦𝔧𝔨𝔩𝔪𝔫𝔬𝔭𝔮𝔯𝔰𝔱𝔲𝔳𝔴𝔵𝔶𝔷');

const toFraktur = (value) =>
  value.replace(/[A-Za-z]/g, (letter) => {
    const source = letter === letter.toUpperCase() ? FRAKTUR_UPPER : FRAKTUR_LOWER;
    return source[letter.toLowerCase().charCodeAt(0) - 97];
  });

const transformTextNodes = (root) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let node = walker.nextNode();
  while (node) {
    if (node.parentElement?.closest('script, style, textarea, input')) {
      node = walker.nextNode();
      continue;
    }
    nodes.push(node);
    node = walker.nextNode();
  }
  nodes.forEach((textNode) => {
    const transformed = toFraktur(textNode.nodeValue || '');
    if (transformed !== textNode.nodeValue) textNode.nodeValue = transformed;
  });
};

const shouldTransform = (node) => {
  const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  return Boolean(element?.closest('.game-page, .game-help-modal'));
};

const useFrakturGameText = (enabled = true) => {
  useEffect(() => {
    if (!enabled) return undefined;
    const root = document.querySelector('.game-page');
    if (!root) return undefined;

    transformTextNodes(root);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!shouldTransform(node)) return;
          if (node.nodeType === Node.TEXT_NODE) {
            const transformed = toFraktur(node.nodeValue || '');
            if (transformed !== node.nodeValue) node.nodeValue = transformed;
            return;
          }
          if (node.nodeType === Node.ELEMENT_NODE) transformTextNodes(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [enabled]);
};

export default useFrakturGameText;
