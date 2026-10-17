// Minimal XML parser for Tally's export responses. Kept dependency-free so the
// agent can be copied to the Tally server and run without `npm install`.
//
// Produces { name, attrs, children, text } nodes. Handles attributes, entities
// (named + numeric), self-closing tags, comments, CDATA and processing
// instructions — everything Tally emits. Not a validating parser.

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export function decodeEntities(s) {
  if (!s.includes("&")) return s;
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      // Tally emits control characters such as &#4; in some text; drop them.
      if (!Number.isFinite(code) || code < 9 || (code > 13 && code < 32)) return "";
      return String.fromCodePoint(code);
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

const ATTR_RE = /([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/g;

export function parseXml(xml) {
  const root = { name: "#root", attrs: {}, children: [], text: "" };
  const stack = [root];
  let i = 0;

  while (i < xml.length) {
    const lt = xml.indexOf("<", i);
    const top = stack[stack.length - 1];
    if (lt === -1) {
      top.text += decodeEntities(xml.slice(i));
      break;
    }
    if (lt > i) top.text += decodeEntities(xml.slice(i, lt));

    if (xml.startsWith("<!--", lt)) {
      i = skipTo(xml, "-->", lt);
    } else if (xml.startsWith("<![CDATA[", lt)) {
      const end = xml.indexOf("]]>", lt);
      top.text += xml.slice(lt + 9, end === -1 ? xml.length : end);
      i = end === -1 ? xml.length : end + 3;
    } else if (xml[lt + 1] === "?" || xml[lt + 1] === "!") {
      i = skipTo(xml, ">", lt);
    } else if (xml[lt + 1] === "/") {
      const gt = xml.indexOf(">", lt);
      const name = xml.slice(lt + 2, gt).trim();
      // Pop to the matching open tag; tolerate stray closers.
      for (let d = stack.length - 1; d > 0; d--) {
        if (stack[d].name === name) {
          stack.length = d;
          break;
        }
      }
      i = gt === -1 ? xml.length : gt + 1;
    } else {
      const gt = findTagEnd(xml, lt);
      let body = xml.slice(lt + 1, gt);
      const selfClosing = body.endsWith("/");
      if (selfClosing) body = body.slice(0, -1);
      const sp = body.search(/\s/);
      const name = sp === -1 ? body : body.slice(0, sp);
      const attrs = {};
      if (sp !== -1) {
        for (const m of body.slice(sp).matchAll(ATTR_RE)) {
          attrs[m[1]] = decodeEntities(m[3] ?? m[4] ?? "");
        }
      }
      const node = { name, attrs, children: [], text: "" };
      top.children.push(node);
      if (!selfClosing) stack.push(node);
      i = gt + 1;
    }
  }
  return root;
}

function skipTo(xml, token, from) {
  const end = xml.indexOf(token, from);
  return end === -1 ? xml.length : end + token.length;
}

/** Index of the `>` closing a start tag, ignoring `>` inside quoted attributes. */
function findTagEnd(xml, from) {
  let quote = null;
  for (let j = from + 1; j < xml.length; j++) {
    const c = xml[j];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ">") {
      return j;
    }
  }
  return xml.length;
}

// --- Query helpers ------------------------------------------------------------

/** All descendants (any depth) named `name`, not descending into matches. */
export function findAll(node, name) {
  const out = [];
  const walk = (n) => {
    for (const c of n.children) {
      if (c.name === name) out.push(c);
      else walk(c);
    }
  };
  walk(node);
  return out;
}

/** Direct children named `name`. */
export function children(node, name) {
  return node.children.filter((c) => c.name === name);
}

/** Trimmed text of the first direct child named `name` ("" when absent). */
export function childText(node, name) {
  const c = node.children.find((x) => x.name === name);
  return c ? c.text.trim() : "";
}
