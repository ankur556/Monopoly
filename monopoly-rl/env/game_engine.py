"""Complete Monopoly game engine with full rules implementation."""
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, Dict, List, Tuple, Set
import random
import copy

from .board import BOARD, Square, COLOR_GROUPS


class Phase(str, Enum):
    PRE_ROLL = 'PRE_ROLL'
    BUY = 'BUY'
    AUCTION = 'AUCTION'
    POST_ROLL = 'POST_ROLL'
    TRADE_RESPONSE = 'TRADE_RESPONSE'
    GAME_OVER = 'GAME_OVER'


# ── Action IDs ────────────────────────────────────────────────────────────────
ROLL = 0            # PRE_ROLL: roll dice
END_TURN = 1        # POST_ROLL: end turn
BUY_PROP = 2        # BUY: buy property
DECLINE = 3         # BUY: decline (triggers auction)
PAY_JAIL = 4        # PRE_ROLL jail: pay $50 fine
USE_GOOJF = 5       # PRE_ROLL jail: use get-out-of-jail-free card
ROLL_JAIL = 6       # PRE_ROLL jail: roll for doubles
AUCTION_PASS = 7    # AUCTION: pass
AUCTION_BID_MIN = 8     # AUCTION: bid minimum ($1 above current)
AUCTION_BID_LOW = 9     # AUCTION: bid 15% of balance
AUCTION_BID_MED = 10    # AUCTION: bid 30% of balance
AUCTION_BID_HIGH = 11   # AUCTION: bid 60% of balance
AUCTION_BID_ALL = 12    # AUCTION: bid entire balance
# BUILD_BASE + position = buy house at position (positions 0-39 mapped to actions 13-52)
BUILD_BASE = 13
OFFER_TRADE_BASE = 53
ACCEPT_TRADE = 93
REJECT_TRADE = 94
N_ACTIONS = 95


# ── Data classes ──────────────────────────────────────────────────────────────

@dataclass
class PlayerState:
    idx: int
    name: str
    balance: int = 1500
    position: int = 0
    in_jail: bool = False
    jail_turns: int = 0
    goojf_cards: int = 0
    is_bankrupt: bool = False
    doubles_count: int = 0


@dataclass
class SquareOwnership:
    owner: Optional[int] = None   # player idx or None
    houses: int = 0               # 0-4 houses, 5 = hotel
    mortgaged: bool = False


# ── Chance / Community Chest card definitions ─────────────────────────────────

CHANCE_CARDS = [
    'advance_go',          # Advance to Go (collect $200)
    'go_to_jail',          # Go to Jail
    'go_back_3',           # Go back 3 spaces
    'pay_15',              # Pay fine of $15
    'nearest_railroad_1',  # Advance to nearest railroad (first instance)
    'nearest_railroad_2',  # Advance to nearest railroad (second instance)
    'nearest_utility',     # Advance to nearest utility
    'bank_dividend_50',    # Bank pays dividend of $50
    'goojf',               # Get out of jail free card
    'street_repairs',      # Street repairs: $40/house, $115/hotel
    'advance_illinois',    # Advance to Illinois Avenue
    'advance_st_charles',  # Advance to St. Charles Place
    'advance_boardwalk',   # Advance to Boardwalk
    'advance_reading_rr',  # Advance to Reading Railroad
    'chairman_board',      # Elected chairman: pay $50 to each player
    'loan_matures',        # Loan matures: receive $150
]

CHEST_CARDS = [
    'advance_go',          # Advance to Go
    'bank_error_200',      # Bank error in your favor: collect $200
    'doctor_fee_50',       # Doctor fee: pay $50
    'go_to_jail',          # Go to Jail
    'goojf',               # Get out of jail free
    'birthday_10',         # Birthday: collect $10 from each player
    'grand_opera_50',      # Grand Opera Night: collect $50 from each player
    'holiday_fund_100',    # Holiday fund matures: receive $100
    'income_tax_refund_20',# Income tax refund: collect $20
    'hospital_100',        # Hospital fees: pay $100
    'school_fees_150',     # School fees: pay $150
    'consultancy_25',      # Consultancy fee: collect $25
    'beauty_contest_10',   # Second prize beauty contest: collect $10
    'inherit_100',         # You inherit $100
    'life_insurance_100',  # Life insurance matures: collect $100
    'street_repairs_cc',   # Street repairs: $40/house, $115/hotel
]


