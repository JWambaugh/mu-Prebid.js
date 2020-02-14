import adapter from '../src/AnalyticsAdapter'
import adapterManager from '../src/adapterManager'
import { logMessage } from '../src/utils'

const auctions = {}
const adUnitAuctions = {}
let floors = null
let floorKey = 'android'

const trackRevenue = revenue => {
  window.fbq('track', 'Purchase', { currency: 'USD', value: revenue })

  // track step with revenue
  const stepRegex = /step([0-9]+)/gm
  const match = stepRegex.exec(window.location.href)
  logMessage('loging revenue with step', { step: match[1], value: revenue })
  window.fbq('trackCustom', 'mu_opps', { step: match[1], value: revenue })
}

const auctionOver = (auction, googleEvent) => {
  logMessage('mu_analytics: Auction completed', auction, googleEvent)
  const bidsSorted = auction.bidsReceived.sort((a, b) => b.cpm - a.cpm)
  const floor = floors[floorKey][auction.adUnits[0].adunit]
  logMessage('floors: ', floorKey, floor)

  // no new ad
  if (googleEvent.isEmpty) {
    logMessage(
      `mu_analytics: auction ended with empty ad.`,
      auction,
      googleEvent
    )
    trackRevenue(0.0)
    return
  }

  if (auction.winningBids.length > 0) {
    const winningBid = auction.winningBids[0]
    const revenue = winningBid.cpm
    logMessage(
      `mu_analytics: Winning bid found. Reporting revenue of $${revenue}`,
      bidsSorted
    )
    trackRevenue(revenue)
  } else {
    // prebid didn't win, estimate CPM earned with highest bid plus 1 cent
    if (bidsSorted.length > 0) {
      const revenue = bidsSorted[0].cpm + 0.01
      logMessage(
        `mu_analytics: No winning bid found. Using highest bid. Reporting revenue of ${revenue}`,
        bidsSorted
      )
      trackRevenue(revenue)
    } else {
      const revenue = floor
      logMessage(
        `mu_analytics: No bids found. Estimating Google floor of ${floor} cpm for revenue of ${revenue} `,
        bidsSorted
      )
      trackRevenue(revenue)
    }
  }
}

const handlers = {
  auctionInit: args => {
    logMessage('mu_analytics: auctionInit', args)
    auctions[args.auctionId] = args
  },
  auctionEnd: args => {
    logMessage('mu_analytics: auctionEnd', args)
    const oldAuction = auctions[args.auctionId]
    const auction = { ...oldAuction, ...args }
    auctions[args.auctionId] = auction
    adUnitAuctions[args.adUnitCodes[0]] = auction
  },
  bidWon: args => {
    const auction = auctions[args.auctionId]
    auction.winningBids.push(args)
    logMessage('mu_analytics: bidWon', args, auction)
  },
}

var mamasUncut = Object.assign(adapter({}), {
  track({ eventType, args }) {
    if (handlers[eventType]) {
      handlers[eventType](args)
    }
  },
})

// save the base class function
mamasUncut.originEnableAnalytics = mamasUncut.enableAnalytics

// override enableAnalytics so we can get access to the config passed in from the page
mamasUncut.enableAnalytics = config => {
  floors = config.options.floors
  floorKey =
    config.options.device === 'desktop' ? 'desktop' : config.options.mobileOs
  logMessage('MamasUncut analytics initializing', config, floorKey)
  window.googletag = window.googletag || { cmd: [] }
  window.googletag.cmd.push(() =>
    window.googletag.pubads().addEventListener('slotRenderEnded', e => {
      logMessage(
        'got slot render ended',
        e,
        e.slot.getSlotId().getId(),
        e.slot.getAdUnitPath(),
        e.slot.getSlotElementId()
      )
      auctionOver(adUnitAuctions[e.slot.getSlotElementId()], e)
    })
  )

  mamasUncut.originEnableAnalytics(config) // call the base class function
}
logMessage('adapter:', mamasUncut)
adapterManager.registerAnalyticsAdapter({
  adapter: mamasUncut,
  code: 'mamasuncut',
})

export default mamasUncut
