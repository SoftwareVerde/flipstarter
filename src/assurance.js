// Load the bitbox library.
const bitboxSDK = require("bitbox-sdk");
const bitbox = new bitboxSDK.BITBOX();

class javascriptUtilities {
  /**
   * Reverses a Buffers content
   *
   * @param source   the Buffer to reverse
   *
   * @returns a new Buffer with the contents reversed.
   */
  static reverseBuf(source) {
    // Allocate space for the reversed buffer.
    let reversed = Buffer.allocUnsafe(source.length);

    // Iterate over half of the buffers length, rounded up..
    for (
      let lowIndex = 0, highIndex = source.length - 1;
      lowIndex <= highIndex;
      lowIndex += 1, highIndex -= 1
    ) {
      // .. and swap each position from the beggining to the end.
      reversed[lowIndex] = source[highIndex];
      reversed[highIndex] = source[lowIndex];
    }

    // Return the reversed buffer.
    return reversed;
  }

  /**
   * Utility function that can be used to restore Buffers from JSON.
   *
   * @param k   key part of a key-value pair.
   * @param v   value part of a key-value pair.
   *
   * @returns a Buffer restored from the `v.data` field, or the `v` value.
   */
  static bufferReviver(k, v) {
    // Check if the data might be a buffer..
    let condition =
      v !== null &&
      typeof v === "object" &&
      "type" in v &&
      v.type === "Buffer" &&
      "data" in v &&
      Array.isArray(v.data);

    // Determine what to return based on condition.
    let result = condition ? new Buffer(v.data) : v;

    // Return the parsed content.
    return result;
  }
}

class bitcoinCashUtilities {
  /**
   * Helper function that takes an integer and encodes it as a buffer according to
   * https://en.bitcoin.it/wiki/Protocol_documentation#Variable_length_integer
   *
   * @param number   an integer to encode in the varInt format.
   *
   * @returns a Buffer with the integer encoded as a varInt.
   */
  static varInt(number) {
    // Declare storage for the results.
    let result;

    // If the number should be encoded in 1 byte..
    if (number < 0xfd) {
      result = Buffer.alloc(1);
      result.writeUInt8(number);
    }
    // If the number should be encoded in 3 bytes..
    else if (number < 0xffff) {
      result = Buffer.alloc(3);
      result.writeUInt8(0xfd);
      result.writeUInt16LE(number, 1);
    }
    // If the number should be encoded in 5 bytes..
    else if (number < 0xffffffff) {
      result = Buffer.alloc(5);
      result.writeUInt8(0xfe);
      result.writeUInt32LE(number, 1);
    }
    // If the number should be encoded in 9 bytes..
    else {
      result = Buffer.alloc(9);
      result.writeUInt8(0xff);
      result.writeBigUInt64LE(BigInt(number), 1);
    }

    // Return the variable integer buffer.
    return result;
  }

  /**
   * Helper function that takes a buffer and encodes it according to
   * https://en.bitcoin.it/wiki/Protocol_documentation#Variable_length_string
   *
   * @param input   a buffer to encode in the varBuf format.
   *
   * @returns a Buffer with the content encoded as a varBuf.
   */
  static varBuf(input) {
    let prependLength = bitcoinCashUtilities.varInt(input.length);
    let result = Buffer.concat([prependLength, input]);

    // Return the variable buffer encoded data.
    return result;
  }

  /**
   * Helper function that provides the dust limit standardness parameter.
   *
   * @returns the dustlimit in satoshis.
   */
  static get dustLimit() {
    return 546;
  }

  /**
   * Helper function that provides the max satoshis that is spendable.
   *
   * @returns the dustlimit in satoshis.
   */
  static get maxLimit() {
    return 2099999997690000;
  }
}

class assuranceStorage {
  /**
   * Removes all currently stored values.
   */
  clear() {
    localStorage.clear();
  }

  /**
   * Gets a value matching the provided key, or null.
   *
   * @param key   string name of the key for the value.
   *
   * @returns the value associated with the key, or null if no such key-value pair is available.
   */
  getItem(key) {
    // Return the stored value.
    return localStorage.getItem(key);
  }

