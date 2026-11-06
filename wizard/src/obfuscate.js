/**
 * String-table XOR obfuscation adapted from itsyebekhe/jasaz.
 * Replaces string literals with runtime decoder calls; skips comments,
 * template literals, regex, import/export paths, and object keys.
 */

const XOR_KEY = 0x4f;

function encodeStringToTable(str, key) {
  const utf8Str = unescape(encodeURIComponent(str));
  let out = "";
  for (let i = 0; i < utf8Str.length; i++) {
    out += String.fromCharCode(utf8Str.charCodeAt(i) ^ (key ^ (i % 11)));
  }
  return btoa(out);
}

export function obfuscateWorkerCode(code) {
  const stringTable = [];
  const stringIndexMap = new Map();

  function getOrAddString(strContent) {
    if (stringIndexMap.has(strContent)) return stringIndexMap.get(strContent);
    const idx = stringTable.length;
    stringTable.push(encodeStringToTable(strContent, XOR_KEY));
    stringIndexMap.set(strContent, idx);
    return idx;
  }

  let i = 0;
  const len = code.length;
  let output = "";

  while (i < len) {
    const char = code[i];
    const nextChar = i + 1 < len ? code[i + 1] : "";

    if (char === "/" && nextChar === "/") {
      const end = code.indexOf("\n", i);
      if (end === -1) {
        output += code.slice(i);
        break;
      }
      output += code.slice(i, end);
      i = end;
      continue;
    }

    if (char === "/" && nextChar === "*") {
      const end = code.indexOf("*/", i + 2);
      if (end === -1) {
        output += code.slice(i);
        break;
      }
      output += code.slice(i, end + 2);
      i = end + 2;
      continue;
    }

    if (char === "`") {
      let end = i + 1;
      while (end < len) {
        if (code[end] === "\\") end += 2;
        else if (code[end] === "`") {
          end++;
          break;
        } else end++;
      }
      output += code.slice(i, end);
      i = end;
      continue;
    }

    if (char === "/") {
      const trimmed = output.trimEnd();
      const lastChar = trimmed.slice(-1);
      const isRegex =
        !lastChar ||
        "(=:[,!&|?;{}~^+*%-".includes(lastChar) ||
        /(?:return|case|delete|throw|typeof)\s*$/.test(trimmed);

      if (isRegex) {
        let end = i + 1;
        let inClass = false;
        while (end < len) {
          if (code[end] === "\\") end += 2;
          else if (code[end] === "[" && !inClass) {
            inClass = true;
            end++;
          } else if (code[end] === "]" && inClass) {
            inClass = false;
            end++;
          } else if (code[end] === "/" && !inClass) {
            end++;
            while (end < len && /[gimsuy]/.test(code[end])) end++;
            break;
          } else end++;
        }
        output += code.slice(i, end);
        i = end;
        continue;
      }
    }

    if (char === '"' || char === "'") {
      const quote = char;
      const strStart = i;
      let strEnd = i + 1;

      while (strEnd < len) {
        if (code[strEnd] === "\\") strEnd += 2;
        else if (code[strEnd] === quote) {
          strEnd++;
          break;
        } else if (code[strEnd] === "\n") break;
        else strEnd++;
      }

      const strLiteral = code.slice(strStart, strEnd);
      let rawVal = null;
      try {
        rawVal =
          quote === '"'
            ? JSON.parse(strLiteral)
            : JSON.parse(
                `"${strLiteral.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"')}"`
              );
      } catch {
        rawVal = strLiteral.slice(1, -1);
      }

      const prevTrimmed = output.trimEnd();
      const isImportExport = /(?:from|import)\s*$/.test(prevTrimmed);
      const isDirective = rawVal === "use strict";

      if (isImportExport || isDirective || !rawVal || rawVal.length === 0) {
        output += strLiteral;
        i = strEnd;
        continue;
      }

      let k = strEnd;
      while (
        k < len &&
        (code[k] === " " || code[k] === "\t" || code[k] === "\r" || code[k] === "\n")
      )
        k++;
      const isFollowedByColon = code[k] === ":" && code[k + 1] !== ":";
      const lastToken = prevTrimmed.slice(-1);
      const isTernaryOrCondition =
        lastToken === "?" || /(?:case)\s*$/.test(prevTrimmed);

      if (isFollowedByColon && !isTernaryOrCondition) {
        output += strLiteral;
      } else {
        const idx = getOrAddString(rawVal);
        output += `func_dec(${idx})`;
      }

      i = strEnd;
      continue;
    }

    output += char;
    i++;
  }

  const runtimeHeader = `// @ts-nocheck
const _0x_key = ${XOR_KEY};
const _0x_tbl = ${JSON.stringify(stringTable)};
const _0x_cache = new Map();
function func_dec(idx) {
  if (_0x_cache.has(idx)) return _0x_cache.get(idx);
  const raw = atob(_0x_tbl[idx]);
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    out += String.fromCharCode(raw.charCodeAt(i) ^ (_0x_key ^ (i % 11)));
  }
  try {
    out = decodeURIComponent(escape(out));
  } catch (_) {}
  _0x_cache.set(idx, out);
  return out;
}
`;
  return runtimeHeader + "\n" + output;
}
