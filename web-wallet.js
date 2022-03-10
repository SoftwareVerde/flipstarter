const libauth = require("@bitauth/libauth");
const createQrCode = require("./src/qrcode.js");

window.libauth = libauth;

class Wallet {
    static async create() {
        const crypto = await libauth.instantiateBIP32Crypto();

        return new Wallet(crypto);
    }

    #_crypto = null;
    #_privateKey = null;

    constructor(crypto) {
        this._crypto = crypto;

        this._privateKey = libauth.generatePrivateKey(function() {
            return window.crypto.getRandomValues(new Uint8Array(32))
        });
    }

    getAddress() {
        const publicKey = this._crypto.secp256k1.derivePublicKeyCompressed(this._privateKey);
        const hash = this._crypto.ripemd160.hash(this._crypto.sha256.hash(publicKey));
        return libauth.encodeCashAddress(libauth.CashAddressNetworkPrefix.mainnet, libauth.CashAddressVersionByte.P2PKH, hash);
    }

    createQrCode(widthPx) {
        const width = widthPx || 82;
        const address = this.getAddress();

        const qr = createQrCode(4, "M");
        qr.addData(address);
        qr.make();
        const html = qr.createImgTag();

        const divElement = document.createElement("div");
        divElement.innerHTML = html;
        const imgElement = divElement.firstChild;

        imgElement.setAttribute("width", width);
        imgElement.setAttribute("height", width);

        return imgElement;
    }
}

window.Wallet = Wallet;
