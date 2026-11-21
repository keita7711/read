/* Port of links.py (STEP 7). The ONLY place the app builds FOMO URLs. */
(function (root) {
  var CHAIN_ID = { solana: 1399811149, robinhood: 4663, base: 8453, bnb: 56 };
  var SIGNUP_URL = "https://fomo.family/r/savipww";
  function coinUrl(address, chain) {
    chain = chain === undefined ? "solana" : chain;
    if (!Object.prototype.hasOwnProperty.call(CHAIN_ID, chain)) {
      if (root.console) console.warn("unknown chain " + JSON.stringify(chain) + ", returning SIGNUP_URL");
      return SIGNUP_URL;
    }
    return "https://fomo.family/coin?address=" + address + "&chainId=" + CHAIN_ID[chain] + "&r=savipww&source=share_link";
  }
  function profileUrl(handle) {
    var h = String(handle).replace(/^@+/, "");
    return "https://fomo.family/profile/" + h + "?source=share_link&r=savipww";
  }
  var api = { CHAIN_ID: CHAIN_ID, SIGNUP_URL: SIGNUP_URL, coinUrl: coinUrl, profileUrl: profileUrl };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.Links = api;
})(typeof window !== "undefined" ? window : globalThis);
