// import libauth
const {
  cashAddressToLockingBytecode,
  lockingBytecodeToAddressContents,
  lockingBytecodeToCashAddress,
  binToHex,
  decodeCashAddress,
  instantiateSha256,
  instantiateSecp256k1,
  CashAddressType,
} = require("@bitauth/libauth");

const WebAssembly = {};

module.exports = {
  async init() {
    WebAssembly.sha256 = (await instantiateSha256()).hash;
    WebAssembly.secp256k1 = await instantiateSecp256k1();
  },

  Crypto: {
    // bitbox.Crypto.sha256()
    sha256(buffer) {
      return WebAssembly.sha256(buffer);
    },

    // bitbox.Crypto.hash256()
    hash256(buffer) {
      return WebAssembly.sha256(WebAssembly.sha256(buffer));
    },
  },
  Address: {
    // bitbox.Address.cashToHash160()
    cashToHash160(address) {
      const result = cashAddressToLockingBytecode(address);

      if (typeof result === "string") {
        process.exit();
      }

      const contents = lockingBytecodeToAddressContents(result.bytecode);

      if (typeof contents === "string") {
        process.exit();
      }

      return binToHex(contents.payload);
    },

    // bitbox.Address.isCashAddress()
    isCashAddress(address) {
      // If return error msg will be throw
      return typeof decodeCashAddress(address) !== "string";
    },

    // bitbox.Address.detectAddressType()
    detectAddressType(address) {
      const decodedAddress = decodeCashAddress(address);

      // If return error msg will be throw
      if(typeof decodedAddress === "string") throw new Error(decodedAddress);

      return CashAddressType[
        decodedAddress.type
      ].toLocaleLowerCase();
    },

    // bitbox.Address.fromOutputScript()
    fromOutputScript(scriptPubKey, network = "mainnet") {
      let prefix = "bitcoincash";
      if (network !== "bitcoincash" && network !== "mainnet") {
        prefix = "bchtest";
      }
      return lockingBytecodeToCashAddress(scriptPubKey, prefix);
    },
  },
  Signature: {
    verifyDER(signature, publicKey, message) {
      return WebAssembly.secp256k1.verifySignatureDER(
        signature,
        publicKey,
        message
      );
    },
  },
};
