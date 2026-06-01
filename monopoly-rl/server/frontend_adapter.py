from typing import List, Optional, Dict, Any
from pydantic import BaseModel

class PlayerData(BaseModel):
    id: str
    name: str
    balance: int
    position: int
    inJail: bool
    jailTurns: int
    doublesCount: int
    getOutOfJailFreeCards: int
    isBankrupt: Optional[bool] = False
    isBot: Optional[bool] = False

class SquareData(BaseModel):
    id: str
    boardIndex: int
    name: str
    type: str
    ownerId: Optional[str] = None
    houses: int = 0
    mortgaged: Optional[bool] = False
    
class TradeData(BaseModel):
    status: str
    draft: Dict[str, Any]

class AuctionData(BaseModel):
    status: str
    propertyId: Optional[str] = None
    bids: Dict[str, int] = {}
    currentBidderIndex: int = 0
    passedPlayerIds: List[str] = []

class FrontendActRequest(BaseModel):
    players: List[PlayerData]
    squares: List[SquareData]
    currentPlayerIndex: int
    turnPhase: str
    lastDie1: Optional[int]
    lastDie2: Optional[int]
    pendingAction: Optional[Dict[str, Any]]
    trade: TradeData
    auction: AuctionData

class FrontendActResponse(BaseModel):
    actionType: str
    payload: Dict[str, Any] = {}

def parse_frontend_state(req: FrontendActRequest) -> tuple[dict, Any]:
    """Convert Next.js state to MonopolyEngine state_dict, and return it alongside an initialized engine."""
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
    from env.game_engine import MonopolyEngine, Phase, SquareOwnership
    from env.board import BOARD
    
    player_id_to_idx = {p.id: i for i, p in enumerate(req.players)}
    
    # 1. Map Phase
    if req.auction.status == "active":
        phase = Phase.AUCTION
    elif req.trade.status == "pending":
        phase = Phase.TRADE_RESPONSE
    elif req.turnPhase == "PRE_ROLL":
        phase = Phase.PRE_ROLL
    elif req.turnPhase == "POST_ROLL":
        if req.pendingAction and req.pendingAction.get('type') == 'buy':
            phase = Phase.BUY
        else:
            phase = Phase.POST_ROLL
    else:
        phase = Phase.GAME_OVER
        
    pending_property = None
    if phase == Phase.BUY and req.pendingAction:
        pending_prop_id = req.pendingAction.get('propertyId')
        for sq in req.squares:
            if sq.id == pending_prop_id:
                pending_property = sq.boardIndex
                break

    # Reconstruct Engine
    engine = MonopolyEngine(n_players=len(req.players))
    engine.current_player = req.currentPlayerIndex
    engine.phase = phase
    engine.last_roll = (req.lastDie1 or 0, req.lastDie2 or 0)
    engine.pending_property = pending_property
    
    if req.trade.status == "pending":
        draft = req.trade.draft
        offerer = player_id_to_idx.get(draft.get('senderId'), 0)
        offeree = player_id_to_idx.get(draft.get('receiverId'), 0)
        # Find first property offered to convert to Python format (which only supports 1 prop trade natively)
        prop_id = draft.get('propertiesOfferedBySender', [])
        prop_idx = 0
        if prop_id:
            prop_idx = next((s.boardIndex for s in req.squares if s.id == prop_id[0]), 0)
            
        engine.pending_trade = {
            'offerer': offerer,
            'offeree': offeree,
            'property': prop_idx,
            'amount': draft.get('moneyOfferedByReceiver', 0) - draft.get('moneyOfferedBySender', 0)
        }
    
    if req.auction.status == "active" and req.auction.propertyId:
        prop_idx = next((s.boardIndex for s in req.squares if s.id == req.auction.propertyId), 0)
        engine.auction_property = prop_idx
        
        # Calculate current highest bid from bids dict
        max_bid = max(req.auction.bids.values()) if req.auction.bids else 0
        engine.auction_current_bid = max_bid
        
        highest_bidder_id = None
        for pid, amt in req.auction.bids.items():
            if amt == max_bid and max_bid > 0:
                highest_bidder_id = pid
                break
        
        engine.auction_highest_bidder = player_id_to_idx.get(highest_bidder_id) if highest_bidder_id else None
        
        # Active participants are players who haven't passed
        active_bidders = [p.id for p in req.players if p.id not in req.auction.passedPlayerIds]
        engine.auction_participants = [player_id_to_idx[pid] for pid in active_bidders]
        
        # Current bidder index
        current_bidder_id = req.players[req.auction.currentBidderIndex].id
        if current_bidder_id in req.auction.passedPlayerIds:
            engine.auction_bidder_idx = 0
        else:
            try:
                engine.auction_bidder_idx = engine.auction_participants.index(player_id_to_idx[current_bidder_id])
            except ValueError:
                engine.auction_bidder_idx = 0

    # 2. Map Players
    for i, p_data in enumerate(req.players):
        p = engine.players[i]
        p.balance = p_data.balance
        p.position = p_data.position
        p.in_jail = p_data.inJail
        p.jail_turns = p_data.jailTurns
        p.goojf_cards = p_data.getOutOfJailFreeCards
        p.is_bankrupt = p_data.isBankrupt
        p.doubles_count = p_data.doublesCount

    # 3. Map Ownership
    for sq in req.squares:
        pos = sq.boardIndex
        if pos < 40:
            own = engine.ownership[pos]
            own.owner = player_id_to_idx.get(sq.ownerId) if sq.ownerId else None
            own.houses = sq.houses
            own.mortgaged = sq.mortgaged

    return engine.state_dict(), engine