  /**
   * Sets or overwrites a value associated with the provided key.
   *
   * @param key     string name of the key to associate the value with.
   * @param value   item that can be losslessly encoded in JSON to store.
   */
  setItem(key, value) {
    // Store the json-encoded value.
    localStorage.setItem(key, JSON.stringify(value));
  }

  /**
   * Removes a value associated with the provided key.
   *
   * @param key     string name of the key to remove the value for.
   */
  removeItem(key) {
    // Remove the key-value pair.
    localStorage.removeItem(key);
  }
}

class assuranceContract {
  /**
   * Constructor that takes parameters necessary to construct the assurance contract object.
   *
   * @param assuranceStorage   an object with the following storage methods: clear(), getItem(key), setItem(key, value), removeItem(key).
   */
  constructor(assuranceStorage) {
    // Store the storage interface locally.
    this.storage = assuranceStorage;

    // Initialize an empty storage for outputs.
    this.outputs = [];

    // initialize an empty storage for inputs.
    this.inputs = [];
  }

  /**
   * Adds an output to the assurance contract.
   *
   * @param satoshis    integer number of satoshis to send to the address.
   * @param address     cashaddr encoded output address to send satoshis to.
   */
  addOutput(satoshis, address) {
    // Check if the provided address is properly encoded.
    if (!bitbox.Address.isCashAddress(address)) {
      throw `Cannot add output, provided address '${address}' does not use the valid CashAddr encoding.`;
    }

    // Check if the provided satoshis is of the correct type.
    if (isNaN(satoshis)) {
      throw `Cannot add output, provided satoshis '${satoshis}' is not a number.`;
    }

    // Check if the provided satoshis is an integer.
    if (!Number.isInteger(satoshis)) {
      throw `Cannot add output, provided satoshis '${satoshis}' is not an integer.`;
    }

    // Check if the provided satoshis is a positive number.
    if (satoshis < 0) {
      throw `Cannot add output, provided satoshis '${satoshis}' is negative.`;
    }

    // Check if the provided satoshis is large enough to be accepted.
    if (satoshis < bitcoinCashUtilities.dustLimit) {
      throw `Cannot add output, provided satoshis '${satoshis}' is smaller than the dust limit.`;
    }

    // Check if the provided satoshis is too large to be accepted.
    if (satoshis > bitcoinCashUtilities.maxLimit) {
      throw `Cannot add output, provided satoshis '${satoshis}' is larger than the max limit.`;
    }

    // Derive the locking script from the address.
    const locking_script = this.getLockscriptFromAddress(address);

    // Structure the output
    const output = {
      value: assuranceContract.encodeOutputValue(satoshis),
      locking_script: locking_script,
    };

    // Add the output to assurance contract.
    this.outputs.push(output);
  }

  static encodeOutputIndex(index) {
    let outputIndex = Buffer.alloc(4);

    outputIndex.writeUInt32LE(index);

    return outputIndex;
  }

  /**
   * Encodes a number of satoshis to be used as part of an output structure in a raw transaction.
   *
   * @param satoshis   integer number of satoshis to send.
   *
   * @returns a buffer with raw bytes holding the encoded number.
   */
  static encodeOutputValue(satoshis) {
    // Check if the provided satoshis is of the correct type.
    if (isNaN(satoshis)) {
      throw `Cannot encode output value, provided satoshis '${satoshis}' is not a number.`;
    }

    // Check if the provided satoshis is an integer.
    if (!Number.isInteger(satoshis)) {
      throw `Cannot encode output value, provided satoshis '${satoshis}' is not an integer.`;
    }

    // Check if the provided satoshis is a positive number.
    if (satoshis < 0) {
      throw `Cannot encode output value, provided satoshis '${satoshis}' is negative.`;
    }

    // Check if the provided satoshis is within our accepted number range.
    if (satoshis > Math.pow(2, 53)) {
      throw `Cannot encode output value, provided satoshis '${satoshis}' is larger than javacripts 53bit limit.`;
    }

    // Allocate 8 bytes.
    let value = Buffer.alloc(8);

    // Split the number into high and low bits.
    let highValue = Math.floor(satoshis / Math.pow(2, 32));
    let lowValue = satoshis % Math.pow(2, 32);

    // Write the satoshi number to the buffer in 64bit.
    value.writeUInt32LE(highValue, 4);
    value.writeUInt32LE(lowValue, 0);

    // Return the encoded value.
    return value;
  }

