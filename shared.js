const SATS_PER_BCH = 100000000;
const MAX_INPUTS_PER_TRANSACTION = 650;
const MAX_SMALL_DONATION_COUNT = 250;
const MINIMUM_DONATION_SATOSHI_COUNT = 100000;

function calculateMinimumDonation(currentInputs, remainingValue) {
  const donationCount = (function() {
    let count = 0;
    for (let i in currentInputs) {
      count += 1;
    }
    return count;
  })();

  const smallDonationCount = (function() {
    let count = 0;
    for (let i in currentInputs) {
      const input = currentInputs[i];
      const amount = input.satoshis;
      if (amount <= MINIMUM_DONATION_SATOSHI_COUNT) {
        count += 1;
      }
    }
    return count;
  })();

  if (smallDonationCount < MAX_SMALL_DONATION_COUNT) {
    return Math.min(remainingValue, MINIMUM_DONATION_SATOSHI_COUNT);
  }

  const remainingInputCount = (MAX_INPUTS_PER_TRANSACTION - donationCount);
  const minimumSatoshis = (remainingValue / remainingInputCount);
  return Math.min(remainingValue, minimumSatoshis);
}

module.exports = {
  SATS_PER_BCH,
  MAX_INPUTS_PER_TRANSACTION,
  MAX_SMALL_DONATION_COUNT,
  calculateMinimumDonation
};
