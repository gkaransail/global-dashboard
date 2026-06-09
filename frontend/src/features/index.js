// Frontend feature registry — mirrors backend manifests.
// status: 'live' | 'coming_soon'
export const FEATURES = [
  {
    id: 'dashboard',
    label: 'Top 10 Dashboard',
    icon: '🏆',
    status: 'live',
    description: 'Top 10 bullish & bearish stocks with predicted prices',
    subOptions: [
      { id: 'top10',       label: 'Top 10 Stocks',  icon: '🏆', path: '/dashboard/top10' },
      { id: 'methodology', label: 'Methodology',    icon: '📐', path: '/dashboard/methodology' },
    ],
  },
  {
    id: 'reversal',
    label: 'Trend Reversal',
    icon: '🔄',
    status: 'live',
    description: 'Multi-factor reversal signals',
    subOptions: [
      { id: 'analyze',   label: 'Single Stock',   icon: '🔍', path: '/reversal/analyze' },
      { id: 'sectors',   label: 'Sector Scan',    icon: '🗂',  path: '/reversal/sectors' },
      { id: 'watchlist', label: 'Watchlist',      icon: '📋', path: '/reversal/watchlist' },
      { id: 'macro',     label: 'Macro View',     icon: '🌍', path: '/reversal/macro' },
    ],
  },
  {
    id: 'options',
    label: 'Options Analysis',
    icon: '⚡',
    status: 'live',
    description: 'Live chain, Greeks, unusual activity, IV skew & term structure',
    subOptions: [
      { id: 'chain',   label: 'Options Chain',            icon: '⛓', path: '/options/chain' },
      { id: 'unusual', label: 'Unusual Activity',         icon: '🚨', path: '/options/unusual' },
      { id: 'skew',    label: 'IV Skew & Term Structure', icon: '📐', path: '/options/skew' },
    ],
  },
  {
    id: 'insider',
    label: 'Insider Trading',
    icon: '👔',
    status: 'live',
    description: 'SEC insider transactions with high-weight scoring',
    subOptions: [
      { id: 'transactions', label: 'Transactions',     icon: '📰', path: '/insider/transactions' },
      { id: 'sentiment',    label: 'Insider Sentiment',icon: '🎯', path: '/insider/sentiment' },
      { id: 'signals',      label: 'Buy/Sell Signals', icon: '🚦', path: '/insider/signals' },
    ],
  },
  {
    id: 'smart_money',
    label: 'Smart Money',
    icon: '🏦',
    status: 'live',
    description: 'Institutional flows and hedge fund positioning',
    subOptions: [
      { id: 'institutional', label: 'Institutional',        icon: '🏦', path: '/smart_money/institutional' },
      { id: 'signals',       label: 'Smart Money Signals',  icon: '🌊', path: '/smart_money/signals' },
    ],
  },
  {
    id: 'technical',
    label: 'Technical Analysis',
    icon: '📈',
    status: 'live',
    description: 'Advanced indicators, patterns, and price targets',
    subOptions: [
      { id: 'indicators', label: 'Indicators',     icon: '📉', path: '/technical/indicators' },
      { id: 'patterns',   label: 'Chart Patterns', icon: '📐', path: '/technical/patterns' },
      { id: 'targets',    label: 'Price Targets',  icon: '🎯', path: '/technical/targets' },
    ],
  },
  {
    id: 'fundamental',
    label: 'Fundamental Analysis',
    icon: '📊',
    status: 'live',
    description: 'Valuation, earnings quality, and financial health',
    subOptions: [
      { id: 'overview',   label: 'Overview',         icon: '🏢', path: '/fundamental/overview' },
      { id: 'valuation',  label: 'Valuation',        icon: '💲', path: '/fundamental/valuation' },
      { id: 'health',     label: 'Financial Health', icon: '❤️', path: '/fundamental/health' },
    ],
  },
  {
    id: 'sentiment',
    label: 'Market Sentiment',
    icon: '🧠',
    status: 'live',
    description: 'News sentiment, analyst ratings, social buzz',
    subOptions: [
      { id: 'news',      label: 'News Sentiment',    icon: '📰', path: '/sentiment/news' },
      { id: 'analysts',  label: 'Analyst Ratings',   icon: '⭐', path: '/sentiment/analysts' },
      { id: 'overview',  label: 'Sentiment Overview',icon: '💬', path: '/sentiment/overview' },
    ],
  },
]