  /**
   *
   */
  static decodeOutputValue(value) {
    // TODO: Properly validate and error check.

    // Parhse the high and low value sets.
    let highValue = value.readUInt32LE(4);
    let lowValue = value.readUInt32LE(0);

    // Return the decoded value.
    return highValue * Math.pow(2, 32) + lowValue;
  }

  /**
   * Counts the number of outputs for the current contract.
   *
   * @returns the number of outputs as an integer number.
   */
  get countContractOutputs() {
    return this.outputs.length;
  }

  /**
   * Sums up the number of satoshis sent by this contract.
   *
   * @returns the sum of all output values as an integer number of satoshis.
   */
  get totalContractOutputValue() {
    // Initialize an empty counter.
    let totalSatoshis = 0;

    // For each output in this contract..
    for (const currentOutput in this.outputs) {
      totalSatoshis += assuranceContract.decodeOutputValue(
        this.outputs[currentOutput].value
      );
    }

    // Return the total number of satoshis.
    return totalSatoshis;
  }

  /**
   * Sums the currently total committed value in satoshis.
   *
   * @returns the number of satoshis currently committed to this contracts output.
   */
  get totalCommitmentValue() {
    // Initialize an empty counter.
    let totalSatoshis = 0;

    // For each output in this contract..
    for (const currentInput in this.inputs) {
      totalSatoshis += this.inputs[currentInput].value;
    }

    // Return the total number of satoshis.
    return totalSatoshis;
  }

  /**
   * Calculates how many satoshis are missing to reach fully funded status.
   *
   * @returns the number of satoshis required to complete the contract.
   */
  get remainingCommitmentValue() {
    return Math.max(
      0,
      this.totalContractOutputValue - this.totalCommitmentValue
    );
  }

  //
  addCommitment(commitment) {
    // TODO: Validate this first.
    this.inputs.push(commitment);
  }

  validateCommitment() {
    // TODO: Build this feature.
    // const sighashDigest = this.assembleSighashDigest();
    // const signatureStatus = this.validateSignature();
    // Fetch commitment input value.
    // Compare committed value to requested value.
  }

  assembleSighashDigest(
    previousTransactionHash,
    previousTransactionOutputIndex,
    previousTransactionOutputValue,
    inputLockScript
  ) {
    // Initialize an empty array of outpoints.
    let transactionOutpoints = [];

    // For each output in the current contract..
    for (const currentOutput in this.outputs) {
      // Add the output value.
      transactionOutpoints.push(this.outputs[currentOutput].value);

      // Add the output lockscript.
      transactionOutpoints.push(
        bitcoinCashUtilities.varBuf(this.outputs[currentOutput].locking_script)
      );
    }

    const nVersion = Buffer.from("02000000", "hex");
    const hashPrevouts = Buffer.from(
      "0000000000000000000000000000000000000000000000000000000000000000",
      "hex"
    );
    const hashSequence = Buffer.from(
      "0000000000000000000000000000000000000000000000000000000000000000",
      "hex"
    );
    const outpoint = Buffer.concat([
      javascriptUtilities.reverseBuf(previousTransactionHash),
      previousTransactionOutputIndex,
    ]);
    const scriptCode = Buffer.concat([
      Buffer.from("19", "hex"),
      inputLockScript,
    ]);
    const value = previousTransactionOutputValue;
    const nSequence = Buffer.from("FFFFFFFF", "hex");
    const hashOutputs = bitbox.Crypto.hash256(
      Buffer.concat(transactionOutpoints)
    );
    const nLocktime = Buffer.from("00000000", "hex");
    const sighashType = Buffer.from("c1000000", "hex");

    // Debug output.
    // console.log([ nVersion, hashPrevouts, hashSequence, outpoint, scriptCode, value, nSequence, hashOutputs, nLocktime, sighashType ]);

    // TODO: Verify sighash type.
    const sighashMessage = Buffer.concat([
      nVersion,
      hashPrevouts,
      hashSequence,
      outpoint,
      scriptCode,
      value,
      nSequence,
      hashOutputs,
      nLocktime,
      sighashType,
    ]);
    const sighashDigest = bitbox.Crypto.hash256(sighashMessage);

    //
    return sighashDigest;
  }

