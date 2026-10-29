const mongoose = require('mongoose');
const dns = require('dns');

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured');

  // Some Windows/VPN DNS forwarders refuse SRV queries. Allow a project-level
  // resolver override without changing the machine's DNS configuration.
  const dnsServers = (process.env.DNS_SERVERS || '')
    .split(',')
    .map(server => server.trim())
    .filter(Boolean);
  if (dnsServers.length) dns.setServers(dnsServers);

  await mongoose.connect(uri);
  console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
}

module.exports = connectDB;
