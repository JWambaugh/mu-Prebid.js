import * as utils from '../src/utils.js';
import { config } from '../src/config.js';
import { registerBidder } from '../src/adapters/bidderFactory.js';
const BIDDER_CODE = 'underdogmedia';
const UDM_ADAPTER_VERSION = '3.5V';
const UDM_VENDOR_ID = '159';
const prebidVersion = '$prebid.version$';
let USER_SYNCED = false;

utils.logMessage(`Initializing UDM Adapter. PBJS Version: ${prebidVersion} with adapter version: ${UDM_ADAPTER_VERSION}  Updated 20191028`);

// helper function for testing user syncs
export function resetUserSync() {
  USER_SYNCED = false;
}

export const spec = {
  code: BIDDER_CODE,
  bidParams: [],

  isBidRequestValid: function (bid) {
    const bidSizes = bid.mediaTypes && bid.mediaTypes.banner && bid.mediaTypes.banner.sizes ? bid.mediaTypes.banner.sizes : bid.sizes;
    return !!((bid.params && bid.params.siteId) && (bidSizes && bidSizes.length > 0));
  },

  buildRequests: function (validBidRequests, bidderRequest) {
    var sizes = [];
    var siteId = 0;

    validBidRequests.forEach(bidParam => {
      let bidParamSizes = bidParam.mediaTypes && bidParam.mediaTypes.banner && bidParam.mediaTypes.banner.sizes ? bidParam.mediaTypes.banner.sizes : bidParam.sizes;
      sizes = utils.flatten(sizes, utils.parseSizesInput(bidParamSizes));
      siteId = bidParam.params.siteId;
    });

    let data = {
      tid: 1,
      dt: 10,
      sid: siteId,
      sizes: sizes.join(','),
      version: UDM_ADAPTER_VERSION
    }
    if (bidderRequest && bidderRequest.gdprConsent) {
      if (typeof bidderRequest.gdprConsent.gdprApplies !== 'undefined') {
        gdpr.gdprApplies = !!(bidderRequest.gdprConsent.gdprApplies);
      }
      if (bidderRequest.gdprConsent.vendorData && bidderRequest.gdprConsent.vendorData.vendorConsents &&
        typeof bidderRequest.gdprConsent.vendorData.vendorConsents[UDM_VENDOR_ID] !== 'undefined') {
        gdpr.consentGiven = !!(bidderRequest.gdprConsent.vendorData.vendorConsents[UDM_VENDOR_ID]);
      }
      if (typeof bidderRequest.gdprConsent.consentString !== 'undefined') {
        gdpr.consentData = bidderRequest.gdprConsent.consentString;
      }
    }

    if (bidderRequest.uspConsent) {
      data.uspConsent = bidderRequest.uspConsent;
    }

    if (!data.gdprApplies || data.consentGiven) {
      return {
        method: 'GET',
        url: 'https://udmserve.net/udm/img.fetch',
        data: data,
        bidParams: validBidRequests
      };
    }
  },

  getUserSyncs: function (syncOptions, serverResponses) {
    if (!USER_SYNCED && serverResponses.length > 0 && serverResponses[0].body && serverResponses[0].body.userSyncs && serverResponses[0].body.userSyncs.length > 0) {
      USER_SYNCED = true;
      const userSyncs = serverResponses[0].body.userSyncs;
      const syncs = userSyncs.filter(sync => {
        const {type} = sync;
        if (syncOptions.iframeEnabled && type === 'iframe') {
          return true
        }
        if (syncOptions.pixelEnabled && type === 'image') {
          return true
        }
      })
      return syncs;
    }
  },

  interpretResponse: function (serverResponse, bidRequest) {
    const bidResponses = [];
    bidRequest.bidParams.forEach(bidParam => {
      serverResponse.body.mids.forEach(mid => {
        if (mid.useCount > 0) {
          return;
        }

        if (!mid.useCount) {
          mid.useCount = 0;
        }

        var sizeNotFound = true;
        const bidParamSizes = bidParam.mediaTypes && bidParam.mediaTypes.banner && bidParam.mediaTypes.banner.sizes ? bidParam.mediaTypes.banner.sizes : bidParam.sizes
        utils.parseSizesInput(bidParamSizes).forEach(size => {
          if (size === mid.width + 'x' + mid.height) {
            sizeNotFound = false;
          }
        });
      } else {
        bid(bidderRequest);
      }
    } else {
      let sid = bidderRequest.bids[0].params.siteId;
      adloader.loadScript(`https://udmserve.net/udm/img.fetch?tid=1;dt=9;sid=${sid};gdprApplies=${gdpr.gdprApplies};consentGiven=${gdpr.consentGiven};uspConsent=${bidderRequest.uspConsent};`, function () {
        utils.logWarn('UDM Request Cancelled - No GDPR Consent');
        _done();
      })
    }
  }

  function bid(bidderRequest) {
    responsesProcessed[bidderRequest.auctionId] = 0;
    let bids = bidderRequest.bids;
    let mappedBids = [];
    for (let i = 0; i < bids.length; i++) {
      let bidRequest = bids[i];
      let callback = bidResponseCallback(bidRequest, bids.length);
      mappedBids.push({
        auctionId: bidRequest.auctionId,
        auctionStart: bidderRequest.auctionStart,
        auctionTimeout: bidderRequest.timeout,
        bidder: bidRequest.bidder,
        sizes: bidRequest.sizes,
        siteId: bidRequest.params.siteId,
        bidfloor: bidRequest.params.bidfloor,
        adunitcode: bidRequest.adUnitCode,
        placementCode: bidRequest.adUnitCode,
        divId: bidRequest.params.divId,
        subId: bidRequest.params.subId,
        callback: callback,
        uspConsent: bidderRequest.uspConsent
      });
    }
    let udmBidRequest = new window.udm_header_lib.BidRequestArray(mappedBids);
    udmBidRequest.send();
  }

        const bidResponse = {
          requestId: bidParam.bidId,
          bidderCode: spec.code,
          cpm: parseFloat(mid.cpm),
          width: mid.width,
          height: mid.height,
          ad: mid.ad_code_html,
          creativeId: mid.mid,
          currency: 'USD',
          netRevenue: false,
          ttl: mid.ttl || 60,
        };

  function bidResponseAvailable(bidRequest, bidResponse, bids) {
    if (bidResponse.bids.length > 0) {
      for (let i = 0; i < bidResponse.bids.length; i++) {
        let udmBid = bidResponse.bids[i];
        let bid = bidfactory.createBid(1, bidRequest);
        if (udmBid.udmDebug) {
          bid.udmDebug = udmBid.udmDebug;
        }
        bid.requestId = bidRequest.bidId;
        bid.cpm = udmBid.cpm;
        bid.width = udmBid.width;
        bid.height = udmBid.height;
        bid.ttl = 60;
        bid.netRevenue = false;
        bid.currency = 'USD';
        bid.bidderCode = bidRequest.bidder;
        bid.auctionId = bidRequest.auctionId;
        bid.adUnitCode = bidRequest.adUnitCode;
        bid.trueBidder = udmBid.bidderCode;
        bid.creativeId = udmBid.creativeId;

        if (udmBid.ad_url !== undefined) {
          bid.adUrl = udmBid.ad_url;
        } else if (udmBid.ad_html !== undefined) {
          bid.ad = udmBid.ad_html.replace('UDM_ADAPTER_VERSION', UDM_ADAPTER_VERSION);
        } else {
          utils.logMessage('Underdogmedia bid is lacking both ad_url and ad_html, skipping bid');
          continue;
        }

        mid.useCount++;

        bidResponse.ad += makeNotification(bidResponse, mid, bidParam);

        bidResponses.push(bidResponse);
      });
    });

    return bidResponses;
  },
};