  /**
   * Assembles all currently known commitments into a transaction.
   *
   * @return a buffer containing the raw transaction.
   */
  assembleTransaction() {
    // Create a buffered version statement.
    const version = Buffer.from("02000000", "hex");

    // Create the input counter and input data buffers.
    const inputCount = bitcoinCashUtilities.varInt(this.inputs.length);
    const inputs = this.serializeCommitments();

    // Create the output counter and output data buffer.
    const outputCount = bitcoinCashUtilities.varInt(
      Object.keys(this.outputs).length
    );
    const outputs = this.serializeOutputs();

    // Create a buffered disable locktime statement.
    const locktime = Buffer.from("00000000", "hex");

    // Return the assembled transaction.
    return Buffer.concat([
      version,
      inputCount,
      inputs,
      outputCount,
      outputs,
      locktime,
    ]);
  }

  serializeOutputs() {
    let outputBuffers = [];

    for (const currentOutput in this.outputs) {
      const output = this.outputs[currentOutput];

      // Create a lockscript length statement.
      const lockscriptLength = bitcoinCashUtilities.varInt(
        output.locking_script.byteLength
      );

      // Return the serialized output.
      outputBuffers.push(
        Buffer.concat([output.value, lockscriptLength, output.locking_script])
      );
    }

    return Buffer.concat(outputBuffers);
  }

  serializeCommitments() {
    let commitmentBuffers = [];

    for (const currentInput in this.inputs) {
      const commitment = this.inputs[currentInput];

      const sequenceNumber = Buffer.alloc(4);
      sequenceNumber.writeUInt32LE(commitment.sequenceNumber);

      const outputIndex = Buffer.alloc(4);
      outputIndex.writeUInt32LE(commitment.previousTransactionOutputIndex);

      commitmentBuffers.push(
        assuranceContract.serializeInput(
          javascriptUtilities.reverseBuf(commitment.previousTransactionHash),
          outputIndex,
          commitment.unlockScript,
          sequenceNumber
        )
      );
    }

    return Buffer.concat(commitmentBuffers);
  }

  serializeCommitment(commitment) {
    //
    const previousTransactionHash = javascriptUtilities.reverseBuf(
      Buffer.from(commitment.previousTransactionHashReversed, "hex")
    );

    //
    let previousTransactionOutputIndex = Buffer.allocUnsafe(4);
    previousTransactionOutputIndex.writeUInt32LE(
      commitment.previousTransactionOutputIndex
    );

    //
    let unlockScript = Buffer.from(commitment.unlockScript, "hex");

    //
    let sequenceNumber = Buffer.from("ffffffff", "hex");

    //
    return this.serializeInput(
      previousTransactionHash,
      previousTransactionOutputIndex,
      unlockScript,
      sequenceNumber
    );
  }

  /**
   * Creates a serialized input part to be used in a raw transaction.
   *
   * @param previousTransactionHash          hash of the transaction we want to spend an output from.
   * @param previousTransactionOutputIndex   index of the previous transactions outputs to spend.
   * @param unlockScript                     unlock script used to make the output spendable.
   * @param sequenceNumber                   relative locktime or 0xFFFFFFFF to disable.
   *
   * @returns a raw serialized input structure as a buffer.
   */
  static serializeInput(
    previousTransactionHash,
    previousTransactionOutputIndex,
    unlockScript,
    sequenceNumber
  ) {
    // Create an unlock script length statement.
    let unlockScriptLength = bitcoinCashUtilities.varInt(
      unlockScript.byteLength
    );

    // return the serialized input structure, as a buffer.
    return Buffer.concat([
      previousTransactionHash,
      previousTransactionOutputIndex,
      unlockScriptLength,
      unlockScript,
      sequenceNumber,
    ]);
  }

