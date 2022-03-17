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

/**
 * Encodes a string into binary with support for multibyte content.
 *
 * @param string   a unicode (utf16) string to encode.
 * @returns the string encoded in base64.
 */
const base64encode = function (string) {
  const codeUnits = new Uint16Array(string.length);

  for (let i = 0; i < codeUnits.length; i += 1) {
    codeUnits[i] = string.charCodeAt(i);
  }

  return btoa(String.fromCharCode(...new Uint8Array(codeUnits.buffer)));
};

/**
 * Decodes a binary into a string taking care to properly decode multibyte content.
 *
 * @param binary   a base64 encoded string to decode.
 * @returns the binary decoded from base64.
 */
const base64decode = function (binary) {
  return atob(binary);

  // NOTE: The below code should have worked according to MDN,
  //       but caused issues when used with JSON.parse.
  /*
	let string = atob(binary);

	const bytes = new Uint8Array(string.length);

	for (let i = 0; i < bytes.length; i++)
	{
		bytes[i] = string.charCodeAt(i);
	}

	return String.fromCharCode(...new Uint16Array(bytes.buffer));
	*/
};

module.exports = {
  SATS_PER_BCH,
  MAX_INPUTS_PER_TRANSACTION,
  MAX_SMALL_DONATION_COUNT,
  calculateMinimumDonation,
  base64encode,
  base64decode
};
