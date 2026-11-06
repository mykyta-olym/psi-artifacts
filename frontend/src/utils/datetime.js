export function formatDateTimeLabel(label, value, { fallback = "—" } = {}) {
    if (!value) return `${label}: ${fallback}`;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return `${label}: ${fallback}`;
    return `${label}: ${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
}

export function formatLastLogin(value) {
    return formatDateTimeLabel("Last login", value);
}