# ── Engine ────────────────────────────────────────────────────────────────────

class MonopolyEngine:
    """Full Monopoly game engine for reinforcement learning."""

    def __init__(self, n_players: int = 4, seed: Optional[int] = None):
        self.n_players = min(max(n_players, 2), 6)
        self.rng = random.Random(seed)
        self._base_seed = seed

        # Initialised by reset()
        self.players: List[PlayerState] = []
        self.ownership: Dict[int, SquareOwnership] = {}
        self.current_player: int = 0
        self.phase: Phase = Phase.PRE_ROLL
        self.last_roll: Tuple[int, int] = (0, 0)
        self.pending_property: Optional[int] = None  # position of property to buy/auction
        self.pending_trade: Optional[dict] = None
        self.completed_monopolies: set = set()
        self.turn_number: int = 0

        # Auction state
        self.auction_property: Optional[int] = None
        self.auction_current_bid: int = 0
        self.auction_highest_bidder: Optional[int] = None
        self.auction_participants: List[int] = []   # players still in auction
        self.auction_bidder_idx: int = 0            # index into auction_participants

        # Card decks (shuffled lists, pop from end)
        self._chance_deck: List[str] = []
        self._chest_deck: List[str] = []

        self.reset()

    # ── Public API ─────────────────────────────────────────────────────────────

    def reset(self) -> dict:
        """Reset game to initial state and return state dict."""
        self.rng = random.Random(self._base_seed)
        self.players = [
            PlayerState(idx=i, name=f'Player {i + 1}')
            for i in range(self.n_players)
        ]
        self.ownership = {i: SquareOwnership() for i in range(40)}
        self.current_player = 0
        self.phase = Phase.PRE_ROLL
        self.last_roll = (0, 0)
        self.pending_property = None
        self.pending_trade = None
        self.trade_offers_made = 0
        self.completed_monopolies = set()
        self.turn_number = 0

        # Clear auction state
        self.auction_property = None
        self.auction_current_bid = 0
        self.auction_highest_bidder = None
        self.auction_participants = []
        self.auction_bidder_idx = 0

        # Shuffle card decks
        self._chance_deck = self.rng.sample(CHANCE_CARDS, len(CHANCE_CARDS))
        self._chest_deck = self.rng.sample(CHEST_CARDS, len(CHEST_CARDS))

        return self.state_dict()

    def get_legal_actions(self) -> List[int]:
        """Return list of legal action IDs for the current player."""
        if self.phase == Phase.GAME_OVER:
            return []

        player = self.players[self.current_player]
        legal: List[int] = []

        if self.phase == Phase.PRE_ROLL:
            if player.in_jail:
                # Jail options
                if player.balance >= 50:
                    legal.append(PAY_JAIL)
                if player.goojf_cards > 0:
                    legal.append(USE_GOOJF)
                legal.append(ROLL_JAIL)   # always available (roll for doubles)
            else:
                legal.append(ROLL)

        elif self.phase == Phase.BUY:
            sq = BOARD[self.pending_property]
            if player.balance >= sq.price:
                legal.append(BUY_PROP)
            legal.append(DECLINE)  # always may decline

        elif self.phase == Phase.AUCTION:
            legal.append(AUCTION_PASS)
            # Bidding options — only if player has money and can outbid
            bidder = self.players[self.auction_participants[self.auction_bidder_idx]]
            min_bid = self.auction_current_bid + 1
            if bidder.balance >= min_bid:
                legal.append(AUCTION_BID_MIN)
            low = max(min_bid, int(bidder.balance * 0.15))
            if bidder.balance >= low and AUCTION_BID_LOW not in legal:
                legal.append(AUCTION_BID_LOW)
            med = max(min_bid, int(bidder.balance * 0.30))
            if bidder.balance >= med and AUCTION_BID_MED not in legal:
                legal.append(AUCTION_BID_MED)
            high = max(min_bid, int(bidder.balance * 0.60))
            if bidder.balance >= high and AUCTION_BID_HIGH not in legal:
                legal.append(AUCTION_BID_HIGH)
            if bidder.balance >= min_bid and AUCTION_BID_ALL not in legal:
                legal.append(AUCTION_BID_ALL)

        elif self.phase == Phase.TRADE_RESPONSE:
            legal.extend([ACCEPT_TRADE, REJECT_TRADE])

        elif self.phase == Phase.POST_ROLL:
            legal.append(END_TURN)
            # Building houses: scan all properties player owns with monopoly
            for color, positions in COLOR_GROUPS.items():
                if color in ('railroad', 'utility'):
                    continue
                if not self._has_monopoly(self.current_player, color):
                    continue
                # Check even build rule and max houses
                houses = [self.ownership[p].houses for p in positions]
                min_h = min(houses)
                max_h = max(houses)
                for pos in positions:
                    own = self.ownership[pos]
                    sq = BOARD[pos]
                    # Can build if: not mortgaged, less than max in group, not already hotel
                    if own.mortgaged or own.houses >= 5:
                        continue
                    # Even build: can only build on squares with min_h houses
                    if own.houses > min_h:
                        continue
                    # Must have enough money
                    if player.balance >= sq.house_cost:
                        legal.append(BUILD_BASE + pos)

            # Trade offer logic
            if self.trade_offers_made < 1:
                for pos in range(40):
                    sq = BOARD[pos]
                    if sq.type not in ('property', 'railroad', 'utility'):
                        continue
                    own = self.ownership[pos]
                    if own.owner is None or own.owner == player.idx:
                        continue
                    
                    # Check if player owns at least one property of the same color group
                    group = sq.color if sq.type == 'property' else sq.type
                    owns_any = False
                    for p in COLOR_GROUPS.get(group, []):
                        if self.ownership[p].owner == player.idx:
                            owns_any = True
                            break
                    if not owns_any:
                        continue
                    
                    amount = int(1.5 * sq.price)
                    if player.balance >= amount:
                        legal.append(OFFER_TRADE_BASE + pos)

        return legal

    def step(self, action: int) -> Tuple[dict, float, bool, dict]:
        """Execute action. Returns (state_dict, reward, done, info)."""
        reward = -0.005
        info: dict = {}

        if self.phase == Phase.GAME_OVER:
            return self.state_dict(), 0.0, True, {'error': 'Game already over'}

        player = self.players[self.current_player]
        was_bankrupt = player.is_bankrupt
        was_game_over = self.phase == Phase.GAME_OVER

        # ── PRE_ROLL ──────────────────────────────────────────────────────────
        if self.phase == Phase.PRE_ROLL:
            if player.in_jail:
                reward += self._handle_jail_action(action, player)
            else:
                if action == ROLL:
                    reward += self._do_roll(player)
                # else: illegal, ignore

        # ── BUY ───────────────────────────────────────────────────────────────
        elif self.phase == Phase.BUY:
            if action == BUY_PROP:
                sq = BOARD[self.pending_property]
                player.balance -= sq.price
                self.ownership[self.pending_property].owner = self.current_player
                self.pending_property = None
                self.phase = Phase.POST_ROLL
            elif action == DECLINE:
                # Start auction
                self._start_auction(self.pending_property)
                self.pending_property = None
                # phase is now AUCTION, don't advance turn yet

        # ── AUCTION ───────────────────────────────────────────────────────────
        elif self.phase == Phase.AUCTION:
            reward += self._handle_auction_action(action)

        # ── TRADE_RESPONSE ────────────────────────────────────────────────────
        elif self.phase == Phase.TRADE_RESPONSE:
            if action == ACCEPT_TRADE:
                t = self.pending_trade
                self.players[t['offerer']].balance -= t['amount']
                self.players[t['offeree']].balance += t['amount']
                self.ownership[t['property']].owner = t['offerer']
                self.phase = Phase.POST_ROLL
                self.current_player = t['offerer']
                self.pending_trade = None
            elif action == REJECT_TRADE:
                t = self.pending_trade
                self.phase = Phase.POST_ROLL
                self.current_player = t['offerer']
                self.pending_trade = None

        # ── POST_ROLL ────────────────────────────────────────────────────────
        elif self.phase == Phase.POST_ROLL:
            if action == END_TURN:
                self._end_turn()
            elif action >= BUILD_BASE and action < OFFER_TRADE_BASE:
                pos = action - BUILD_BASE
                if 0 <= pos < 40:
                    reward += self._build_house(player, pos)
            elif action >= OFFER_TRADE_BASE and action < ACCEPT_TRADE:
                self.trade_offers_made += 1
                pos = action - OFFER_TRADE_BASE
                sq = BOARD[pos]
                amt = int(1.5 * sq.price)
                self.pending_trade = {
                    'offerer': self.current_player,
                    'offeree': self.ownership[pos].owner,
                    'property': pos,
                    'amount': amt
                }
                self.phase = Phase.TRADE_RESPONSE
                self.current_player = self.ownership[pos].owner

        # Bankruptcy penalty
        if not was_bankrupt and player.is_bankrupt:
            reward -= 5.0
            
        # Win reward
        if self.phase == Phase.GAME_OVER and not was_game_over:
            active = self._get_active_players()
            if len(active) == 1 and active[0] == player.idx:
                reward += 10.0

        # Monopoly reward
        if not player.is_bankrupt:
            for color in COLOR_GROUPS.keys():
                if self._has_monopoly(player.idx, color):
                    if color not in self.completed_monopolies:
                        self.completed_monopolies.add(color)
                        reward += 1.0

        done = self.phase == Phase.GAME_OVER
        return self.state_dict(), float(reward), done, info

    # ── Dice & movement ────────────────────────────────────────────────────────

    def _roll_dice(self) -> Tuple[int, int]:
        d1 = self.rng.randint(1, 6)
        d2 = self.rng.randint(1, 6)
        self.last_roll = (d1, d2)
        return d1, d2

    def _do_roll(self, player: PlayerState) -> float:
        """Roll dice for a normal (non-jail) turn. Returns reward."""
        d1, d2 = self._roll_dice()
        doubles = d1 == d2

        if doubles:
            player.doubles_count += 1
            if player.doubles_count >= 3:
                # Three doubles in a row → go to jail, end turn
                self._go_to_jail(player.idx)
                player.doubles_count = 0
                self.phase = Phase.PRE_ROLL
                self._advance_turn()
                return 0.0
        else:
            player.doubles_count = 0

        reward = self._move_player(player.idx, d1 + d2)

        if self.phase not in (Phase.BUY, Phase.AUCTION):
            if doubles:
                # Extra turn — stay in PRE_ROLL
                self.phase = Phase.PRE_ROLL
            else:
                self.phase = Phase.POST_ROLL

        return reward

    def _move_player(self, player_idx: int, steps: int) -> float:
        """Move player forward by steps. Returns reward (Go bonus, rent, etc.)."""
        player = self.players[player_idx]
        old_pos = player.position
        new_pos = (old_pos + steps) % 40

        # Passing or landing on Go
        reward = 0.0
        if new_pos < old_pos or new_pos == 0:
            player.balance += 200

        player.position = new_pos
        reward += self._process_landing(player_idx, new_pos, steps)
        return reward

    def _process_landing(self, player_idx: int, position: int, dice_sum: int) -> float:
        """Handle landing effects. Returns immediate reward."""
        sq = BOARD[position]
        player = self.players[player_idx]
        reward = 0.0

        if sq.type == 'go':
            pass  # Already handled passing Go in _move_player

        elif sq.type == 'property':
            own = self.ownership[position]
            if own.owner is None:
                # Offer to buy
                self.pending_property = position
                self.phase = Phase.BUY
            elif own.owner != player_idx and not own.mortgaged:
                rent = self._calc_rent(position, dice_sum)
                paid = self._attempt_payment(player_idx, own.owner, rent)
                

        elif sq.type == 'railroad':
            own = self.ownership[position]
            if own.owner is None:
                self.pending_property = position
                self.phase = Phase.BUY
            elif own.owner != player_idx and not own.mortgaged:
                rent = self._calc_rent(position, dice_sum)
                paid = self._attempt_payment(player_idx, own.owner, rent)
                

        elif sq.type == 'utility':
            own = self.ownership[position]
            if own.owner is None:
                self.pending_property = position
                self.phase = Phase.BUY
            elif own.owner != player_idx and not own.mortgaged:
                rent = self._calc_rent(position, dice_sum)
                paid = self._attempt_payment(player_idx, own.owner, rent)
                

        elif sq.type == 'tax':
            paid = self._attempt_payment(player_idx, None, sq.tax_amount)
            

        elif sq.type == 'chance':
            self._draw_chance(player_idx)

        elif sq.type == 'chest':
            self._draw_chest(player_idx)

        elif sq.type == 'go_to_jail':
            self._go_to_jail(player_idx)

        # jail, free_parking: no effect
        return reward

    # ── Rent calculation ───────────────────────────────────────────────────────

    def _calc_rent(self, square_pos: int, dice_sum: int) -> int:
        sq = BOARD[square_pos]
        own = self.ownership[square_pos]

        if sq.type == 'railroad':
            # Count railroads owned by the same owner
            owner = own.owner
            count = sum(
                1 for p in COLOR_GROUPS['railroad']
                if self.ownership[p].owner == owner and not self.ownership[p].mortgaged
            )
            idx = min(count - 1, 3)
            return sq.rents[idx]

        elif sq.type == 'utility':
            owner = own.owner
            count = sum(
                1 for p in COLOR_GROUPS['utility']
                if self.ownership[p].owner == owner and not self.ownership[p].mortgaged
            )
            multiplier = 10 if count == 2 else 4
            return multiplier * dice_sum

        elif sq.type == 'property':
            houses = own.houses
            if houses == 0:
                # Check for unimproved monopoly (double rent)
                if sq.color and self._has_monopoly(own.owner, sq.color):
                    return sq.rents[0] * 2
                return sq.rents[0]
            return sq.rents[min(houses, 5)]

        return 0

    # ── Payment & bankruptcy ───────────────────────────────────────────────────

    def _attempt_payment(self, payer_idx: int, payee_idx: Optional[int], amount: int) -> bool:
        """
        Attempt to transfer `amount` from payer to payee.
        If payer cannot afford it, they go bankrupt: all assets go to bank (unowned).
        Returns True if payment succeeded, False if payer went bankrupt.
        """
        payer = self.players[payer_idx]
        if payer.balance >= amount:
            payer.balance -= amount
            if payee_idx is not None:
                self.players[payee_idx].balance += amount
            return True
        else:
            # Bankrupt: transfer what we have, forfeit assets
            if payee_idx is not None:
                self.players[payee_idx].balance += payer.balance
            payer.balance = 0
            payer.is_bankrupt = True
            # All properties return to bank
            for pos in range(40):
                if self.ownership[pos].owner == payer_idx:
                    self.ownership[pos].owner = None
                    self.ownership[pos].houses = 0
                    self.ownership[pos].mortgaged = False
            # Return GOOJF cards to deck
            for _ in range(payer.goojf_cards):
                self._chance_deck.insert(0, 'goojf')
            payer.goojf_cards = 0
            self._check_win_condition()
            return False

    def _check_win_condition(self):
        active = self._get_active_players()
        if len(active) == 1:
            self.phase = Phase.GAME_OVER

    # ── Jail ──────────────────────────────────────────────────────────────────

    def _go_to_jail(self, player_idx: int):
        player = self.players[player_idx]
        player.position = 10
        player.in_jail = True
        player.jail_turns = 0
        player.doubles_count = 0

    def _handle_jail_action(self, action: int, player: PlayerState) -> float:
        """Handle PRE_ROLL actions while player is in jail."""
        reward = 0.0

        if action == PAY_JAIL:
            if player.balance >= 50:
                player.balance -= 50
                player.in_jail = False
                player.jail_turns = 0
                # Now roll normally
                reward = self._do_roll(player)

        elif action == USE_GOOJF:
            if player.goojf_cards > 0:
                player.goojf_cards -= 1
                player.in_jail = False
                player.jail_turns = 0
                reward = self._do_roll(player)

        elif action == ROLL_JAIL:
            d1, d2 = self._roll_dice()
            player.jail_turns += 1

            if d1 == d2:
                # Rolled doubles — get out of jail, move
                player.in_jail = False
                player.jail_turns = 0
                player.doubles_count = 0  # no extra turn for jail doubles
                reward = self._process_landing(player.idx, (player.position + d1 + d2) % 40, d1 + d2)
                # Check Go passing
                new_pos = (player.position + d1 + d2) % 40
                if new_pos < player.position or new_pos == 0:
                    player.balance += 200
                player.position = new_pos
                self.phase = Phase.POST_ROLL
            elif player.jail_turns >= 3:
                # Must pay fine after 3 failed turns
                player.balance -= 50
                if player.balance < 0:
                    # Can't afford — bankrupt
                    self._attempt_payment(player.idx, None, 50)
                player.in_jail = False
                player.jail_turns = 0
                new_pos = (player.position + d1 + d2) % 40
                # Passing Go check
                if new_pos < player.position or new_pos == 0:
                    player.balance += 200
                player.position = new_pos
                reward += self._process_landing(player.idx, new_pos, d1 + d2)
                self.phase = Phase.POST_ROLL
            else:
                # Stayed in jail
                self.phase = Phase.POST_ROLL

        return reward

    # ── Auction ───────────────────────────────────────────────────────────────

    def _start_auction(self, prop_pos: int):
        """Initialise auction for a property."""
        self.auction_property = prop_pos
        self.auction_current_bid = 0
        self.auction_highest_bidder = None
        # All active players participate (including current player)
        self.auction_participants = list(self._get_active_players())
        self.auction_bidder_idx = 0
        # Start from current player
        if self.current_player in self.auction_participants:
            start = self.auction_participants.index(self.current_player)
            self.auction_participants = (
                self.auction_participants[start:] + self.auction_participants[:start]
            )
        self.phase = Phase.AUCTION

    def _handle_auction_action(self, action: int) -> float:
        """Process one auction bid/pass. Returns reward delta."""
        if not self.auction_participants:
            self._finish_auction()
            return 0.0

        bidder_idx = self.auction_participants[self.auction_bidder_idx]
        bidder = self.players[bidder_idx]

        if action == AUCTION_PASS:
            # Remove this player from auction
            self.auction_participants.pop(self.auction_bidder_idx)
            # Don't advance bidder_idx because list shrinks
            if self.auction_bidder_idx >= len(self.auction_participants):
                self.auction_bidder_idx = 0
        else:
            min_bid = self.auction_current_bid + 1
            bid_amount = 0

            if action == AUCTION_BID_MIN:
                bid_amount = min_bid
            elif action == AUCTION_BID_LOW:
                bid_amount = max(min_bid, int(bidder.balance * 0.15))
            elif action == AUCTION_BID_MED:
                bid_amount = max(min_bid, int(bidder.balance * 0.30))
            elif action == AUCTION_BID_HIGH:
                bid_amount = max(min_bid, int(bidder.balance * 0.60))
            elif action == AUCTION_BID_ALL:
                bid_amount = max(min_bid, bidder.balance)

            if bid_amount > 0 and bidder.balance >= bid_amount:
                self.auction_current_bid = bid_amount
                self.auction_highest_bidder = bidder_idx
                # Advance to next bidder
                self.auction_bidder_idx = (self.auction_bidder_idx + 1) % len(self.auction_participants)

        # If only one participant left, they win
        if len(self.auction_participants) <= 1:
            self._finish_auction()
            return 0.0

        # Also: if we've gone around once since last bid without another bid,
        # (handled by pass logic above — when all but one have passed, finish)
        return 0.0

    def _finish_auction(self):
        """Conclude auction, transfer property to winner."""
        winner = self.auction_highest_bidder
        prop = self.auction_property
        if winner is not None and prop is not None:
            self.players[winner].balance -= self.auction_current_bid
            self.ownership[prop].owner = winner

        # Clean up auction state
        self.auction_property = None
        self.auction_current_bid = 0
        self.auction_highest_bidder = None
        self.auction_participants = []
        self.auction_bidder_idx = 0

        self.phase = Phase.POST_ROLL

    # ── Building ───────────────────────────────────────────────────────────────

    def _build_house(self, player: PlayerState, pos: int) -> float:
        """Build a house at pos for player. Returns reward."""
        sq = BOARD[pos]
        own = self.ownership[pos]

        if own.owner != player.idx:
            return 0.0
        if own.mortgaged or own.houses >= 5:
            return 0.0
        if not sq.color or not self._has_monopoly(player.idx, sq.color):
            return 0.0

        # Even build check
        positions = COLOR_GROUPS[sq.color]
        houses_list = [self.ownership[p].houses for p in positions]
        min_h = min(houses_list)
        if own.houses > min_h:
            return 0.0

        if player.balance < sq.house_cost:
            return 0.0

        player.balance -= sq.house_cost
        own.houses += 1
        return 0.1  # Building is capital investment, reward is future rent income

    # ── Turn management ────────────────────────────────────────────────────────

    def _end_turn(self):
        """End current player's turn and advance to next."""
        player = self.players[self.current_player]
        player.doubles_count = 0
        self._advance_turn()

    def _advance_turn(self):
        """Move current_player to next non-bankrupt player."""
        self.trade_offers_made = 0
        active = self._get_active_players()
        if not active:
            self.phase = Phase.GAME_OVER
            return
        if len(active) == 1:
            self.phase = Phase.GAME_OVER
            return

        # Find next active player after current
        next_idx = (self.current_player + 1) % self.n_players
        for _ in range(self.n_players):
            if not self.players[next_idx].is_bankrupt:
                break
            next_idx = (next_idx + 1) % self.n_players

        self.current_player = next_idx
        self.phase = Phase.PRE_ROLL
        self.turn_number += 1

    # ── Helpers ────────────────────────────────────────────────────────────────

    def _has_monopoly(self, player_idx: int, color: str) -> bool:
        """Return True if player_idx owns all properties of the given color."""
        positions = COLOR_GROUPS.get(color, [])
        if not positions:
            return False
        return all(
            self.ownership[p].owner == player_idx
            for p in positions
        )

    def _get_active_players(self) -> List[int]:
        return [p.idx for p in self.players if not p.is_bankrupt]

    # ── Card drawing ──────────────────────────────────────────────────────────

    def _reshuffle_chance(self):
        self._chance_deck = self.rng.sample(CHANCE_CARDS, len(CHANCE_CARDS))

    def _reshuffle_chest(self):
        self._chest_deck = self.rng.sample(CHEST_CARDS, len(CHEST_CARDS))

    def _draw_chance(self, player_idx: int) -> float:
        """Draw a chance card, apply effect, return reward delta."""
        if not self._chance_deck:
            self._reshuffle_chance()
        card = self._chance_deck.pop()
        player = self.players[player_idx]
        reward = 0.0

        if card == 'advance_go':
            reward += self._advance_to(player_idx, 0)

        elif card == 'go_to_jail':
            self._go_to_jail(player_idx)

        elif card == 'go_back_3':
            new_pos = (player.position - 3) % 40
            player.position = new_pos
            reward += self._process_landing(player_idx, new_pos, 0)

        elif card == 'pay_15':
            self._attempt_payment(player_idx, None, 15)
            reward -= 15.0

        elif card in ('nearest_railroad_1', 'nearest_railroad_2'):
            rr_positions = COLOR_GROUPS['railroad']
            nearest = self._nearest_position(player.position, rr_positions)
            own = self.ownership[nearest]
            if own.owner is not None and own.owner != player_idx:
                # Pay double rent
                rent = self._calc_rent(nearest, sum(self.last_roll)) * 2
                self._attempt_payment(player_idx, own.owner, rent)
                reward -= float(rent)
            else:
                reward += self._advance_to(player_idx, nearest)

        elif card == 'nearest_utility':
            util_positions = COLOR_GROUPS['utility']
            nearest = self._nearest_position(player.position, util_positions)
            own = self.ownership[nearest]
            if own.owner is not None and own.owner != player_idx:
                # Pay 10x dice roll
                dice = self.rng.randint(1, 6) + self.rng.randint(1, 6)
                rent = 10 * dice
                self._attempt_payment(player_idx, own.owner, rent)
                reward -= float(rent)
            else:
                reward += self._advance_to(player_idx, nearest)

        elif card == 'bank_dividend_50':
            player.balance += 50
            reward += 50.0

        elif card == 'goojf':
            player.goojf_cards += 1

        elif card == 'street_repairs':
            # $40 per house, $115 per hotel
            total = sum(
                (40 if self.ownership[p].houses < 5 else 115) * (self.ownership[p].houses if self.ownership[p].houses < 5 else 1)
                for p in range(40)
                if self.ownership[p].owner == player_idx and self.ownership[p].houses > 0
            )
            self._attempt_payment(player_idx, None, total)
            reward -= float(total)

        elif card == 'advance_illinois':
            reward += self._advance_to(player_idx, 24)

        elif card == 'advance_st_charles':
            reward += self._advance_to(player_idx, 11)

        elif card == 'advance_boardwalk':
            reward += self._advance_to(player_idx, 39)

        elif card == 'advance_reading_rr':
            reward += self._advance_to(player_idx, 5)

        elif card == 'chairman_board':
            active = self._get_active_players()
            others = [i for i in active if i != player_idx]
            total = 50 * len(others)
            if player.balance >= total:
                player.balance -= total
                for o in others:
                    self.players[o].balance += 50
                reward -= float(total)
            else:
                # Pay what you can, then bankrupt
                per_player = player.balance // len(others) if others else 0
                for o in others:
                    player.balance -= per_player
                    self.players[o].balance += per_player
                self._attempt_payment(player_idx, None, 0)

        elif card == 'loan_matures':
            player.balance += 150
            reward += 150.0

        return reward

    def _draw_chest(self, player_idx: int) -> float:
        """Draw a community chest card, apply effect, return reward delta."""
        if not self._chest_deck:
            self._reshuffle_chest()
        card = self._chest_deck.pop()
        player = self.players[player_idx]
        reward = 0.0

        if card == 'advance_go':
            reward += self._advance_to(player_idx, 0)

        elif card == 'bank_error_200':
            player.balance += 200

        elif card == 'doctor_fee_50':
            self._attempt_payment(player_idx, None, 50)
            reward -= 50.0

        elif card == 'go_to_jail':
            self._go_to_jail(player_idx)

        elif card == 'goojf':
            player.goojf_cards += 1

        elif card == 'birthday_10':
            active = self._get_active_players()
            collected = 0
            for other_idx in active:
                if other_idx == player_idx:
                    continue
                if self._attempt_payment(other_idx, player_idx, 10):
                    collected += 10
            reward += float(collected)

        elif card == 'grand_opera_50':
            active = self._get_active_players()
            collected = 0
            for other_idx in active:
                if other_idx == player_idx:
                    continue
                if self._attempt_payment(other_idx, player_idx, 50):
                    collected += 50
            reward += float(collected)

        elif card == 'holiday_fund_100':
            player.balance += 100
            reward += 100.0

        elif card == 'income_tax_refund_20':
            player.balance += 20
            reward += 20.0

        elif card == 'hospital_100':
            self._attempt_payment(player_idx, None, 100)
            reward -= 100.0

        elif card == 'school_fees_150':
            self._attempt_payment(player_idx, None, 150)
            reward -= 150.0

        elif card == 'consultancy_25':
            player.balance += 25
            reward += 25.0

        elif card == 'beauty_contest_10':
            player.balance += 10
            reward += 10.0

        elif card == 'inherit_100':
            player.balance += 100
            reward += 100.0

        elif card == 'life_insurance_100':
            player.balance += 100
            reward += 100.0

        elif card == 'street_repairs_cc':
            total = sum(
                (40 if self.ownership[p].houses < 5 else 115) * (self.ownership[p].houses if self.ownership[p].houses < 5 else 1)
                for p in range(40)
                if self.ownership[p].owner == player_idx and self.ownership[p].houses > 0
            )
            self._attempt_payment(player_idx, None, total)
            reward -= float(total)

        return reward

    def _advance_to(self, player_idx: int, target_pos: int) -> float:
        """Move player to target_pos, collect Go if passing it. Returns reward."""
        player = self.players[player_idx]
        old_pos = player.position
        reward = 0.0

        if target_pos <= old_pos and target_pos != old_pos:
            # Passing Go
            player.balance += 200
        elif target_pos == 0:
            player.balance += 200

        player.position = target_pos
        reward += self._process_landing(player_idx, target_pos, sum(self.last_roll))
        return reward

    def _nearest_position(self, current: int, positions: List[int]) -> int:
        """Find nearest position from current (going forward)."""
        best = positions[0]
        best_dist = (positions[0] - current) % 40
        for p in positions[1:]:
            dist = (p - current) % 40
            if dist < best_dist:
                best = p
                best_dist = dist
        return best

    # ── State serialisation ────────────────────────────────────────────────────

    def state_dict(self) -> dict:
        """Return serialisable state dict for encoding/LLM."""
        return {
            'current_player': self.current_player,
            'phase': self.phase.value,
            'turn_number': self.turn_number,
            'last_roll': list(self.last_roll),
            'pending_property': self.pending_property,
            'pending_trade': self.pending_trade,
            'players': [
                {
                    'idx': p.idx,
                    'name': p.name,
                    'balance': p.balance,
                    'position': p.position,
                    'in_jail': p.in_jail,
                    'jail_turns': p.jail_turns,
                    'goojf_cards': p.goojf_cards,
                    'is_bankrupt': p.is_bankrupt,
                    'doubles_count': p.doubles_count,
                }
                for p in self.players
            ],
            'ownership': {
                str(pos): {
                    'owner': own.owner,
                    'houses': own.houses,
                    'mortgaged': own.mortgaged,
                }
                for pos, own in self.ownership.items()
            },
            'auction': {
                'property': self.auction_property,
                'current_bid': self.auction_current_bid,
                'highest_bidder': self.auction_highest_bidder,
                'participants': list(self.auction_participants),
                'bidder_idx': self.auction_bidder_idx,
            } if self.phase == Phase.AUCTION else None,
        }
