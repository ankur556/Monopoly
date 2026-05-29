export type CardEffect =
  | { type: "collect"; amount: number }
  | { type: "pay"; amount: number }
  | { type: "move"; destination: number; collectGoIfPassed?: boolean }
  | { type: "move-back"; spaces: number }
  | { type: "jail" }
  | { type: "get-out-of-jail" }
  | { type: "repairs"; houseCost: number; hotelCost: number }
  | { type: "pay-each-player"; amount: number }
  | { type: "collect-from-each-player"; amount: number }
  | { type: "none" };

export interface GameCard {
  text: string;
  effect: CardEffect;
}

export const CHANCE_CARDS: GameCard[] = [
  {
    text: "Advance to GO. Collect $200.",
    effect: { type: "move", destination: 0, collectGoIfPassed: true },
  },
  {
    text: "Advance to Illinois Ave. If you pass GO, collect $200.",
    effect: { type: "move", destination: 24, collectGoIfPassed: true },
  },
  {
    text: "Advance to St. Charles Place. If you pass GO, collect $200.",
    effect: { type: "move", destination: 11, collectGoIfPassed: true },
  },
  {
    text: "Advance to nearest Utility. Pay owner 10× dice roll.",
    effect: { type: "none" },
  },
  {
    text: "Advance to nearest Railroad. Pay owner double rent.",
    effect: { type: "none" },
  },
  {
    text: "Bank pays you dividend of $50.",
    effect: { type: "collect", amount: 50 },
  },
  {
    text: "Get Out of Jail Free. Keep this card.",
    effect: { type: "get-out-of-jail" },
  },
  {
    text: "Go Back 3 Spaces.",
    effect: { type: "move-back", spaces: 3 },
  },
  {
    text: "Go to Jail. Do not pass GO.",
    effect: { type: "jail" },
  },
  {
    text: "Make general repairs: $25 per house, $100 per hotel.",
    effect: { type: "repairs", houseCost: 25, hotelCost: 100 },
  },
  {
    text: "Speeding fine — Pay $15.",
    effect: { type: "pay", amount: 15 },
  },
  {
    text: "Take a trip to Reading Railroad. If you pass GO, collect $200.",
    effect: { type: "move", destination: 5, collectGoIfPassed: true },
  },
  {
    text: "You have been elected Chairman of the Board. Pay each player $50.",
    effect: { type: "pay-each-player", amount: 50 },
  },
  {
    text: "Your building loan matures. Collect $150.",
    effect: { type: "collect", amount: 150 },
  },
  {
    text: "Bank error in your favor. Collect $200.",
    effect: { type: "collect", amount: 200 },
  },
];

export const COMMUNITY_CHEST_CARDS: GameCard[] = [
  {
    text: "Advance to GO. Collect $200.",
    effect: { type: "move", destination: 0, collectGoIfPassed: true },
  },
  {
    text: "Bank error in your favor. Collect $200.",
    effect: { type: "collect", amount: 200 },
  },
  {
    text: "Doctor's fees. Pay $50.",
    effect: { type: "pay", amount: 50 },
  },
  {
    text: "From sale of stock you get $50.",
    effect: { type: "collect", amount: 50 },
  },
  {
    text: "Go to Jail. Go directly to Jail.",
    effect: { type: "jail" },
  },
  {
    text: "Holiday fund matures. Receive $100.",
    effect: { type: "collect", amount: 100 },
  },
  {
    text: "Income tax refund. Collect $20.",
    effect: { type: "collect", amount: 20 },
  },
  {
    text: "It is your birthday. Collect $10 from every player.",
    effect: { type: "collect-from-each-player", amount: 10 },
  },
  {
    text: "Life insurance matures. Collect $100.",
    effect: { type: "collect", amount: 100 },
  },
  {
    text: "Pay hospital fees of $100.",
    effect: { type: "pay", amount: 100 },
  },
  {
    text: "Pay school fees of $50.",
    effect: { type: "pay", amount: 50 },
  },
  {
    text: "Receive $25 consultancy fee.",
    effect: { type: "collect", amount: 25 },
  },
  {
    text: "You are assessed for street repairs: $40 per house, $115 per hotel.",
    effect: { type: "repairs", houseCost: 40, hotelCost: 115 },
  },
  {
    text: "You have won second prize in a beauty contest. Collect $10.",
    effect: { type: "collect", amount: 10 },
  },
  {
    text: "You inherit $100.",
    effect: { type: "collect", amount: 100 },
  },
];

export function drawChanceCard(): GameCard {
  return CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)]!;
}

export function drawCommunityChestCard(): GameCard {
  return COMMUNITY_CHEST_CARDS[
    Math.floor(Math.random() * COMMUNITY_CHEST_CARDS.length)
  ]!;
}
