function verifiedConnectionString(value, options = {}) {
  if (!value) throw new Error('DATABASE_URL is not set');
  const url = new URL(value);
  if (options.direct) url.hostname = url.hostname.replace('-pooler.', '.');
  if (['prefer', 'require', 'verify-ca'].includes(url.searchParams.get('sslmode'))) {
    // Keep certificate and hostname verification explicit across pg upgrades.
    url.searchParams.set('sslmode', 'verify-full');
  }
  return url.toString();
}

module.exports = { verifiedConnectionString };
