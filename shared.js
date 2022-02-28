const SATS_PER_BCH = 100000000;
const MAX_INPUTS_PER_TRANSACTION = 650;

// Calculate how many % of the total fundraiser the smallest acceptable contribution is at the moment.
function calculateMinimumDonation(inputPercent, currentInputCount, remainingValue) {
  const smallDonationReservedInputCount = 250;
  const modifiedCurrentInputCount = Math.max(0, (currentInputCount - smallDonationReservedInputCount));

  const minPercent = 0 + (remainingValue / (MAX_INPUTS_PER_TRANSACTION - modifiedCurrentInputCount) + 546 / SATS_PER_BCH) / remainingValue;
  const maxPercent = 1 - ((42 + 1650 + 49) * 1.0) / Math.round(remainingValue * SATS_PER_BCH);

  // ...
  const minValue = Math.log(minPercent * 100);
  const maxValue = Math.log(maxPercent * 100);

  // Return a percentage number on a non-linear scale with higher resolution in the lower boundaries.
  return (Math.exp(minValue + (inputPercent * (maxValue - minValue)) / 100) / 100);
}

module.exports = {
  SATS_PER_BCH,
  MAX_INPUTS_PER_TRANSACTION,
  calculateMinimumDonation
};
