export interface GameCard {
  text: string;
}

export const CHANCE_CARDS: GameCard[] = [
  { text: "Advance to GO. Collect $200." },
  { text: "Advance to Illinois Ave. If you pass GO, collect $200." },
  { text: "Advance to St. Charles Place. If you pass GO, collect $200." },
  { text: "Advance to nearest Utility. Pay owner 10× dice roll." },
  { text: "Advance to nearest Railroad. Pay owner double rent." },
  { text: "Bank pays you dividend of $50." },
  { text: "Get Out of Jail Free. Keep this card." },
  { text: "Go Back 3 Spaces." },
  { text: "Go to Jail. Do not pass GO." },
  { text: "Make general repairs: $25 per house, $100 per hotel." },
  { text: "Speeding fine — Pay $15." },
  { text: "Take a trip to Reading Railroad. If you pass GO, collect $200." },
  { text: "You have been elected Chairman of the Board. Pay each player $50." },
  { text: "Your building loan matures. Collect $150." },
  { text: "Bank error in your favor. Collect $200." },
];

export const COMMUNITY_CHEST_CARDS: GameCard[] = [
  { text: "Advance to GO. Collect $200." },
  { text: "Bank error in your favor. Collect $200." },
  { text: "Doctor's fees. Pay $50." },
  { text: "From sale of stock you get $50." },
  { text: "Go to Jail. Go directly to Jail." },
  { text: "Holiday fund matures. Receive $100." },
  { text: "Income tax refund. Collect $20." },
  { text: "It is your birthday. Collect $10 from every player." },
  { text: "Life insurance matures. Collect $100." },
  { text: "Pay hospital fees of $100." },
  { text: "Pay school fees of $50." },
  { text: "Receive $25 consultancy fee." },
  { text: "You are assessed for street repairs: $40 per house, $115 per hotel." },
  { text: "You have won second prize in a beauty contest. Collect $10." },
  { text: "You inherit $100." },
];

export function drawChanceCard(): GameCard {
  return CHANCE_CARDS[Math.floor(Math.random() * CHANCE_CARDS.length)]!;
}

export function drawCommunityChestCard(): GameCard {
  return COMMUNITY_CHEST_CARDS[
    Math.floor(Math.random() * COMMUNITY_CHEST_CARDS.length)
  ]!;
}
