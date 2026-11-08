// Pin the timezone: the local-day tests (midnight, DST-sensitive dates) must behave the same on UTC CI runners.
module.exports = async () => {
  process.env.TZ = 'Europe/Berlin';
};