  /**
   * Creates a serialized output part to be used in a raw transaction.
   *
   * @param address    the cashaddr encoded recipient of the satoshis.
   * @param satoshis   the number of satoshis to send to the address.
   *
   * @returns a raw serialized output structure as a buffer.
   */
  serializeOutput(address, satoshis) {
    // Check if the provided address is properly encoded.
    if (!bitbox.Address.isCashAddress(address)) {
      // Return false to indicate that we only accept cashaddr encoding.
      return false;
    }

    // Get the lockscript from the address.
    const lockscript = this.getLockscriptFromAddress(address);

    // Declare a storage for the value.
    let value = Buffer.alloc(8);

    // Write the value to to the storage.
    // FIXME: This should be 64-bit, but due to javascript limitations and webpacks buffer implementation we don't have the 64bit function available.
    value.writeUInt32LE(satoshis);

    // Create a lockscript length statement.
    const lockscriptLength = bitcoinCashUtilities.varInt(lockscript.byteLength);

    // Return the serialized output.
    return Buffer.concat([value, lockscriptLength, lockscript]);
  }

  /**
   * Helper function to structure a request object from parts.
   *
   * @param requestSatoshis     integer number of satoshis to commit to the commitment outputs.
   * @param requestExpiration   unix timestamp when the request expires and requested funds should be reclaimed.
   * @param requestOutputs      array of objects containing a `satoshis` integer and cashaddr encoded `address` string.
   * @param requestData         optional object with properties explaining the intent of the request.
   *
   * @returns a structured request object.
   */
  static serializeRequest(
    requestSatoshis,
    requestExpiration,
    requestOutputs,
    requestData = {}
  ) {
    // Assemble the request object.
    let requestObject = {
      outputs: [],
      data: requestData,
      donation: { amount: Number(requestSatoshis) },
      expires: requestExpiration,
    };

    for (const outputIndex in requestOutputs) {
      const outputValue = assuranceContract.decodeOutputValue(
        requestOutputs[outputIndex].value
      );
      const outputAddress = assuranceContract.getAddressFromLockscript(
        requestOutputs[outputIndex].locking_script
      );

      requestObject.outputs.push({
        value: outputValue,
        address: outputAddress,
      });
    }

    // Return the request object.
    return btoa(JSON.stringify(requestObject));
  }

  /**
   * Helper function to reverse request and commitment serialization.
   *
   * @param JsonBase64    an object that has been encoded first in JSON notation, then as base64.
   *
   * @returns the parsed object.
   */
  static unserialize(JsonBase64) {
    // Return the unserialized and parsed json object.
    return JSON.parse(atob(JsonBase64));
  }

  static getAddressFromLockscript(lockscript) {
    return bitbox.Address.fromOutputScript(lockscript);
  }

  getLockscriptFromAddress(address) {
    // Check if the provided address is properly encoded.
    if (!bitbox.Address.isCashAddress(address)) {
      // Return false to indicate that we only accept cashaddr encoding.
      return false;
    }

    // Derive the address hash.
    const hash160 = Buffer.from(bitbox.Address.cashToHash160(address), "hex");

    // Detect address type.
    const type = bitbox.Address.detectAddressType(address);

    // If the type is a public key hash..
    if (type === "p2pkh") {
      // Return a P2PKH lockscript: [opDup, opHash160, pushHash, scriptHash, opEqualVerify, opCheckSig]
      return Buffer.concat([
        Buffer.from("76a914", "hex"),
        hash160,
        Buffer.from("88ac", "hex"),
      ]);
    }
    // If the type is a script hash..
    else if (type === "p2sh") {
      // Return a P2SH lockscript: [opHash160, pushHash, scriptHash, opEqual]
      return Buffer.concat([
        Buffer.from("a914", "hex"),
        hash160,
        Buffer.from("87", "hex"),
      ]);
    } else {
      // Return false to indicate that we only accept P2PKH or P2SH types.
      return false;
    }
  }

  static parseKeyHashUnlockScript(unlockScript) {
    // The signature is the first pushed item, with a varying length depending on signature type.
    const signature = unlockScript.slice(1, -34);

    // The public key is the last pushed item of 33 bytes.
    const publicKey = unlockScript.slice(-33);

    // Return the parsed unlock script.
    return { publicKey: publicKey, signature: signature };
  }
}

module.exports = {
  Storage: assuranceStorage,
  Contract: assuranceContract,
};
