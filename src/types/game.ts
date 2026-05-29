export type PlayerId = string;

export interface Player {
  id: PlayerId;
  name: string;
  balance: number;
  position: number;
}

export interface Property {
  id: string;
  boardIndex: number;
  name: string;
  price: number;
  rent: number;
  ownerId: PlayerId | null;
}

export type PendingAction = { type: "buy"; propertyId: string } | null;