function makeNotification(bid, mid, bidParam) {
  let url = mid.notification_url;

  const versionIndex = url.indexOf(';version=')
  if (versionIndex + 1) {
    url = url.substring(0, versionIndex)
  }

  url += `;version=${UDM_ADAPTER_VERSION}`;
  url += ';cb=' + Math.random();
  url += ';qqq=' + (1 / bid.cpm);
  url += ';hbt=' + config.getConfig('_bidderTimeout');
  url += ';style=adapter';
  url += ';vis=' + encodeURIComponent(document.visibilityState);

  url += ';traffic_info=' + encodeURIComponent(JSON.stringify(getUrlVars()));
  if (bidParam.params.subId) {
    url += ';subid=' + encodeURIComponent(bidParam.params.subId);
  }

  function getSpec() {
    return {
      onBidWon: (bid) => {
        utils.logMessage('Underdog Media onBidWon Event', bid);
      },
      onSetTargeting: (bid) => {
        utils.logMessage('Underdog Media onSetTargeting Event', bid);
      }
    }
  }

  return {
    callBids: _callBids,
    getSpec: getSpec
  };
};
let registerBidAdapter = adapterManager.default.registerBidAdapter;
registerBidAdapter(new UnderdogMediaAdapter(), 'underdogmedia');
module.exports = UnderdogMediaAdapter;
