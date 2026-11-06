// src/utils/displayName.jsx
const KNOWN_PREFIXES = new Set([
    'Bc.', 'Mgr.', 'Ing.', 'RNDr.', 'PaedDr.', 'Mgr. art.', 'doc.', 'prof.', 'Dr.', 'JUDr.', 'MUDr.'
]);

const uniq = (arr = []) =>
    Array.from(new Set((arr || []).map(s => String(s || '').trim()).filter(Boolean)));

const maskHumanNamePreservingTitles = (full = '') => {
    const [left, right] = String(full).split(/\s*,\s*/, 2);
    const tokens = left.split(/\s+/).filter(Boolean);

    const masked = tokens
        .map(tok => {
            if (KNOWN_PREFIXES.has(tok)) return tok;
            if (tok.length <= 1) return tok;
            const stars = tok.length <= 3 ? '*'.repeat(tok.length - 1) : '***';
            return tok[0] + stars;
        })
        .join(' ');

    return right ? `${masked}, ${right}` : masked;
};

export const readTitlesFrom = (src = {}) => {
    const t = src.titles || {};
    const prefixes = Array.isArray(src.titlesPrefix)
        ? src.titlesPrefix
        : Array.isArray(t.prefix)
            ? t.prefix
            : [];
    const suffixes = Array.isArray(src.titlesSuffix)
        ? src.titlesSuffix
        : Array.isArray(t.suffix)
            ? t.suffix
            : [];
    return { prefixes: uniq(prefixes), suffixes: uniq(suffixes) };
};

export const baseNameFrom = (src = {}) =>
    ([String(src.firstName || src.givenName || '').trim(), String(src.lastName || src.familyName || '').trim()]
        .filter(Boolean)
        .join(' ')
        .trim()) ||
    String(src.name || src.fullName || src.displayName || src.email || '').trim();

const formatWithTitles = ({ prefixes = [], name = '', suffixes = [] }) => {
    let left = name || '';
    if (prefixes.length) left = `${prefixes.join(' ')} ${left}`.trim();
    if (suffixes.length) left = `${left}, ${suffixes.join(', ')}`.trim();
    return left.replace(/\s+/g, ' ').trim();
};

export function displayNameFrom(src = {}, opts = {}) {
    const { prefixes, suffixes } = readTitlesFrom(src);
    const name = baseNameFrom(src);
    const out = formatWithTitles({ prefixes, name, suffixes });
    if (opts.privacy) return out ? maskHumanNamePreservingTitles(out) : '';
    return out;
}

/**
 * Extract readable name from email address
 * e.g., "marek.horvath@university.edu" -> "Marek Horvath"
 */
export const nameFromEmail = (email = '') => {
    if (!email || !email.includes('@')) return '';
    const [localPart] = email.split('@');
    if (!localPart) return '';
    return localPart
        .replace(/[._-]/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
};

/**
 * Get initials from a name or email
 * Handles:
 * - Regular names: "Marek Horvath" -> "MH"
 * - Email addresses: "marek.horvath@university.edu" -> "MH"
 * - Objects with name/email properties
 */
export const getInitials = (input, fallback = '??') => {
    let name = '';
    
    if (typeof input === 'object' && input !== null) {
        // Try to get a proper name from object
        name = input.name || input.fullName || input.displayName || 
               `${input.firstName || ''} ${input.lastName || ''}`.trim();
        
        // If name looks like email or is empty, try to extract from email
        if (!name || name.includes('@')) {
            const email = input.email || '';
            if (email) {
                name = nameFromEmail(email);
            }
        }
    } else if (typeof input === 'string') {
        name = input;
        // If it's an email, extract name from it
        if (name.includes('@')) {
            name = nameFromEmail(name);
        }
    }
    
    if (!name) return fallback;
    
    // Strip common academic titles before extracting initials
    const stripped = name
        .replace(/^(Bc\.|Mgr\.|Ing\.|RNDr\.|PaedDr\.|doc\.|prof\.|Dr\.|JUDr\.|MUDr\.)\s*/gi, '')
        .replace(/,\s*(PhD\.?|CSc\.?|DrSc\.?).*$/gi, '')
        .trim();
    
    return stripped
        .split(' ')
        .filter(Boolean)
        .map(n => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || fallback;
};

export default displayNameFrom;