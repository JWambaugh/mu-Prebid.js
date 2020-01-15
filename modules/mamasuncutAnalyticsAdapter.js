import adapter from '../src/AnalyticsAdapter'
import adapterManager from '../src/adapterManager'

const auctions = {}
const adUnitAuctions = {}

const trackRevenue = revenue => {
  window.fbq('track', 'Purchase', { currency: 'USD', value: revenue })
}

const auctionOver = (auction, googleEvent) => {
  console.log('mu_analytics: Auction completed', auction, googleEvent)
  const bidsSorted = auction.bidsReceived.sort((a, b) => b.cpm - a.cpm)

  // no new ad
  if (googleEvent.isEmpty) {
    console.log(
      `mu_analytics: auction ended with empty ad.`,
      auction,
      googleEvent
    )
    trackRevenue(0.0)
    return
  }

  if (auction.winningBids.length > 0) {
    const winningBid = auction.winningBids[0]
    const revenue = winningBid.cpm / 1000
    console.log(
      `mu_analytics: Winning bid found. Reporting revenue of $${revenue}`,
      bidsSorted
    )
    trackRevenue(revenue)
  } else {
    // prebid didn't win, estimate CPM earned with highest bid plus 1 cent
    if (bidsSorted.length > 0) {
      const revenue = (bidsSorted[0].cpm + 0.01) / 1000
      console.log(
        `mu_analytics: No winning bid found. Using highest bid. Reporting revenue of ${revenue}`,
        bidsSorted
      )
      trackRevenue(revenue)
    }
  }
}

const handlers = {
  auctionInit: args => {
    console.log('mu_analytics: auctionInit', args)
    auctions[args.auctionId] = args
  },
  auctionEnd: args => {
    console.log('mu_analytics: auctionEnd', args)
    const oldAuction = auctions[args.auctionId]
    const auction = { ...oldAuction, ...args }
    auctions[args.auctionId] = auction
    adUnitAuctions[args.adUnitCodes[0]] = auction
  },
  bidWon: args => {
    const auction = auctions[args.auctionId]
    auction.winningBids.push(args)
    console.log('mu_analytics: bidWon', args, auction)
  },
}
window.googletag.cmd.push(() =>
  window.googletag.pubads().addEventListener('slotRenderEnded', e => {
    console.log(
      'got slot render ended',
      e,
      e.slot.getSlotId().getId(),
      e.slot.getAdUnitPath(),
      e.slot.getSlotElementId()
    )
    auctionOver(adUnitAuctions[e.slot.getSlotElementId()], e)
  })
)

var mamasUncutAdapter = Object.assign(adapter({}), {
  track({ eventType, args }) {
    if (handlers[eventType]) {
      handlers[eventType](args)
    }
  },
})

adapterManager.registerAnalyticsAdapter({
  adapter: mamasUncutAdapter,
  code: 'mamasuncut',
})

export default mamasUncutAdapter
