class javascriptUtilities {

  static toHexString(bytes) {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
  }

  /**
   * Reverses a Buffers content
   *
   * @param source   the Buffer to reverse
   *
   * @returns a new Buffer with the contents reversed.
   */
  static reverseBuf(source) {
    // Allocate space for the reversed buffer.
    const reversed = Buffer.allocUnsafe(source.length);

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
    const condition =
      v !== null &&
      typeof v === "object" &&
      "type" in v &&
      v.type === "Buffer" &&
      "data" in v &&
      Array.isArray(v.data);

    // Determine what to return based on condition.
    const result = condition ? new Buffer(v.data) : v;

    // Return the parsed content.
    return result;
  }
}

module.exports = javascriptUtilities;