def map_action_to_frontend(action_id: int) -> FrontendActResponse:
    from env.game_engine import (
        ROLL, END_TURN, BUY_PROP, DECLINE, PAY_JAIL, USE_GOOJF, ROLL_JAIL,
        AUCTION_PASS, AUCTION_BID_MIN, AUCTION_BID_LOW, AUCTION_BID_MED, AUCTION_BID_HIGH, AUCTION_BID_ALL,
        BUILD_BASE, OFFER_TRADE_BASE, ACCEPT_TRADE, REJECT_TRADE
    )
    
    if action_id == ROLL:
        return FrontendActResponse(actionType="ROLL")
    elif action_id == END_TURN:
        return FrontendActResponse(actionType="END_TURN")
    elif action_id == BUY_PROP:
        return FrontendActResponse(actionType="BUY_PROPERTY")
    elif action_id == DECLINE:
        return FrontendActResponse(actionType="DECLINE_BUY")
    elif action_id == PAY_JAIL:
        return FrontendActResponse(actionType="PAY_JAIL")
    elif action_id == USE_GOOJF:
        return FrontendActResponse(actionType="USE_GOOJF")
    elif action_id == ROLL_JAIL:
        return FrontendActResponse(actionType="ROLL_JAIL")
    elif action_id == AUCTION_PASS:
        return FrontendActResponse(actionType="AUCTION_PASS")
    elif action_id in (AUCTION_BID_MIN, AUCTION_BID_LOW, AUCTION_BID_MED, AUCTION_BID_HIGH, AUCTION_BID_ALL):
        # The exact bid logic is internal to the backend, so we pass the enum mapping to frontend
        # Or frontend can just do standard bid. We will tell frontend which fraction it is.
        frac = {AUCTION_BID_MIN: "MIN", AUCTION_BID_LOW: "LOW", AUCTION_BID_MED: "MED", AUCTION_BID_HIGH: "HIGH", AUCTION_BID_ALL: "ALL"}
        return FrontendActResponse(actionType="AUCTION_BID", payload={"tier": frac[action_id]})
    elif BUILD_BASE <= action_id < OFFER_TRADE_BASE:
        pos = action_id - BUILD_BASE
        return FrontendActResponse(actionType="BUILD_HOUSE", payload={"position": pos})
    elif action_id == ACCEPT_TRADE:
        return FrontendActResponse(actionType="ACCEPT_TRADE")
    elif action_id == REJECT_TRADE:
        return FrontendActResponse(actionType="REJECT_TRADE")
    
    return FrontendActResponse(actionType="END_TURN")
